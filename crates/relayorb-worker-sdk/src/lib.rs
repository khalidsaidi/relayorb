use std::{
    collections::HashMap,
    net::SocketAddr,
    str::FromStr,
    sync::{
        atomic::{AtomicU64, AtomicUsize, Ordering},
        Arc,
    },
    time::Instant,
};

use anyhow::Context;
use async_trait::async_trait;
use axum::{
    extract::{Path, State},
    http::HeaderMap,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use once_cell::sync::Lazy;
use relayorb_core::{
    validate_json_with_schema, ApiError, CapabilityManifest, ErrorCode, ProviderStats,
    RelayOrbError, RequestMeta, SuccessEnvelope,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tokio::time::Duration;
use tower_http::trace::TraceLayer;
use tracing::{error, info, info_span, warn};
use uuid::Uuid;

static INVOKE_SCHEMA: Lazy<Value> = Lazy::new(|| {
    json!({
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "required": ["requestId", "traceId", "payload"],
      "properties": {
        "requestId": {"type": "string", "minLength": 1},
        "traceId": {"type": "string", "minLength": 1},
        "payload": {}
      }
    })
});

#[derive(Debug, Clone)]
pub struct WorkerConfig {
    pub bind_addr: String,
    pub instance_id: String,
    pub base_url: String,
    pub region: Option<String>,
    pub registry_url: String,
    pub ttl_seconds: i64,
    pub heartbeat_interval_seconds: u64,
}

impl Default for WorkerConfig {
    fn default() -> Self {
        Self {
            bind_addr: "0.0.0.0:8090".to_string(),
            instance_id: format!("worker-{}", Uuid::new_v4()),
            base_url: "http://127.0.0.1:8090".to_string(),
            region: Some("local".to_string()),
            registry_url: "http://127.0.0.1:8081".to_string(),
            ttl_seconds: 60,
            heartbeat_interval_seconds: 20,
        }
    }
}

#[derive(Clone)]
pub struct WorkerRuntime {
    config: WorkerConfig,
    manifests: HashMap<String, CapabilityManifest>,
    handlers: HashMap<String, Arc<dyn CapabilityHandler>>,
    stats: Arc<StatsTracker>,
}

pub struct CapabilityRegistration {
    pub manifest: CapabilityManifest,
    pub handler: Arc<dyn CapabilityHandler>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WorkerInvokeRequest {
    request_id: String,
    trace_id: String,
    payload: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RegisterPayload {
    instance_id: String,
    base_url: String,
    region: Option<String>,
    ttl_seconds: i64,
    capabilities: Vec<CapabilityManifest>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HeartbeatPayload {
    instance_id: String,
    ttl_seconds: i64,
    stats: ProviderStats,
}

#[async_trait]
pub trait CapabilityHandler: Send + Sync {
    async fn handle(&self, payload: Value) -> Result<Value, RelayOrbError>;
}

impl WorkerRuntime {
    pub fn new(
        config: WorkerConfig,
        capabilities: Vec<CapabilityRegistration>,
    ) -> anyhow::Result<Self> {
        let mut manifests = HashMap::new();
        let mut handlers = HashMap::new();

        for capability in capabilities {
            let id = capability.manifest.capability_id.clone();
            manifests.insert(id.clone(), capability.manifest);
            handlers.insert(id, capability.handler);
        }

        if manifests.is_empty() {
            anyhow::bail!("worker runtime requires at least one capability registration");
        }

        Ok(Self {
            config,
            manifests,
            handlers,
            stats: Arc::new(StatsTracker::default()),
        })
    }

    pub async fn serve(self) -> anyhow::Result<()> {
        self.register_with_registry().await?;

        let state = Arc::new(self.clone());
        let heartbeater = state.clone();
        tokio::spawn(async move {
            if let Err(err) = heartbeater.heartbeat_loop().await {
                error!(error = %err, "heartbeat loop exited");
            }
        });

        let router = Router::new()
            .route("/health", get(health))
            .route("/capabilities", get(capabilities))
            .route("/invoke/:capability_id", post(invoke))
            .with_state(state)
            .layer(TraceLayer::new_for_http());

        let addr = SocketAddr::from_str(&self.config.bind_addr)?;
        info!(%addr, instanceId = %self.config.instance_id, "worker listening");
        let listener = tokio::net::TcpListener::bind(addr).await?;
        axum::serve(listener, router).await?;
        Ok(())
    }

    async fn register_with_registry(&self) -> anyhow::Result<()> {
        let payload = RegisterPayload {
            instance_id: self.config.instance_id.clone(),
            base_url: self.config.base_url.clone(),
            region: self.config.region.clone(),
            ttl_seconds: self.config.ttl_seconds,
            capabilities: self.manifests.values().cloned().collect(),
        };

        let client = reqwest::Client::new();
        let url = format!("{}/v1/register", self.config.registry_url);

        let response = client
            .post(url)
            .json(&payload)
            .send()
            .await
            .context("failed to register worker")?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            anyhow::bail!("worker registration failed: status={status}, body={body}");
        }

        Ok(())
    }

    async fn heartbeat_loop(&self) -> anyhow::Result<()> {
        let client = reqwest::Client::new();
        let interval = Duration::from_secs(self.config.heartbeat_interval_seconds);

        loop {
            tokio::time::sleep(interval).await;

            let payload = HeartbeatPayload {
                instance_id: self.config.instance_id.clone(),
                ttl_seconds: self.config.ttl_seconds,
                stats: self.stats.snapshot(),
            };

            let url = format!("{}/v1/heartbeat", self.config.registry_url);
            let response = client.post(&url).json(&payload).send().await;
            match response {
                Ok(res) if res.status().is_success() => {}
                Ok(res) => {
                    warn!(status = %res.status(), "worker heartbeat rejected by registry");
                }
                Err(err) => {
                    warn!(error = %err, "worker heartbeat failed");
                }
            }
        }
    }
}

#[derive(Default)]
struct StatsTracker {
    in_flight: AtomicUsize,
    latency_ewma_scaled: AtomicU64,
    error_ewma_scaled: AtomicU64,
}

impl StatsTracker {
    fn on_start(&self) {
        self.in_flight.fetch_add(1, Ordering::SeqCst);
    }

    fn on_finish(&self, latency_ms: f64, is_error: bool) {
        self.in_flight.fetch_sub(1, Ordering::SeqCst);

        let alpha = 0.2_f64;
        let prev_latency = self.latency_ewma_scaled.load(Ordering::SeqCst) as f64 / 1000.0;
        let next_latency = if prev_latency == 0.0 {
            latency_ms
        } else {
            prev_latency * (1.0 - alpha) + latency_ms * alpha
        };
        self.latency_ewma_scaled
            .store((next_latency * 1000.0) as u64, Ordering::SeqCst);

        let prev_error = self.error_ewma_scaled.load(Ordering::SeqCst) as f64 / 1000.0;
        let sample = if is_error { 1.0 } else { 0.0 };
        let next_error = if prev_error == 0.0 {
            sample
        } else {
            prev_error * (1.0 - alpha) + sample * alpha
        };
        self.error_ewma_scaled
            .store((next_error * 1000.0) as u64, Ordering::SeqCst);
    }

    fn snapshot(&self) -> ProviderStats {
        ProviderStats {
            in_flight: Some(self.in_flight.load(Ordering::SeqCst) as u32),
            recent_latency_ms: Some(
                self.latency_ewma_scaled.load(Ordering::SeqCst) as f64 / 1000.0,
            ),
            recent_error_rate: Some(self.error_ewma_scaled.load(Ordering::SeqCst) as f64 / 1000.0),
        }
    }
}

async fn health(headers: HeaderMap) -> Result<impl IntoResponse, ApiError> {
    let meta = request_meta(&headers, None, None);
    Ok(Json(SuccessEnvelope::ok(&meta, json!({"healthy": true}))))
}

async fn capabilities(
    State(state): State<Arc<WorkerRuntime>>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, ApiError> {
    let meta = request_meta(&headers, None, None);
    let capabilities = state.manifests.values().cloned().collect::<Vec<_>>();
    Ok(Json(SuccessEnvelope::ok(
        &meta,
        json!({"capabilities": capabilities}),
    )))
}

async fn invoke(
    State(state): State<Arc<WorkerRuntime>>,
    Path(capability_id): Path<String>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Result<impl IntoResponse, ApiError> {
    let meta = request_meta(
        &headers,
        body.get("requestId").and_then(Value::as_str),
        body.get("traceId").and_then(Value::as_str),
    );

    validate_json_with_schema(&INVOKE_SCHEMA, &body).map_err(|errors| {
        api_error(
            &meta,
            RelayOrbError::new(
                ErrorCode::SchemaValidationFailed,
                "invalid worker invoke payload",
            )
            .with_details(json!({"errors": errors})),
        )
    })?;

    let request: WorkerInvokeRequest = serde_json::from_value(body).map_err(|err| {
        api_error(
            &meta,
            RelayOrbError::new(
                ErrorCode::SchemaValidationFailed,
                "invalid worker invoke shape",
            )
            .with_details(json!({"error": err.to_string()})),
        )
    })?;

    let manifest = state
        .manifests
        .get(&capability_id)
        .ok_or_else(|| {
            api_error(
                &meta,
                RelayOrbError::new(
                    ErrorCode::CapabilityNotFound,
                    format!("capability '{capability_id}' is not supported by this worker"),
                ),
            )
        })?
        .clone();

    validate_json_with_schema(&manifest.input_schema, &request.payload).map_err(|errors| {
        api_error(
            &meta,
            RelayOrbError::new(
                ErrorCode::SchemaValidationFailed,
                "worker payload failed manifest inputSchema validation",
            )
            .with_details(json!({"errors": errors})),
        )
    })?;

    let handler = state.handlers.get(&capability_id).ok_or_else(|| {
        api_error(
            &meta,
            RelayOrbError::new(
                ErrorCode::Internal,
                "handler missing for registered capability",
            ),
        )
    })?;

    let span = info_span!(
        "worker_invoke",
        requestId = %meta.request_id,
        traceId = %meta.trace_id,
        capability = %capability_id
    );
    let _guard = span.enter();

    state.stats.on_start();
    let started = Instant::now();
    let result = handler.handle(request.payload).await;
    let elapsed = started.elapsed().as_secs_f64() * 1000.0;

    let response_payload = match result {
        Ok(payload) => {
            state.stats.on_finish(elapsed, false);
            payload
        }
        Err(err) => {
            state.stats.on_finish(elapsed, true);
            return Err(api_error(&meta, err));
        }
    };

    validate_json_with_schema(&manifest.output_schema, &response_payload).map_err(|errors| {
        api_error(
            &meta,
            RelayOrbError::new(
                ErrorCode::SchemaValidationFailed,
                "worker handler output failed outputSchema validation",
            )
            .with_details(json!({"errors": errors})),
        )
    })?;

    info!(latencyMs = elapsed, "worker invocation completed");
    Ok(Json(SuccessEnvelope::ok(&meta, response_payload)))
}

fn request_meta(
    headers: &HeaderMap,
    body_request_id: Option<&str>,
    body_trace_id: Option<&str>,
) -> RequestMeta {
    let request_id = body_request_id
        .map(ToString::to_string)
        .or_else(|| header_value(headers, "x-request-id"))
        .unwrap_or_else(|| Uuid::new_v4().to_string());

    let trace_id = body_trace_id
        .map(ToString::to_string)
        .or_else(|| header_value(headers, "x-trace-id"))
        .unwrap_or_else(|| Uuid::new_v4().to_string());

    RequestMeta {
        request_id,
        trace_id,
    }
}

fn header_value(headers: &HeaderMap, key: &str) -> Option<String> {
    headers
        .get(key)
        .and_then(|v| v.to_str().ok())
        .map(ToString::to_string)
}

fn api_error(meta: &RequestMeta, err: RelayOrbError) -> ApiError {
    ApiError::from_inner(meta.request_id.clone(), meta.trace_id.clone(), err)
}
