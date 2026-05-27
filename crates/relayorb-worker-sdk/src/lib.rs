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
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use metrics::{counter, gauge, histogram};
use once_cell::sync::{Lazy, OnceCell};
use relayorb_core::{
    cloud_run_id_token, init_metrics_exporter, render_prometheus_metrics,
    trace_id_from_traceparent, traceparent_from_trace_id, validate_json_with_schema, ApiError,
    CapabilityManifest, ErrorCode, ProviderStats, RelayOrbError, RequestMeta, SuccessEnvelope,
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
    pub service_name: String,
    pub version: String,
    pub env: String,
    pub base_url: String,
    pub region: Option<String>,
    pub registry_url: String,
    pub registry_identity_audience: Option<String>,
    pub ttl_seconds: i64,
    pub heartbeat_interval_seconds: u64,
}

impl Default for WorkerConfig {
    fn default() -> Self {
        Self {
            bind_addr: "0.0.0.0:8090".to_string(),
            instance_id: format!("worker-{}", Uuid::new_v4()),
            service_name: "relayorb-worker-dev".to_string(),
            version: "dev".to_string(),
            env: "dev".to_string(),
            base_url: "http://127.0.0.1:8090".to_string(),
            region: Some("local".to_string()),
            registry_url: "http://127.0.0.1:8081".to_string(),
            registry_identity_audience: None,
            ttl_seconds: 60,
            heartbeat_interval_seconds: 20,
        }
    }
}

#[derive(Clone)]
pub struct WorkerRuntime {
    config: WorkerConfig,
    metrics_auth: MetricsAuthConfig,
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
    service_name: String,
    base_url: String,
    env: String,
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

#[derive(Debug, Clone)]
struct MetricContext {
    env: String,
    service_name: String,
    version: String,
    region: String,
}

static METRIC_CONTEXT: OnceCell<MetricContext> = OnceCell::new();

#[derive(Clone)]
enum MetricsAuthConfig {
    Public,
    Bearer { token: String },
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
        let metrics_auth = build_metrics_auth_config(&config.env)?;
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
            metrics_auth,
            manifests,
            handlers,
            stats: Arc::new(StatsTracker::default()),
        })
    }

    pub async fn serve(self) -> anyhow::Result<()> {
        init_metrics_exporter()?;
        init_metric_context(&self.config);
        let state = Arc::new(self.clone());
        let registrar = state.clone();
        tokio::spawn(async move {
            if let Err(err) = registrar.registration_and_heartbeat_loop().await {
                error!(error = %err, "registration/heartbeat loop exited");
            }
        });

        let router = Router::new()
            .route("/health", get(health))
            .route("/metrics", get(metrics))
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

    async fn registration_and_heartbeat_loop(&self) -> anyhow::Result<()> {
        loop {
            match self.register_with_registry().await {
                Ok(()) => {
                    info!("worker registered with registry");
                    break;
                }
                Err(err) => {
                    warn!(error = %err, "worker registration failed; retrying");
                    tokio::time::sleep(Duration::from_secs(5)).await;
                }
            }
        }

        self.heartbeat_loop().await
    }

    async fn register_with_registry(&self) -> anyhow::Result<()> {
        let payload = RegisterPayload {
            instance_id: self.config.instance_id.clone(),
            service_name: self.config.service_name.clone(),
            base_url: self.config.base_url.clone(),
            env: self.config.env.clone(),
            region: self.config.region.clone(),
            ttl_seconds: self.config.ttl_seconds,
            capabilities: self.manifests.values().cloned().collect(),
        };

        let client = reqwest::Client::new();
        let url = format!("{}/v1/register", self.config.registry_url);
        let request_id = Uuid::new_v4().to_string();
        let trace_id = Uuid::new_v4().to_string();

        let response = client
            .post(url)
            .headers(
                self.registry_headers(&client, &request_id, &trace_id)
                    .await?,
            )
            .json(&payload)
            .send()
            .await
            .context("failed to register worker")?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            counter!(
                "relayorb_worker_registry_register_total",
                "env" => self.config.env.clone(),
                "service_name" => self.config.service_name.clone(),
                "version" => self.config.version.clone(),
                "region" => self
                    .config
                    .region
                    .clone()
                    .unwrap_or_else(|| "global".to_string()),
                "result" => "error"
            )
            .increment(1);
            anyhow::bail!("worker registration failed: status={status}, body={body}");
        }

        counter!(
            "relayorb_worker_registry_register_total",
            "env" => self.config.env.clone(),
            "service_name" => self.config.service_name.clone(),
            "version" => self.config.version.clone(),
            "region" => self
                .config
                .region
                .clone()
                .unwrap_or_else(|| "global".to_string()),
            "result" => "ok"
        )
        .increment(1);

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
            let request_id = Uuid::new_v4().to_string();
            let trace_id = Uuid::new_v4().to_string();
            let headers = match self.registry_headers(&client, &request_id, &trace_id).await {
                Ok(headers) => headers,
                Err(err) => {
                    warn!(error = %err, "worker failed to prepare registry auth headers");
                    counter!(
                        "relayorb_worker_registry_heartbeat_total",
                        "env" => self.config.env.clone(),
                        "service_name" => self.config.service_name.clone(),
                        "version" => self.config.version.clone(),
                        "region" => self
                            .config
                            .region
                            .clone()
                            .unwrap_or_else(|| "global".to_string()),
                        "result" => "error"
                    )
                    .increment(1);
                    continue;
                }
            };
            let response = client
                .post(&url)
                .headers(headers)
                .json(&payload)
                .send()
                .await;
            match response {
                Ok(res) if res.status().is_success() => {
                    counter!(
                        "relayorb_worker_registry_heartbeat_total",
                        "env" => self.config.env.clone(),
                        "service_name" => self.config.service_name.clone(),
                        "version" => self.config.version.clone(),
                        "region" => self
                            .config
                            .region
                            .clone()
                            .unwrap_or_else(|| "global".to_string()),
                        "result" => "ok"
                    )
                    .increment(1);
                }
                Ok(res) => {
                    warn!(status = %res.status(), "worker heartbeat rejected by registry");
                    counter!(
                        "relayorb_worker_registry_heartbeat_total",
                        "env" => self.config.env.clone(),
                        "service_name" => self.config.service_name.clone(),
                        "version" => self.config.version.clone(),
                        "region" => self
                            .config
                            .region
                            .clone()
                            .unwrap_or_else(|| "global".to_string()),
                        "result" => "error"
                    )
                    .increment(1);
                    if res.status() == reqwest::StatusCode::SERVICE_UNAVAILABLE
                        || res.status() == reqwest::StatusCode::NOT_FOUND
                    {
                        match self.register_with_registry().await {
                            Ok(()) => {
                                info!("worker auto re-registered after heartbeat rejection");
                            }
                            Err(err) => {
                                warn!(error = %err, "worker auto re-registration failed");
                            }
                        }
                    }
                }
                Err(err) => {
                    warn!(error = %err, "worker heartbeat failed");
                    counter!(
                        "relayorb_worker_registry_heartbeat_total",
                        "env" => self.config.env.clone(),
                        "service_name" => self.config.service_name.clone(),
                        "version" => self.config.version.clone(),
                        "region" => self
                            .config
                            .region
                            .clone()
                            .unwrap_or_else(|| "global".to_string()),
                        "result" => "error"
                    )
                    .increment(1);
                }
            }
        }
    }

    async fn registry_headers(
        &self,
        client: &reqwest::Client,
        request_id: &str,
        trace_id: &str,
    ) -> anyhow::Result<reqwest::header::HeaderMap> {
        let mut headers = reqwest::header::HeaderMap::new();
        headers.insert(
            "x-request-id",
            reqwest::header::HeaderValue::from_str(request_id)
                .context("failed to encode x-request-id header for registry")?,
        );
        headers.insert(
            "x-trace-id",
            reqwest::header::HeaderValue::from_str(trace_id)
                .context("failed to encode x-trace-id header for registry")?,
        );
        if let Some(traceparent) = traceparent_from_trace_id(trace_id) {
            headers.insert(
                "traceparent",
                reqwest::header::HeaderValue::from_str(&traceparent)
                    .context("failed to encode traceparent header for registry")?,
            );
        }

        let Some(audience) = self.config.registry_identity_audience.as_deref() else {
            return Ok(headers);
        };

        let token = cloud_run_id_token(client, audience).await?;
        let serverless_auth = reqwest::header::HeaderValue::from_str(&format!("Bearer {token}"))
            .context("failed to construct x-serverless-authorization header for registry")?;
        headers.insert("x-serverless-authorization", serverless_auth);

        // Preserve Authorization for registry-side identity claims extraction.
        let authorization = reqwest::header::HeaderValue::from_str(&format!("Bearer {token}"))
            .context("failed to construct authorization header for registry")?;
        headers.insert(reqwest::header::AUTHORIZATION, authorization);
        Ok(headers)
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

async fn metrics(State(state): State<Arc<WorkerRuntime>>, headers: HeaderMap) -> impl IntoResponse {
    if !is_metrics_request_authorized(&state.metrics_auth, &headers) {
        return (StatusCode::UNAUTHORIZED, "unauthorized").into_response();
    }
    match render_prometheus_metrics() {
        Some(body) => (StatusCode::OK, body).into_response(),
        None => (
            StatusCode::NOT_FOUND,
            "metrics exporter disabled (set RELAYORB_METRICS_EXPORTER=prometheus)",
        )
            .into_response(),
    }
}

fn build_metrics_auth_config(env: &str) -> anyhow::Result<MetricsAuthConfig> {
    let raw_mode = std::env::var("METRICS_AUTH_MODE").unwrap_or_else(|_| {
        if env.eq_ignore_ascii_case("prod") || env.eq_ignore_ascii_case("demo") {
            "bearer".to_string()
        } else {
            "public".to_string()
        }
    });
    match raw_mode.trim().to_ascii_lowercase().as_str() {
        "public" => Ok(MetricsAuthConfig::Public),
        "bearer" => {
            let token = std::env::var("METRICS_BEARER_TOKEN")
                .context("METRICS_AUTH_MODE=bearer requires METRICS_BEARER_TOKEN")?;
            if token.trim().is_empty() {
                anyhow::bail!("METRICS_AUTH_MODE=bearer requires a non-empty METRICS_BEARER_TOKEN");
            }
            Ok(MetricsAuthConfig::Bearer { token })
        }
        other => anyhow::bail!("unsupported METRICS_AUTH_MODE '{other}'"),
    }
}

fn bearer_token(headers: &HeaderMap) -> Option<String> {
    let value = headers.get("authorization")?.to_str().ok()?;
    value
        .strip_prefix("Bearer ")
        .or_else(|| value.strip_prefix("bearer "))
        .map(ToString::to_string)
}

fn is_metrics_request_authorized(config: &MetricsAuthConfig, headers: &HeaderMap) -> bool {
    match config {
        MetricsAuthConfig::Public => true,
        MetricsAuthConfig::Bearer { token } => {
            bearer_token(headers).is_some_and(|provided| provided == *token)
        }
    }
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
    gauge!(
        "relayorb_worker_in_flight",
        "env" => state.config.env.clone(),
        "service_name" => state.config.service_name.clone(),
        "version" => state.config.version.clone(),
        "region" => state
            .config
            .region
            .clone()
            .unwrap_or_else(|| "global".to_string()),
        "capability_id" => capability_id.clone()
    )
    .set(state.stats.snapshot().in_flight.unwrap_or(0) as f64);
    let started = Instant::now();
    let result = handler.handle(request.payload).await;
    let elapsed = started.elapsed().as_secs_f64() * 1000.0;

    let response_payload = match result {
        Ok(payload) => {
            state.stats.on_finish(elapsed, false);
            gauge!(
                "relayorb_worker_in_flight",
                "env" => state.config.env.clone(),
                "service_name" => state.config.service_name.clone(),
                "version" => state.config.version.clone(),
                "region" => state
                    .config
                    .region
                    .clone()
                    .unwrap_or_else(|| "global".to_string()),
                "capability_id" => capability_id.clone()
            )
            .set(state.stats.snapshot().in_flight.unwrap_or(0) as f64);
            payload
        }
        Err(err) => {
            state.stats.on_finish(elapsed, true);
            gauge!(
                "relayorb_worker_in_flight",
                "env" => state.config.env.clone(),
                "service_name" => state.config.service_name.clone(),
                "version" => state.config.version.clone(),
                "region" => state
                    .config
                    .region
                    .clone()
                    .unwrap_or_else(|| "global".to_string()),
                "capability_id" => capability_id.clone()
            )
            .set(state.stats.snapshot().in_flight.unwrap_or(0) as f64);
            counter!(
                "relayorb_worker_invoke_requests_total",
                "env" => state.config.env.clone(),
                "service_name" => state.config.service_name.clone(),
                "version" => state.config.version.clone(),
                "region" => state
                    .config
                    .region
                    .clone()
                    .unwrap_or_else(|| "global".to_string()),
                "capability_id" => capability_id.clone(),
                "result" => error_result_label(err.code),
                "error_code" => error_code_label(err.code)
            )
            .increment(1);
            histogram!(
                "relayorb_worker_invoke_latency_ms",
                "env" => state.config.env.clone(),
                "service_name" => state.config.service_name.clone(),
                "version" => state.config.version.clone(),
                "region" => state
                    .config
                    .region
                    .clone()
                    .unwrap_or_else(|| "global".to_string()),
                "capability_id" => capability_id.clone(),
                "result" => error_result_label(err.code),
                "error_code" => error_code_label(err.code)
            )
            .record(elapsed);
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

    counter!(
        "relayorb_worker_invoke_requests_total",
        "env" => state.config.env.clone(),
        "service_name" => state.config.service_name.clone(),
        "version" => state.config.version.clone(),
        "region" => state
            .config
            .region
            .clone()
            .unwrap_or_else(|| "global".to_string()),
        "capability_id" => capability_id.clone(),
        "result" => "ok"
    )
    .increment(1);
    histogram!(
        "relayorb_worker_invoke_latency_ms",
        "env" => state.config.env.clone(),
        "service_name" => state.config.service_name.clone(),
        "version" => state.config.version.clone(),
        "region" => state
            .config
            .region
            .clone()
            .unwrap_or_else(|| "global".to_string()),
        "capability_id" => capability_id.clone(),
        "result" => "ok"
    )
    .record(elapsed);
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
        .or_else(|| {
            header_value(headers, "traceparent").and_then(|value| trace_id_from_traceparent(&value))
        })
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
    let labels = metric_context();
    counter!(
        "relayorb_worker_request_errors_total",
        "env" => labels.env,
        "service_name" => labels.service_name,
        "version" => labels.version,
        "region" => labels.region,
        "result" => error_result_label(err.code),
        "error_code" => error_code_label(err.code)
    )
    .increment(1);
    ApiError::from_inner(meta.request_id.clone(), meta.trace_id.clone(), err)
}

fn error_code_label(code: ErrorCode) -> &'static str {
    match code {
        ErrorCode::Unauthorized => "UNAUTHORIZED",
        ErrorCode::Forbidden => "FORBIDDEN",
        ErrorCode::BudgetExceeded => "BUDGET_EXCEEDED",
        ErrorCode::CapabilityNotFound => "CAPABILITY_NOT_FOUND",
        ErrorCode::NoHealthyProviders => "NO_HEALTHY_PROVIDERS",
        ErrorCode::SchemaValidationFailed => "SCHEMA_VALIDATION_FAILED",
        ErrorCode::WorkerTimeout => "WORKER_TIMEOUT",
        ErrorCode::WorkerError => "WORKER_ERROR",
        ErrorCode::Internal => "INTERNAL",
    }
}

fn error_result_label(code: ErrorCode) -> &'static str {
    match code {
        ErrorCode::Forbidden => "forbidden",
        ErrorCode::SchemaValidationFailed => "schema_failed",
        ErrorCode::WorkerTimeout => "timeout",
        ErrorCode::NoHealthyProviders => "unavailable",
        _ => "error",
    }
}

fn init_metric_context(config: &WorkerConfig) {
    let _ = METRIC_CONTEXT.set(MetricContext {
        env: config.env.clone(),
        service_name: config.service_name.clone(),
        version: config.version.clone(),
        region: config
            .region
            .clone()
            .unwrap_or_else(|| "global".to_string()),
    });
}

fn metric_context() -> MetricContext {
    METRIC_CONTEXT
        .get()
        .cloned()
        .unwrap_or_else(|| MetricContext {
            env: std::env::var("RELAYORB_ENV").unwrap_or_else(|_| "dev".to_string()),
            service_name: std::env::var("RELAYORB_SERVICE_NAME")
                .unwrap_or_else(|_| "relayorb-worker".to_string()),
            version: std::env::var("RELAYORB_VERSION").unwrap_or_else(|_| "dev".to_string()),
            region: std::env::var("RELAYORB_REGION").unwrap_or_else(|_| "global".to_string()),
        })
}
