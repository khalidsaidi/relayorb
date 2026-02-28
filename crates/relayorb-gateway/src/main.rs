use std::{
    cmp::max, collections::BTreeSet, net::SocketAddr, str::FromStr, sync::Arc, time::Instant,
};

use anyhow::Context;
use axum::{
    body::Bytes,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use hmac::{Hmac, Mac};
use jsonwebtoken::{
    decode, decode_header,
    jwk::{Jwk, JwkSet},
    Algorithm, DecodingKey, Validation,
};
use metrics::{counter, gauge, histogram};
use once_cell::sync::{Lazy, OnceCell};
use relayorb_core::{
    canonicalize_json, init_metrics_exporter, init_tracing, load_base_settings,
    render_prometheus_metrics, trace_id_from_traceparent, traceparent_from_trace_id,
    validate_json_with_schema, ApiError, CapabilityManifest, ErrorCode, ErrorEnvelope,
    ProviderView, RelayOrbError, RequestMeta, SuccessEnvelope,
};
use relayorb_policy::{PolicyEngine, SqliteBudgetStore};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::Sha256;
use sqlx::SqlitePool;
use time::OffsetDateTime;
use tokio::{sync::RwLock, time::Duration};
use tower_http::trace::TraceLayer;
use tracing::{error, info, info_span};
use uuid::Uuid;

type HmacSha256 = Hmac<Sha256>;

static INVOKE_SCHEMA: Lazy<Value> = Lazy::new(|| {
    json!({
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "required": ["requestId", "caller", "capability", "payload"],
      "properties": {
        "requestId": {"type": "string", "minLength": 1},
        "caller": {
          "type": "object",
          "required": ["agentId", "role"],
          "properties": {
            "agentId": {"type": "string", "minLength": 1},
            "role": {"type": "string", "minLength": 1},
            "budgetKey": {"type": ["string", "null"]}
          },
          "additionalProperties": false
        },
        "capability": {"type": "string", "minLength": 1},
        "payload": {},
        "trace": {"type": ["object", "null"]}
      },
      "additionalProperties": false
    })
});

static BATCH_SCHEMA: Lazy<Value> = Lazy::new(|| {
    json!({
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "array",
      "minItems": 1,
      "items": INVOKE_SCHEMA.clone()
    })
});

static SUBMIT_SCHEMA: Lazy<Value> = Lazy::new(|| {
    json!({
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "required": ["requestId", "caller", "capability", "payload"],
      "properties": {
        "requestId": {"type": "string", "minLength": 1},
        "caller": {
          "type": "object",
          "required": ["agentId", "role"],
          "properties": {
            "agentId": {"type": "string", "minLength": 1},
            "role": {"type": "string", "minLength": 1},
            "budgetKey": {"type": ["string", "null"]}
          },
          "additionalProperties": false
        },
        "capability": {"type": "string", "minLength": 1},
        "payload": {},
        "trace": {"type": ["object", "null"]},
        "callbackUrl": {"type": ["string", "null"]},
        "maxRunMs": {"type": ["integer", "null"], "minimum": 1},
        "maxAttempts": {"type": ["integer", "null"], "minimum": 1, "maximum": 10}
      },
      "additionalProperties": false
    })
});

#[derive(Clone)]
struct AppState {
    env: String,
    service_name: String,
    version: String,
    region: String,
    registry_url: String,
    auth: AuthConfig,
    client: reqwest::Client,
    pool: SqlitePool,
    policy: Arc<PolicyEngine>,
    budgets: SqliteBudgetStore,
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
enum AuthConfig {
    Hmac { secret: String },
    Oidc(OidcAuthState),
}

#[derive(Clone)]
struct OidcAuthState {
    issuer: String,
    audience: String,
    clock_skew_seconds: u64,
    jwks: JwksCache,
}

#[derive(Clone)]
struct JwksCache {
    url: String,
    client: reqwest::Client,
    value: Arc<RwLock<Arc<JwkSet>>>,
}

#[derive(Debug, Clone, Default)]
struct AuthPrincipal {
    subject: Option<String>,
    agent_id: Option<String>,
    roles: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct InvokeRequest {
    request_id: String,
    caller: Caller,
    capability: String,
    payload: Value,
    trace: Option<TraceContext>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Caller {
    agent_id: String,
    role: String,
    budget_key: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TraceContext {
    parent_span_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RegistryCapabilityResponse {
    manifest: CapabilityManifest,
    providers: Vec<ProviderView>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReplayResponse {
    env: String,
    request_id: String,
    request_hash: String,
    state: String,
    trace_id: String,
    capability_id: String,
    req_canon_json: String,
    req_sha256: String,
    response_json: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error_json: Option<Value>,
    status: String,
    retries: i64,
    latency_ms: Option<i64>,
    created_at: i64,
    updated_at: i64,
}

struct InvokeHttpResult {
    status: StatusCode,
    envelope: SuccessEnvelope<Value>,
}

enum InvocationClaim {
    New,
    Completed(StoredCompletion),
    Failed(ApiError),
    InProgress(StoredInProgress),
}

struct StoredCompletion {
    trace_id: String,
    response_data: Value,
    routed_to: Option<String>,
    retries: i64,
    latency_ms: Option<i64>,
}

struct StoredInProgress {
    trace_id: String,
    retry_after_ms: u64,
}

struct WorkerExecutionResult {
    routed_to: String,
    response_data: Value,
    retries: u32,
}

struct WorkerCallData {
    data: Value,
    retries: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SubmitRequest {
    request_id: String,
    caller: Caller,
    capability: String,
    payload: Value,
    trace: Option<TraceContext>,
    callback_url: Option<String>,
    max_run_ms: Option<u64>,
    max_attempts: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SubmitResponse {
    job_id: String,
    request_id: String,
    state: String,
    status_url: String,
    attempts: i64,
    max_attempts: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct JobStatusResponse {
    job_id: String,
    request_id: String,
    capability_id: String,
    caller_agent_id: String,
    state: String,
    attempts: i64,
    max_attempts: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    trace_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    callback_url: Option<String>,
    created_at: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    started_at: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    finished_at: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<Value>,
}

#[derive(Debug, Clone)]
struct LeasedJob {
    job_id: String,
    request_id: String,
    trace_id: Option<String>,
    capability_id: String,
    caller_agent_id: String,
    caller_role: String,
    budget_key: Option<String>,
    payload_json: String,
    attempts: i64,
    max_attempts: i64,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let base = load_base_settings()?;
    init_tracing(
        "relayorb-gateway",
        base.otel_exporter_otlp_endpoint.as_deref(),
    )?;
    init_metrics_exporter()?;

    let bind_addr =
        std::env::var("GATEWAY_BIND_ADDR").unwrap_or_else(|_| "0.0.0.0:8080".to_string());
    let pool = SqlitePool::connect(&base.database_url).await?;
    sqlx::migrate!("./migrations").run(&pool).await?;

    let policy = Arc::new(PolicyEngine::from_file(&base.policy_path)?);
    let budgets = SqliteBudgetStore::new(pool.clone(), policy.budget_config().clone()).await?;
    let client = reqwest::Client::new();
    let auth = build_auth_config(&base, client.clone()).await?;

    if let AuthConfig::Oidc(oidc) = auth.clone() {
        spawn_jwks_refresh(oidc, base.jwks_refresh_interval_seconds);
    }

    let env = base.relayorb_env;
    let service_name = base.relayorb_service_name;
    let region = base.relayorb_region.unwrap_or_else(|| "global".to_string());
    let version = std::env::var("RELAYORB_VERSION").unwrap_or_else(|_| "dev".to_string());
    init_metric_context(
        env.clone(),
        service_name.clone(),
        version.clone(),
        region.clone(),
    );

    let state = Arc::new(AppState {
        env,
        service_name,
        version,
        region,
        registry_url: base.registry_url,
        auth,
        client,
        pool,
        policy,
        budgets,
    });
    spawn_job_runner(state.clone());

    let router = Router::new()
        .route("/health", get(health))
        .route("/metrics", get(metrics))
        .route("/v1/invoke", post(invoke))
        .route("/v1/submit", post(submit))
        .route("/v1/batchInvoke", post(batch_invoke))
        .route("/v1/jobs/:job_id", get(get_job))
        .route("/v1/replay/:request_id", get(replay))
        .with_state(state.clone())
        .layer(TraceLayer::new_for_http());

    let addr = SocketAddr::from_str(&bind_addr)?;
    info!(%addr, serviceName = %state.service_name, env = %state.env, "gateway listening");
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, router).await?;
    Ok(())
}

async fn health(headers: HeaderMap) -> Result<impl IntoResponse, ApiError> {
    let meta = request_meta(&headers, None, None);
    Ok(Json(SuccessEnvelope::ok(
        &meta,
        json!({
            "ok": true,
            "service": "relayorb-gateway",
            "env": std::env::var("RELAYORB_ENV").unwrap_or_else(|_| "dev".to_string())
        }),
    )))
}

async fn metrics() -> impl IntoResponse {
    match render_prometheus_metrics() {
        Some(body) => (StatusCode::OK, body).into_response(),
        None => (
            StatusCode::NOT_FOUND,
            "metrics exporter disabled (set RELAYORB_METRICS_EXPORTER=prometheus)",
        )
            .into_response(),
    }
}

async fn invoke(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<impl IntoResponse, ApiError> {
    let fallback_meta = request_meta(&headers, None, None);
    verify_auth(&state, &headers, &body, &fallback_meta).await?;

    let payload: Value = serde_json::from_slice(&body).map_err(|err| {
        api_error(
            &fallback_meta,
            RelayOrbError::new(ErrorCode::SchemaValidationFailed, "invalid JSON body")
                .with_details(json!({"error": err.to_string()})),
        )
    })?;

    validate_json_with_schema(&INVOKE_SCHEMA, &payload).map_err(|errors| {
        api_error(
            &fallback_meta,
            RelayOrbError::new(ErrorCode::SchemaValidationFailed, "invalid invoke request")
                .with_details(json!({"errors": errors})),
        )
    })?;

    let request: InvokeRequest = serde_json::from_value(payload).map_err(|err| {
        api_error(
            &fallback_meta,
            RelayOrbError::new(
                ErrorCode::SchemaValidationFailed,
                "failed parsing invoke request",
            )
            .with_details(json!({"error": err.to_string()})),
        )
    })?;

    let response = process_invoke(state, &headers, request).await?;
    Ok((response.status, Json(response.envelope)))
}

async fn submit(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<impl IntoResponse, ApiError> {
    let fallback_meta = request_meta(&headers, None, None);
    let principal = authenticate_request(&state, &headers, &body, &fallback_meta).await?;

    let payload: Value = serde_json::from_slice(&body).map_err(|err| {
        api_error(
            &fallback_meta,
            RelayOrbError::new(ErrorCode::SchemaValidationFailed, "invalid JSON body")
                .with_details(json!({"error": err.to_string()})),
        )
    })?;

    validate_json_with_schema(&SUBMIT_SCHEMA, &payload).map_err(|errors| {
        api_error(
            &fallback_meta,
            RelayOrbError::new(ErrorCode::SchemaValidationFailed, "invalid submit request")
                .with_details(json!({"errors": errors})),
        )
    })?;

    let request: SubmitRequest = serde_json::from_value(payload).map_err(|err| {
        api_error(
            &fallback_meta,
            RelayOrbError::new(
                ErrorCode::SchemaValidationFailed,
                "failed parsing submit request",
            )
            .with_details(json!({"error": err.to_string()})),
        )
    })?;

    let meta = request_meta(&headers, Some(&request.request_id), None);
    let canonical = canonicalize_json(&json!({
        "caller": {
            "agentId": request.caller.agent_id.clone(),
            "role": request.caller.role.clone(),
            "budgetKey": request.caller.budget_key.clone()
        },
        "capability": request.capability.clone(),
        "payload": request.payload.clone(),
        "callbackUrl": request.callback_url.clone(),
        "maxRunMs": request.max_run_ms,
        "maxAttempts": request.max_attempts
    }))
    .map_err(|err| {
        api_error(
            &meta,
            RelayOrbError::new(
                ErrorCode::Internal,
                "failed canonicalizing submit request payload",
            )
            .with_details(json!({"error": err.to_string()})),
        )
    })?;
    let payload_json = serde_json::to_string(&request.payload).map_err(|err| {
        api_error(
            &meta,
            RelayOrbError::new(ErrorCode::Internal, "failed serializing submit payload")
                .with_details(json!({"error": err.to_string()})),
        )
    })?;

    let now = now_ts();
    let max_attempts = request.max_attempts.unwrap_or(3).clamp(1, 10) as i64;
    let job_id = Uuid::new_v4().to_string();
    let insert = sqlx::query(
        r#"
        INSERT INTO jobs
            (env, job_id, request_id, capability_id, caller_agent_id, caller_role, created_by_subject, budget_key, payload_json, payload_canon_json, payload_hash, callback_url, max_run_ms, state, attempts, max_attempts, locked_by, locked_at, trace_id, result_json, error_json, available_at, created_at, started_at, finished_at, updated_at)
        VALUES
            (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, 'queued', 0, ?14, NULL, NULL, NULL, NULL, NULL, ?15, ?15, NULL, NULL, ?15)
        "#,
    )
    .bind(&state.env)
    .bind(&job_id)
    .bind(&request.request_id)
    .bind(&request.capability)
    .bind(&request.caller.agent_id)
    .bind(&request.caller.role)
    .bind(principal.subject.clone())
    .bind(&request.caller.budget_key)
    .bind(payload_json)
    .bind(&canonical.json)
    .bind(&canonical.sha256)
    .bind(&request.callback_url)
    .bind(request.max_run_ms.map(|v| v as i64))
    .bind(max_attempts)
    .bind(now)
    .execute(&state.pool)
    .await;

    match insert {
        Ok(_) => {
            let response = SubmitResponse {
                job_id: job_id.clone(),
                request_id: request.request_id,
                state: "queued".to_string(),
                status_url: format!("/v1/jobs/{job_id}"),
                attempts: 0,
                max_attempts,
            };

            Ok((
                StatusCode::ACCEPTED,
                Json(
                    SuccessEnvelope::ok(&meta, response)
                        .with_meta(json!({"traceId": meta.trace_id})),
                ),
            ))
        }
        Err(err) if is_unique_violation(&err) => {
            let row = sqlx::query_as::<_, (String, String, String, i64, i64)>(
                r#"
                SELECT job_id, payload_hash, state, attempts, max_attempts
                FROM jobs
                WHERE env = ?1 AND request_id = ?2
                "#,
            )
            .bind(&state.env)
            .bind(&request.request_id)
            .fetch_optional(&state.pool)
            .await
            .map_err(|read_err| {
                api_error(
                    &meta,
                    RelayOrbError::new(
                        ErrorCode::Internal,
                        "failed reading existing submit request",
                    )
                    .with_details(json!({"error": read_err.to_string()})),
                )
            })?
            .ok_or_else(|| {
                api_error(
                    &meta,
                    RelayOrbError::new(
                        ErrorCode::Internal,
                        "submit idempotency row disappeared after unique conflict",
                    ),
                )
            })?;

            if row.1 != canonical.sha256 {
                return Err(api_error(
                    &meta,
                    RelayOrbError::new(
                        ErrorCode::SchemaValidationFailed,
                        "requestId reused with a different payload",
                    )
                    .with_details(json!({
                        "requestId": request.request_id,
                        "existingRequestHash": row.1,
                        "incomingRequestHash": canonical.sha256
                    })),
                ));
            }

            let response = SubmitResponse {
                job_id: row.0.clone(),
                request_id: request.request_id,
                state: row.2,
                status_url: format!("/v1/jobs/{}", row.0),
                attempts: row.3,
                max_attempts: row.4,
            };
            Ok((
                StatusCode::OK,
                Json(
                    SuccessEnvelope::ok(&meta, response)
                        .with_meta(json!({"traceId": meta.trace_id, "replayed": true})),
                ),
            ))
        }
        Err(err) => Err(api_error(
            &meta,
            RelayOrbError::new(ErrorCode::Internal, "failed creating async job")
                .with_details(json!({"error": err.to_string()})),
        )),
    }
}

async fn get_job(
    State(state): State<Arc<AppState>>,
    Path(job_id): Path<String>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, ApiError> {
    let meta = request_meta(&headers, Some(&job_id), None);
    let principal = authenticate_request(&state, &headers, &Bytes::new(), &meta).await?;

    let row = sqlx::query_as::<
        _,
        (
            String,
            String,
            String,
            Option<String>,
            String,
            i64,
            i64,
            Option<String>,
            Option<String>,
            i64,
            Option<i64>,
            Option<i64>,
            Option<String>,
            Option<String>,
        ),
    >(
        r#"
        SELECT request_id, capability_id, caller_agent_id, created_by_subject, state, attempts, max_attempts, trace_id, callback_url, created_at, started_at, finished_at, result_json, error_json
        FROM jobs
        WHERE env = ?1 AND job_id = ?2
        "#,
    )
    .bind(&state.env)
    .bind(&job_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|err| {
        api_error(
            &meta,
            RelayOrbError::new(ErrorCode::Internal, "failed reading job status")
                .with_details(json!({"error": err.to_string()})),
        )
    })?;

    let row = row.ok_or_else(|| {
        api_error(
            &meta,
            RelayOrbError::new(
                ErrorCode::CapabilityNotFound,
                format!("job '{job_id}' not found"),
            ),
        )
    })?;

    authorize_job_read(&meta, &principal, &row.2, row.3.as_deref())?;

    let result = row
        .12
        .as_ref()
        .map(|value| serde_json::from_str(value).unwrap_or_else(|_| json!({"raw": value})));
    let error = row
        .13
        .as_ref()
        .map(|value| serde_json::from_str(value).unwrap_or_else(|_| json!({"raw": value})));
    let response = JobStatusResponse {
        job_id,
        request_id: row.0,
        capability_id: row.1,
        caller_agent_id: row.2,
        state: row.4,
        attempts: row.5,
        max_attempts: row.6,
        trace_id: row.7,
        callback_url: row.8,
        created_at: row.9,
        started_at: row.10,
        finished_at: row.11,
        result,
        error,
    };

    Ok(Json(SuccessEnvelope::ok(&meta, response)))
}

fn authorize_job_read(
    meta: &RequestMeta,
    principal: &AuthPrincipal,
    created_by_agent_id: &str,
    created_by_subject: Option<&str>,
) -> Result<(), ApiError> {
    if principal.is_admin() {
        return Ok(());
    }

    if let (Some(caller_subject), Some(job_subject)) =
        (principal.subject.as_deref(), created_by_subject)
    {
        if caller_subject == job_subject {
            return Ok(());
        }
    }

    if principal
        .agent_id
        .as_deref()
        .is_some_and(|caller_agent_id| caller_agent_id == created_by_agent_id)
    {
        return Ok(());
    }

    Err(api_error(
        meta,
        RelayOrbError::new(
            ErrorCode::Forbidden,
            "caller is not authorized to read this job",
        ),
    ))
}

async fn batch_invoke(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<impl IntoResponse, ApiError> {
    let fallback_meta = request_meta(&headers, None, None);
    verify_auth(&state, &headers, &body, &fallback_meta).await?;

    let payload: Value = serde_json::from_slice(&body).map_err(|err| {
        api_error(
            &fallback_meta,
            RelayOrbError::new(ErrorCode::SchemaValidationFailed, "invalid JSON body")
                .with_details(json!({"error": err.to_string()})),
        )
    })?;

    validate_json_with_schema(&BATCH_SCHEMA, &payload).map_err(|errors| {
        api_error(
            &fallback_meta,
            RelayOrbError::new(
                ErrorCode::SchemaValidationFailed,
                "invalid batch invoke request",
            )
            .with_details(json!({"errors": errors})),
        )
    })?;

    let requests: Vec<InvokeRequest> = serde_json::from_value(payload).map_err(|err| {
        api_error(
            &fallback_meta,
            RelayOrbError::new(
                ErrorCode::SchemaValidationFailed,
                "failed parsing batch payload",
            )
            .with_details(json!({"error": err.to_string()})),
        )
    })?;

    let mut results = Vec::with_capacity(requests.len());
    for request in requests {
        match process_invoke(state.clone(), &headers, request).await {
            Ok(result) => {
                results.push(
                    serde_json::to_value(json!({
                        "httpStatus": result.status.as_u16(),
                        "response": result.envelope
                    }))
                    .unwrap_or_else(|_| json!({"status": "error"})),
                );
            }
            Err(err) => {
                results.push(
                    serde_json::to_value(err.envelope())
                        .unwrap_or_else(|_| json!({"status": "error"})),
                );
            }
        }
    }

    let meta = RequestMeta {
        request_id: Uuid::new_v4().to_string(),
        trace_id: Uuid::new_v4().to_string(),
    };
    Ok(Json(SuccessEnvelope::ok(
        &meta,
        json!({"results": results}),
    )))
}

async fn replay(
    State(state): State<Arc<AppState>>,
    Path(request_id): Path<String>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, ApiError> {
    let meta = request_meta(&headers, Some(&request_id), None);

    let row = sqlx::query_as::<
        _,
        (
            String,
            String,
            String,
            String,
            String,
            String,
            String,
            String,
            Option<String>,
            Option<String>,
            String,
            i64,
            Option<i64>,
            i64,
            i64,
        ),
    >(
        r#"
        SELECT env, request_id, request_hash, state, trace_id, capability_id, req_canon_json, req_sha256, res_json, error_json, status, retries, latency_ms, created_at, updated_at
        FROM invocations
        WHERE env = ?1 AND request_id = ?2
        "#,
    )
    .bind(&state.env)
    .bind(&request_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|err| {
        api_error(
            &meta,
            RelayOrbError::new(ErrorCode::Internal, "failed reading invocation replay")
                .with_details(json!({"error": err.to_string()})),
        )
    })?;

    let row = row.ok_or_else(|| {
        api_error(
            &meta,
            RelayOrbError::new(
                ErrorCode::CapabilityNotFound,
                format!("request '{request_id}' not found"),
            ),
        )
    })?;

    let response_json = row
        .8
        .as_ref()
        .map(|value| serde_json::from_str(value).unwrap_or_else(|_| json!({"raw": value})));
    let error_json = row
        .9
        .as_ref()
        .map(|value| serde_json::from_str(value).unwrap_or_else(|_| json!({"raw": value})));
    let replay = ReplayResponse {
        env: row.0,
        request_id: row.1,
        request_hash: row.2,
        state: row.3,
        trace_id: row.4,
        capability_id: row.5,
        req_canon_json: row.6,
        req_sha256: row.7,
        response_json,
        error_json,
        status: row.10,
        retries: row.11,
        latency_ms: row.12,
        created_at: row.13,
        updated_at: row.14,
    };

    Ok(Json(SuccessEnvelope::ok(&meta, replay)))
}

async fn process_invoke(
    state: Arc<AppState>,
    headers: &HeaderMap,
    request: InvokeRequest,
) -> Result<InvokeHttpResult, ApiError> {
    let meta = request_meta(headers, Some(&request.request_id), None);
    let budget_key = request
        .caller
        .budget_key
        .clone()
        .unwrap_or_else(|| request.caller.agent_id.clone());
    let request_canonical = canonicalize_json(&json!({
        "caller": {
            "agentId": request.caller.agent_id.clone(),
            "role": request.caller.role.clone(),
            "budgetKey": budget_key.clone()
        },
        "capability": request.capability.clone(),
        "payload": request.payload.clone()
    }))
    .map_err(|err| {
        api_error(
            &meta,
            RelayOrbError::new(ErrorCode::Internal, "failed canonicalizing request payload")
                .with_details(json!({"error": err.to_string()})),
        )
    })?;

    let started = Instant::now();
    let span = info_span!(
        "invoke",
        requestId = %meta.request_id,
        traceId = %meta.trace_id,
        capability = %request.capability,
        agentId = %request.caller.agent_id
    );
    let _guard = span.enter();

    let claim = match claim_invocation(&state, &meta, &request, &request_canonical).await {
        Ok(claim) => claim,
        Err(err) => {
            let latency_ms = started.elapsed().as_secs_f64() * 1000.0;
            record_invoke_error(&request.capability, err.inner.code, latency_ms);
            return Err(err);
        }
    };

    match claim {
        InvocationClaim::Completed(stored) => {
            let latency_ms = started.elapsed().as_secs_f64() * 1000.0;
            let labels = metric_context();
            counter!(
                "relayorb_gateway_idempotency_replays_total",
                "state" => "completed",
                "env" => labels.env,
                "service_name" => labels.service_name,
                "version" => labels.version,
                "region" => labels.region
            )
            .increment(1);
            record_invoke_success(&request.capability, "replayed", latency_ms);
            let envelope = SuccessEnvelope::ok(&meta, stored.response_data).with_meta(json!({
                "routedTo": stored.routed_to,
                "latencyMs": stored.latency_ms,
                "retries": stored.retries,
                "traceId": stored.trace_id,
                "replayed": true
            }));
            return Ok(InvokeHttpResult {
                status: StatusCode::OK,
                envelope,
            });
        }
        InvocationClaim::Failed(err) => {
            let latency_ms = started.elapsed().as_secs_f64() * 1000.0;
            let labels = metric_context();
            counter!(
                "relayorb_gateway_idempotency_replays_total",
                "state" => "failed",
                "env" => labels.env,
                "service_name" => labels.service_name,
                "version" => labels.version,
                "region" => labels.region
            )
            .increment(1);
            record_invoke_error(&request.capability, err.inner.code, latency_ms);
            return Err(err);
        }
        InvocationClaim::InProgress(stored) => {
            let latency_ms = started.elapsed().as_secs_f64() * 1000.0;
            let labels = metric_context();
            counter!(
                "relayorb_gateway_idempotency_replays_total",
                "state" => "in_progress",
                "env" => labels.env,
                "service_name" => labels.service_name,
                "version" => labels.version,
                "region" => labels.region
            )
            .increment(1);
            record_invoke_success(&request.capability, "replayed", latency_ms);
            let envelope = SuccessEnvelope::ok(
                &meta,
                json!({
                    "state": "in_progress"
                }),
            )
            .with_meta(json!({
                "traceId": stored.trace_id,
                "retryAfterMs": stored.retry_after_ms,
                "replayed": true
            }));
            return Ok(InvokeHttpResult {
                status: StatusCode::ACCEPTED,
                envelope,
            });
        }
        InvocationClaim::New => {}
    }

    let execution = execute_new_invocation(&state, &meta, &request, &budget_key).await;
    match execution {
        Ok(execution) => {
            let elapsed_ms = started.elapsed().as_millis() as i64;
            record_invoke_success(&request.capability, "ok", elapsed_ms as f64);
            complete_invocation_success(
                &state,
                &meta,
                &request,
                &request_canonical,
                &execution,
                elapsed_ms,
            )
            .await?;

            info!(
                routedTo = %execution.routed_to,
                latencyMs = elapsed_ms,
                retries = execution.retries,
                "invoke completed"
            );

            let envelope =
                SuccessEnvelope::ok(&meta, execution.response_data.clone()).with_meta(json!({
                    "routedTo": execution.routed_to,
                    "latencyMs": elapsed_ms,
                    "retries": execution.retries,
                    "traceId": meta.trace_id
                }));
            Ok(InvokeHttpResult {
                status: StatusCode::OK,
                envelope,
            })
        }
        Err(err) => {
            let elapsed_ms = started.elapsed().as_millis() as i64;
            record_invoke_error(&request.capability, err.inner.code, elapsed_ms as f64);
            if let Err(record_err) = complete_invocation_failure(
                &state,
                &meta,
                &request,
                &request_canonical,
                &err,
                elapsed_ms,
            )
            .await
            {
                error!(
                    requestId = %meta.request_id,
                    traceId = %meta.trace_id,
                    code = ?record_err.inner.code,
                    message = %record_err.inner.message,
                    "failed to persist invocation failure state"
                );
            }
            Err(err)
        }
    }
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

fn record_invoke_success(capability: &str, result: &'static str, latency_ms: f64) {
    let labels = metric_context();
    counter!(
        "relayorb_gateway_invoke_requests_total",
        "env" => labels.env.clone(),
        "service_name" => labels.service_name.clone(),
        "version" => labels.version.clone(),
        "region" => labels.region.clone(),
        "capability_id" => capability.to_string(),
        "result" => result
    )
    .increment(1);
    histogram!(
        "relayorb_gateway_invoke_latency_ms",
        "env" => labels.env,
        "service_name" => labels.service_name,
        "version" => labels.version,
        "region" => labels.region,
        "capability_id" => capability.to_string(),
        "result" => result
    )
    .record(latency_ms);
}

fn record_invoke_error(capability: &str, code: ErrorCode, latency_ms: f64) {
    let labels = metric_context();
    let result = error_result_label(code);
    let code_label = error_code_label(code);
    counter!(
        "relayorb_gateway_invoke_requests_total",
        "env" => labels.env.clone(),
        "service_name" => labels.service_name.clone(),
        "version" => labels.version.clone(),
        "region" => labels.region.clone(),
        "capability_id" => capability.to_string(),
        "result" => result,
        "error_code" => code_label
    )
    .increment(1);
    histogram!(
        "relayorb_gateway_invoke_latency_ms",
        "env" => labels.env,
        "service_name" => labels.service_name,
        "version" => labels.version,
        "region" => labels.region,
        "capability_id" => capability.to_string(),
        "result" => result,
        "error_code" => code_label
    )
    .record(latency_ms);
}

async fn execute_new_invocation(
    state: &AppState,
    meta: &RequestMeta,
    request: &InvokeRequest,
    budget_key: &str,
) -> Result<WorkerExecutionResult, ApiError> {
    let registry = fetch_registry_capability(state, meta, &request.capability).await?;

    state
        .policy
        .authorize(
            &request.caller.role,
            &request.capability,
            &registry.manifest.side_effects,
        )
        .map_err(|err| api_error(meta, err))?;

    state
        .budgets
        .enforce(budget_key)
        .await
        .map_err(|err| api_error(meta, err))?;

    validate_json_with_schema(&registry.manifest.input_schema, &request.payload).map_err(
        |errors| {
            api_error(
                meta,
                RelayOrbError::new(
                    ErrorCode::SchemaValidationFailed,
                    "payload failed capability input schema validation",
                )
                .with_details(json!({"errors": errors})),
            )
        },
    )?;

    let provider = select_provider(&registry.providers).ok_or_else(|| {
        api_error(
            meta,
            RelayOrbError::new(
                ErrorCode::NoHealthyProviders,
                format!("no healthy providers for '{}'", request.capability),
            ),
        )
    })?;

    let routed_to = provider.base_url.clone();
    let worker_payload = json!({
        "requestId": meta.request_id,
        "traceId": meta.trace_id,
        "caller": {
            "agentId": request.caller.agent_id,
            "role": request.caller.role
        },
        "payload": request.payload
    });

    let timeout_ms = registry.manifest.limits.timeout_ms;
    let max_retries = registry.manifest.limits.max_retries;
    let worker_data = call_worker_with_retries(
        state,
        meta,
        &request.capability,
        &provider.base_url,
        &worker_payload,
        timeout_ms,
        max_retries,
    )
    .await?;

    validate_json_with_schema(&registry.manifest.output_schema, &worker_data.data).map_err(
        |errors| {
            api_error(
                meta,
                RelayOrbError::new(
                    ErrorCode::SchemaValidationFailed,
                    "worker output failed capability output schema validation",
                )
                .with_details(json!({"errors": errors})),
            )
        },
    )?;

    Ok(WorkerExecutionResult {
        routed_to,
        response_data: worker_data.data,
        retries: worker_data.retries,
    })
}

async fn fetch_registry_capability(
    state: &AppState,
    meta: &RequestMeta,
    capability: &str,
) -> Result<RegistryCapabilityResponse, ApiError> {
    let url = format!(
        "{}/v1/capabilities/{}?env={}",
        state.registry_url.trim_end_matches('/'),
        capability,
        state.env
    );

    let mut request_builder = state
        .client
        .get(url)
        .header("x-request-id", &meta.request_id)
        .header("x-trace-id", &meta.trace_id);
    if let Some(traceparent) = traceparent_from_trace_id(&meta.trace_id) {
        request_builder = request_builder.header("traceparent", traceparent);
    }

    let response = request_builder.send().await.map_err(|err| {
        api_error(
            meta,
            RelayOrbError::new(ErrorCode::Internal, "failed calling registry")
                .with_details(json!({"error": err.to_string()})),
        )
    })?;

    if response.status() == reqwest::StatusCode::NOT_FOUND {
        return Err(api_error(
            meta,
            RelayOrbError::new(
                ErrorCode::CapabilityNotFound,
                format!("capability '{}' not found in registry", capability),
            ),
        ));
    }

    let json: Value = response.json().await.map_err(|err| {
        api_error(
            meta,
            RelayOrbError::new(ErrorCode::Internal, "invalid registry response")
                .with_details(json!({"error": err.to_string()})),
        )
    })?;

    let data = json.get("data").cloned().ok_or_else(|| {
        api_error(
            meta,
            RelayOrbError::new(ErrorCode::Internal, "registry response missing data field"),
        )
    })?;

    serde_json::from_value(data).map_err(|err| {
        api_error(
            meta,
            RelayOrbError::new(
                ErrorCode::Internal,
                "failed parsing registry capability response",
            )
            .with_details(json!({"error": err.to_string()})),
        )
    })
}

fn select_provider(providers: &[ProviderView]) -> Option<ProviderView> {
    providers
        .iter()
        .filter(|provider| provider.healthy)
        .min_by(|a, b| {
            let a_latency = a.stats.recent_latency_ms.unwrap_or(f64::MAX);
            let b_latency = b.stats.recent_latency_ms.unwrap_or(f64::MAX);
            let latency_cmp = a_latency
                .partial_cmp(&b_latency)
                .unwrap_or(std::cmp::Ordering::Equal);
            if latency_cmp == std::cmp::Ordering::Equal {
                a.stats
                    .in_flight
                    .unwrap_or(u32::MAX)
                    .cmp(&b.stats.in_flight.unwrap_or(u32::MAX))
            } else {
                latency_cmp
            }
        })
        .cloned()
}

async fn claim_invocation(
    state: &AppState,
    meta: &RequestMeta,
    request: &InvokeRequest,
    canonical: &relayorb_core::CanonicalJson,
) -> Result<InvocationClaim, ApiError> {
    let now = OffsetDateTime::now_utc().unix_timestamp();
    let insert = sqlx::query(
        r#"
        INSERT INTO invocations
            (env, request_id, request_hash, state, trace_id, agent_id, capability_id, routed_to, req_canon_json, req_sha256, res_json, error_json, status, retries, latency_ms, created_at, updated_at)
        VALUES
            (?1, ?2, ?3, 'in_progress', ?4, ?5, ?6, NULL, ?7, ?8, NULL, NULL, 'in_progress', 0, NULL, ?9, ?9)
        "#,
    )
    .bind(&state.env)
    .bind(&meta.request_id)
    .bind(&canonical.sha256)
    .bind(&meta.trace_id)
    .bind(&request.caller.agent_id)
    .bind(&request.capability)
    .bind(&canonical.json)
    .bind(&canonical.sha256)
    .bind(now)
    .execute(&state.pool)
    .await;

    match insert {
        Ok(_) => Ok(InvocationClaim::New),
        Err(err) => {
            if is_unique_violation(&err) {
                load_existing_invocation_claim(state, meta, canonical).await
            } else {
                Err(api_error(
                    meta,
                    RelayOrbError::new(ErrorCode::Internal, "failed claiming invocation slot")
                        .with_details(json!({"error": err.to_string()})),
                ))
            }
        }
    }
}

fn is_unique_violation(err: &sqlx::Error) -> bool {
    matches!(err, sqlx::Error::Database(db_err) if db_err.is_unique_violation())
}

async fn load_existing_invocation_claim(
    state: &AppState,
    meta: &RequestMeta,
    canonical: &relayorb_core::CanonicalJson,
) -> Result<InvocationClaim, ApiError> {
    let row = sqlx::query_as::<
        _,
        (
            String,
            String,
            String,
            Option<String>,
            Option<String>,
            Option<String>,
            i64,
            Option<i64>,
        ),
    >(
        r#"
        SELECT request_hash, state, trace_id, res_json, error_json, routed_to, retries, latency_ms
        FROM invocations
        WHERE env = ?1 AND request_id = ?2
        "#,
    )
    .bind(&state.env)
    .bind(&meta.request_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|err| {
        api_error(
            meta,
            RelayOrbError::new(
                ErrorCode::Internal,
                "failed reading existing invocation claim",
            )
            .with_details(json!({"error": err.to_string()})),
        )
    })?
    .ok_or_else(|| {
        api_error(
            meta,
            RelayOrbError::new(ErrorCode::Internal, "existing invocation claim disappeared"),
        )
    })?;

    if row.0 != canonical.sha256 {
        return Err(api_error(
            meta,
            RelayOrbError::new(
                ErrorCode::SchemaValidationFailed,
                "requestId reused with a different payload",
            )
            .with_details(json!({
                "requestId": meta.request_id,
                "existingRequestHash": row.0,
                "incomingRequestHash": canonical.sha256
            })),
        ));
    }

    match row.1.as_str() {
        "completed" => {
            let response_json = row.3.ok_or_else(|| {
                api_error(
                    meta,
                    RelayOrbError::new(
                        ErrorCode::Internal,
                        "completed invocation missing response payload",
                    ),
                )
            })?;
            let response_data: Value = serde_json::from_str(&response_json).map_err(|err| {
                api_error(
                    meta,
                    RelayOrbError::new(
                        ErrorCode::Internal,
                        "failed parsing stored invocation response payload",
                    )
                    .with_details(json!({"error": err.to_string()})),
                )
            })?;

            Ok(InvocationClaim::Completed(StoredCompletion {
                trace_id: row.2,
                response_data,
                routed_to: row.5,
                retries: row.6,
                latency_ms: row.7,
            }))
        }
        "failed" => {
            let error_json = row.4.ok_or_else(|| {
                api_error(
                    meta,
                    RelayOrbError::new(ErrorCode::Internal, "failed invocation missing error"),
                )
            })?;
            let envelope: ErrorEnvelope = serde_json::from_str(&error_json).map_err(|err| {
                api_error(
                    meta,
                    RelayOrbError::new(
                        ErrorCode::Internal,
                        "failed parsing stored invocation error payload",
                    )
                    .with_details(json!({"error": err.to_string()})),
                )
            })?;
            Ok(InvocationClaim::Failed(api_error_from_envelope(envelope)))
        }
        "in_progress" => Ok(InvocationClaim::InProgress(StoredInProgress {
            trace_id: row.2,
            retry_after_ms: 500,
        })),
        other => Err(api_error(
            meta,
            RelayOrbError::new(
                ErrorCode::Internal,
                format!("unknown invocation state '{other}'"),
            ),
        )),
    }
}

fn api_error_from_envelope(envelope: ErrorEnvelope) -> ApiError {
    ApiError::from_inner(
        envelope.request_id,
        envelope.trace_id,
        RelayOrbError::new(envelope.error.code, envelope.error.message)
            .with_details(envelope.error.details),
    )
}

async fn complete_invocation_success(
    state: &AppState,
    meta: &RequestMeta,
    request: &InvokeRequest,
    canonical: &relayorb_core::CanonicalJson,
    execution: &WorkerExecutionResult,
    latency_ms: i64,
) -> Result<(), ApiError> {
    let response_json = serde_json::to_string(&execution.response_data).map_err(|err| {
        api_error(
            meta,
            RelayOrbError::new(
                ErrorCode::Internal,
                "failed serializing invocation response",
            )
            .with_details(json!({"error": err.to_string()})),
        )
    })?;

    let now = OffsetDateTime::now_utc().unix_timestamp();
    sqlx::query(
        r#"
        UPDATE invocations
        SET
            request_hash = ?1,
            state = 'completed',
            trace_id = ?2,
            agent_id = ?3,
            capability_id = ?4,
            routed_to = ?5,
            req_canon_json = ?6,
            req_sha256 = ?7,
            res_json = ?8,
            error_json = NULL,
            status = 'ok',
            retries = ?9,
            latency_ms = ?10,
            updated_at = ?11
        WHERE env = ?12 AND request_id = ?13
        "#,
    )
    .bind(&canonical.sha256)
    .bind(&meta.trace_id)
    .bind(&request.caller.agent_id)
    .bind(&request.capability)
    .bind(&execution.routed_to)
    .bind(&canonical.json)
    .bind(&canonical.sha256)
    .bind(response_json)
    .bind(execution.retries as i64)
    .bind(latency_ms)
    .bind(now)
    .bind(&state.env)
    .bind(&meta.request_id)
    .execute(&state.pool)
    .await
    .map_err(|err| {
        api_error(
            meta,
            RelayOrbError::new(ErrorCode::Internal, "failed finalizing invocation success")
                .with_details(json!({"error": err.to_string()})),
        )
    })?;

    Ok(())
}

async fn complete_invocation_failure(
    state: &AppState,
    meta: &RequestMeta,
    request: &InvokeRequest,
    canonical: &relayorb_core::CanonicalJson,
    err: &ApiError,
    latency_ms: i64,
) -> Result<(), ApiError> {
    let envelope = err.envelope();
    let error_json = serde_json::to_string(&envelope).map_err(|serialize_err| {
        api_error(
            meta,
            RelayOrbError::new(ErrorCode::Internal, "failed serializing invocation error")
                .with_details(json!({"error": serialize_err.to_string()})),
        )
    })?;

    let retries = err
        .inner
        .details
        .get("retriesUsed")
        .and_then(Value::as_u64)
        .unwrap_or(0) as i64;
    let routed_to = err
        .inner
        .details
        .get("routedTo")
        .and_then(Value::as_str)
        .map(ToString::to_string);
    let now = OffsetDateTime::now_utc().unix_timestamp();
    sqlx::query(
        r#"
        UPDATE invocations
        SET
            request_hash = ?1,
            state = 'failed',
            trace_id = ?2,
            agent_id = ?3,
            capability_id = ?4,
            routed_to = ?5,
            req_canon_json = ?6,
            req_sha256 = ?7,
            res_json = NULL,
            error_json = ?8,
            status = 'error',
            retries = ?9,
            latency_ms = ?10,
            updated_at = ?11
        WHERE env = ?12 AND request_id = ?13
        "#,
    )
    .bind(&canonical.sha256)
    .bind(&meta.trace_id)
    .bind(&request.caller.agent_id)
    .bind(&request.capability)
    .bind(routed_to)
    .bind(&canonical.json)
    .bind(&canonical.sha256)
    .bind(error_json)
    .bind(retries)
    .bind(latency_ms)
    .bind(now)
    .bind(&state.env)
    .bind(&meta.request_id)
    .execute(&state.pool)
    .await
    .map_err(|update_err| {
        api_error(
            meta,
            RelayOrbError::new(ErrorCode::Internal, "failed finalizing invocation failure")
                .with_details(json!({"error": update_err.to_string()})),
        )
    })?;

    Ok(())
}

async fn call_worker_with_retries(
    state: &AppState,
    meta: &RequestMeta,
    capability: &str,
    worker_base_url: &str,
    worker_payload: &Value,
    timeout_ms: u64,
    max_retries: u32,
) -> Result<WorkerCallData, ApiError> {
    let worker_url = format!(
        "{}/invoke/{}",
        worker_base_url.trim_end_matches('/'),
        capability
    );
    let mut retries_used = 0_u32;
    let mut backoff_ms = 100_u64;

    for attempt in 0..=max_retries {
        match call_worker_once(state, meta, &worker_url, worker_payload, timeout_ms).await {
            Ok(data) => {
                return Ok(WorkerCallData {
                    data,
                    retries: retries_used,
                });
            }
            Err((err, transient)) => {
                if transient && attempt < max_retries {
                    retries_used += 1;
                    counter!(
                        "relayorb_gateway_worker_retries_total",
                        "env" => state.env.clone(),
                        "service_name" => state.service_name.clone(),
                        "version" => state.version.clone(),
                        "region" => state.region.clone(),
                        "capability_id" => capability.to_string()
                    )
                    .increment(1);
                    info!(
                        requestId = %meta.request_id,
                        traceId = %meta.trace_id,
                        attempt = attempt + 1,
                        maxRetries = max_retries,
                        backoffMs = backoff_ms,
                        "retrying transient worker failure"
                    );
                    tokio::time::sleep(Duration::from_millis(backoff_ms)).await;
                    backoff_ms = (backoff_ms.saturating_mul(2)).min(2_000);
                    continue;
                }

                return Err(with_retry_context(err, retries_used, worker_base_url));
            }
        }
    }

    Err(api_error(
        meta,
        RelayOrbError::new(
            ErrorCode::Internal,
            "worker retry loop exhausted unexpectedly",
        ),
    ))
}

async fn call_worker_once(
    state: &AppState,
    meta: &RequestMeta,
    worker_url: &str,
    worker_payload: &Value,
    timeout_ms: u64,
) -> Result<Value, (ApiError, bool)> {
    let mut request_builder = state
        .client
        .post(worker_url)
        .header("x-request-id", &meta.request_id)
        .header("x-trace-id", &meta.trace_id);
    if let Some(traceparent) = traceparent_from_trace_id(&meta.trace_id) {
        request_builder = request_builder.header("traceparent", traceparent);
    }

    let worker_response = tokio::time::timeout(
        Duration::from_millis(timeout_ms),
        request_builder.json(worker_payload).send(),
    )
    .await
    .map_err(|_| {
        (
            api_error(
                meta,
                RelayOrbError::new(
                    ErrorCode::WorkerTimeout,
                    format!("worker timed out after {timeout_ms}ms"),
                )
                .with_details(json!({
                    "timeoutMs": timeout_ms
                })),
            ),
            true,
        )
    })?
    .map_err(|err| {
        (
            api_error(
                meta,
                RelayOrbError::new(ErrorCode::WorkerError, "failed to call worker")
                    .with_details(json!({"error": err.to_string()})),
            ),
            true,
        )
    })?;

    let status_code = worker_response.status();
    let bytes = worker_response.bytes().await.map_err(|err| {
        (
            api_error(
                meta,
                RelayOrbError::new(
                    ErrorCode::WorkerError,
                    "failed reading worker response body",
                )
                .with_details(json!({"error": err.to_string()})),
            ),
            true,
        )
    })?;

    let worker_json: Value = serde_json::from_slice(&bytes).unwrap_or_else(|_| {
        json!({
            "raw": String::from_utf8_lossy(&bytes).to_string()
        })
    });

    if !status_code.is_success() {
        let is_transient = status_code.is_server_error();
        return Err((
            api_error(
                meta,
                RelayOrbError::new(ErrorCode::WorkerError, "worker returned an error")
                    .with_details(json!({
                        "workerResponse": worker_json,
                        "statusCode": status_code.as_u16()
                    })),
            ),
            is_transient,
        ));
    }

    Ok(worker_json.get("data").cloned().unwrap_or(worker_json))
}

fn with_retry_context(mut err: ApiError, retries_used: u32, worker_base_url: &str) -> ApiError {
    let mut details = err.inner.details.take();
    if !details.is_object() {
        details = json!({"originalDetails": details});
    }

    if let Some(object) = details.as_object_mut() {
        object.insert("retriesUsed".to_string(), json!(retries_used));
        object
            .entry("routedTo".to_string())
            .or_insert_with(|| json!(worker_base_url));
    }
    err.inner.details = details;
    err
}

fn spawn_job_runner(state: Arc<AppState>) {
    let runner_id = format!("{}-{}", state.service_name, Uuid::new_v4());
    tokio::spawn(async move {
        loop {
            if let Err(err) = run_job_runner_tick(&state, &runner_id).await {
                error!(
                    error = %err.inner.message,
                    code = ?err.inner.code,
                    "job runner tick failed"
                );
            }
            tokio::time::sleep(Duration::from_millis(500)).await;
        }
    });
}

async fn run_job_runner_tick(state: &AppState, runner_id: &str) -> Result<(), ApiError> {
    update_queued_jobs_metric(state).await;

    let Some(job) = lease_next_job(state, runner_id).await? else {
        return Ok(());
    };

    let payload: Value = serde_json::from_str(&job.payload_json).map_err(|err| {
        ApiError::internal(
            job.request_id.clone(),
            Uuid::new_v4().to_string(),
            format!(
                "failed parsing queued payload for job '{}': {err}",
                job.job_id
            ),
        )
    })?;
    // Use an attempt-scoped internal request id so invoke-level idempotency
    // does not block transient retries for async jobs.
    let invoke_request = InvokeRequest {
        request_id: format!("{}:attempt:{}", job.request_id, job.attempts),
        caller: Caller {
            agent_id: job.caller_agent_id.clone(),
            role: job.caller_role.clone(),
            budget_key: job.budget_key.clone(),
        },
        capability: job.capability_id.clone(),
        payload,
        trace: None,
    };

    let mut headers = HeaderMap::new();
    if let Some(trace_id) = &job.trace_id {
        if let Ok(value) = trace_id.parse() {
            headers.insert("x-trace-id", value);
        }
    }
    match process_invoke(Arc::new(state.clone()), &headers, invoke_request).await {
        Ok(result) if result.status == StatusCode::OK => {
            let result_json = serde_json::to_string(&result.envelope.data).map_err(|err| {
                ApiError::internal(
                    job.request_id.clone(),
                    Uuid::new_v4().to_string(),
                    format!("failed serializing completed job result: {err}"),
                )
            })?;
            mark_job_completed(
                state,
                &job,
                &result.envelope.trace_id,
                Some(result_json),
                None,
                "succeeded",
            )
            .await?;
        }
        Ok(result) if result.status == StatusCode::ACCEPTED => {
            let transient_error = ApiError::from_inner(
                job.request_id.clone(),
                result.envelope.trace_id.clone(),
                RelayOrbError::new(
                    ErrorCode::Internal,
                    "job execution still in progress in invoke idempotency layer",
                )
                .with_details(json!({"state":"in_progress"})),
            );
            handle_job_failure(state, &job, &transient_error).await?;
        }
        Ok(result) => {
            let error = ApiError::from_inner(
                job.request_id.clone(),
                result.envelope.trace_id.clone(),
                RelayOrbError::new(
                    ErrorCode::Internal,
                    format!(
                        "unexpected invoke status while processing job: {}",
                        result.status
                    ),
                ),
            );
            handle_job_failure(state, &job, &error).await?;
        }
        Err(err) => {
            handle_job_failure(state, &job, &err).await?;
        }
    }

    update_queued_jobs_metric(state).await;
    Ok(())
}

async fn lease_next_job(state: &AppState, runner_id: &str) -> Result<Option<LeasedJob>, ApiError> {
    let now = now_ts();
    let row = sqlx::query_as::<
        _,
        (
            String,
            String,
            Option<String>,
            String,
            String,
            String,
            Option<String>,
            String,
            i64,
            i64,
        ),
    >(
        r#"
        SELECT job_id, request_id, trace_id, capability_id, caller_agent_id, caller_role, budget_key, payload_json, attempts, max_attempts
        FROM jobs
        WHERE env = ?1 AND state = 'queued' AND available_at <= ?2
        ORDER BY created_at
        LIMIT 1
        "#,
    )
    .bind(&state.env)
    .bind(now)
    .fetch_optional(&state.pool)
    .await
    .map_err(|err| {
        ApiError::internal(
            Uuid::new_v4().to_string(),
            Uuid::new_v4().to_string(),
            format!("failed selecting queued job: {err}"),
        )
    })?;

    let Some(row) = row else {
        return Ok(None);
    };

    let updated = sqlx::query(
        r#"
        UPDATE jobs
        SET
            state = 'running',
            locked_by = ?1,
            locked_at = ?2,
            attempts = attempts + 1,
            started_at = COALESCE(started_at, ?2),
            updated_at = ?2
        WHERE env = ?3 AND job_id = ?4 AND state = 'queued' AND available_at <= ?2
        "#,
    )
    .bind(runner_id)
    .bind(now)
    .bind(&state.env)
    .bind(&row.0)
    .execute(&state.pool)
    .await
    .map_err(|err| {
        ApiError::internal(
            row.1.clone(),
            Uuid::new_v4().to_string(),
            format!("failed leasing queued job '{}': {err}", row.0),
        )
    })?;

    if updated.rows_affected() == 0 {
        return Ok(None);
    }

    counter!(
        "relayorb_gateway_job_transitions_total",
        "state" => "running",
        "env" => state.env.clone(),
        "service_name" => state.service_name.clone(),
        "version" => state.version.clone(),
        "region" => state.region.clone()
    )
    .increment(1);

    Ok(Some(LeasedJob {
        job_id: row.0,
        request_id: row.1,
        trace_id: row.2,
        capability_id: row.3,
        caller_agent_id: row.4,
        caller_role: row.5,
        budget_key: row.6,
        payload_json: row.7,
        attempts: row.8 + 1,
        max_attempts: row.9,
    }))
}

async fn handle_job_failure(
    state: &AppState,
    job: &LeasedJob,
    err: &ApiError,
) -> Result<(), ApiError> {
    let envelope = err.envelope();
    let error_json = serde_json::to_string(&envelope).map_err(|serialize_err| {
        ApiError::internal(
            job.request_id.clone(),
            Uuid::new_v4().to_string(),
            format!("failed serializing job error envelope: {serialize_err}"),
        )
    })?;
    let transient = is_transient_error_code(err.inner.code);
    if transient && job.attempts < job.max_attempts {
        let now = now_ts();
        let backoff_seconds = (1_i64 << (job.attempts.saturating_sub(1) as u32)).min(30);
        sqlx::query(
            r#"
            UPDATE jobs
            SET
                state = 'queued',
                trace_id = ?1,
                error_json = ?2,
                result_json = NULL,
                locked_by = NULL,
                locked_at = NULL,
                available_at = ?3,
                updated_at = ?4
            WHERE env = ?5 AND job_id = ?6
            "#,
        )
        .bind(&envelope.trace_id)
        .bind(error_json)
        .bind(now + backoff_seconds)
        .bind(now)
        .bind(&state.env)
        .bind(&job.job_id)
        .execute(&state.pool)
        .await
        .map_err(|update_err| {
            ApiError::internal(
                job.request_id.clone(),
                Uuid::new_v4().to_string(),
                format!("failed requeueing transient job error: {update_err}"),
            )
        })?;
        counter!(
            "relayorb_gateway_job_transitions_total",
            "state" => "requeued",
            "env" => state.env.clone(),
            "service_name" => state.service_name.clone(),
            "version" => state.version.clone(),
            "region" => state.region.clone()
        )
        .increment(1);
        update_queued_jobs_metric(state).await;
        return Ok(());
    }

    mark_job_completed(
        state,
        job,
        &envelope.trace_id,
        None,
        Some(error_json),
        "failed",
    )
    .await
}

async fn mark_job_completed(
    state: &AppState,
    job: &LeasedJob,
    trace_id: &str,
    result_json: Option<String>,
    error_json: Option<String>,
    state_value: &str,
) -> Result<(), ApiError> {
    let now = now_ts();
    sqlx::query(
        r#"
        UPDATE jobs
        SET
            state = ?1,
            trace_id = ?2,
            result_json = ?3,
            error_json = ?4,
            finished_at = ?5,
            locked_by = NULL,
            locked_at = NULL,
            updated_at = ?5
        WHERE env = ?6 AND job_id = ?7
        "#,
    )
    .bind(state_value)
    .bind(trace_id)
    .bind(result_json)
    .bind(error_json)
    .bind(now)
    .bind(&state.env)
    .bind(&job.job_id)
    .execute(&state.pool)
    .await
    .map_err(|update_err| {
        ApiError::internal(
            job.request_id.clone(),
            Uuid::new_v4().to_string(),
            format!("failed finalizing async job: {update_err}"),
        )
    })?;
    counter!(
        "relayorb_gateway_job_transitions_total",
        "state" => state_value.to_string(),
        "env" => state.env.clone(),
        "service_name" => state.service_name.clone(),
        "version" => state.version.clone(),
        "region" => state.region.clone()
    )
    .increment(1);
    update_queued_jobs_metric(state).await;
    Ok(())
}

async fn update_queued_jobs_metric(state: &AppState) {
    let queued = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(*)
        FROM jobs
        WHERE env = ?1 AND state = 'queued'
        "#,
    )
    .bind(&state.env)
    .fetch_one(&state.pool)
    .await;

    if let Ok(queued) = queued {
        gauge!(
            "relayorb_gateway_jobs_queued",
            "env" => state.env.clone(),
            "service_name" => state.service_name.clone(),
            "version" => state.version.clone(),
            "region" => state.region.clone()
        )
        .set(queued as f64);
    }
}

fn is_transient_error_code(code: ErrorCode) -> bool {
    matches!(
        code,
        ErrorCode::WorkerTimeout
            | ErrorCode::WorkerError
            | ErrorCode::NoHealthyProviders
            | ErrorCode::Internal
    )
}

fn now_ts() -> i64 {
    OffsetDateTime::now_utc().unix_timestamp()
}

async fn build_auth_config(
    base: &relayorb_core::BaseSettings,
    client: reqwest::Client,
) -> anyhow::Result<AuthConfig> {
    let resolved_mode = resolve_auth_mode(base);
    if base.relayorb_env == "prod" && resolved_mode == "hmac" && !base.allow_hmac_in_prod {
        anyhow::bail!("AUTH_MODE resolved to hmac in prod, but ALLOW_HMAC_IN_PROD is not enabled");
    }

    match resolved_mode.as_str() {
        "hmac" => {
            let secret = base.secret_auth_hmac.clone().ok_or_else(|| {
                anyhow::anyhow!("AUTH_MODE=hmac requires SECRET_AUTH_HMAC to be configured")
            })?;
            Ok(AuthConfig::Hmac { secret })
        }
        "oidc" => {
            let issuer = base
                .oidc_issuer
                .clone()
                .ok_or_else(|| anyhow::anyhow!("AUTH_MODE=oidc requires OIDC_ISSUER"))?;
            let audience = base
                .oidc_audience
                .clone()
                .ok_or_else(|| anyhow::anyhow!("AUTH_MODE=oidc requires OIDC_AUDIENCE"))?;
            let jwks_url = base
                .jwks_url
                .clone()
                .ok_or_else(|| anyhow::anyhow!("AUTH_MODE=oidc requires JWKS_URL"))?;

            let jwks = JwksCache::new(jwks_url, client).await?;
            Ok(AuthConfig::Oidc(OidcAuthState {
                issuer,
                audience,
                clock_skew_seconds: base.auth_clock_skew_seconds,
                jwks,
            }))
        }
        mode => Err(anyhow::anyhow!("unsupported AUTH_MODE '{mode}'")),
    }
}

fn resolve_auth_mode(base: &relayorb_core::BaseSettings) -> String {
    let mode = base.auth_mode.trim().to_ascii_lowercase();
    if mode.is_empty() || mode == "auto" {
        if base.relayorb_env == "prod" {
            "oidc".to_string()
        } else {
            "hmac".to_string()
        }
    } else if mode == "jwt" {
        "oidc".to_string()
    } else {
        mode
    }
}

fn spawn_jwks_refresh(oidc: OidcAuthState, refresh_seconds: u64) {
    let interval = Duration::from_secs(max(refresh_seconds, 30));
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(interval).await;
            if let Err(err) = oidc.jwks.refresh().await {
                error!(error = %err, "periodic JWKS refresh failed");
            }
        }
    });
}

impl JwksCache {
    async fn new(url: String, client: reqwest::Client) -> anyhow::Result<Self> {
        let jwks = Arc::new(fetch_jwks(&client, &url).await?);
        Ok(Self {
            url,
            client,
            value: Arc::new(RwLock::new(jwks)),
        })
    }

    async fn refresh(&self) -> anyhow::Result<()> {
        let jwks = Arc::new(fetch_jwks(&self.client, &self.url).await?);
        let mut guard = self.value.write().await;
        *guard = jwks;
        Ok(())
    }

    async fn find_key(&self, kid: &str) -> Option<Jwk> {
        let guard = self.value.read().await;
        guard.find(kid).cloned()
    }
}

impl AuthPrincipal {
    fn from_hmac_headers(headers: &HeaderMap) -> Self {
        let agent_id = header_value(headers, "x-relayorb-agent-id");
        let mut roles = Vec::new();

        if let Some(role) = header_value(headers, "x-relayorb-role") {
            roles.push(role);
        }
        if let Some(raw_roles) = header_value(headers, "x-relayorb-roles") {
            roles.extend(
                raw_roles
                    .split(',')
                    .map(str::trim)
                    .filter(|role| !role.is_empty())
                    .map(ToString::to_string),
            );
        }

        Self {
            subject: None,
            agent_id,
            roles: normalize_roles(roles),
        }
    }

    fn from_oidc_claims(claims: &Value) -> Self {
        let subject = claim_string(claims, "sub");
        let agent_id = claim_string(claims, "agent_id")
            .or_else(|| claim_string(claims, "agentId"))
            .or_else(|| claim_string(claims, "email"))
            .or_else(|| subject.clone());

        let mut roles = claim_roles(claims);
        if let Some(role) = claim_string(claims, "role") {
            roles.push(role);
        }

        Self {
            subject,
            agent_id,
            roles: normalize_roles(roles),
        }
    }

    fn is_admin(&self) -> bool {
        const ADMIN_ROLES: &[&str] = &["admin", "ops", "platform-admin"];
        self.roles
            .iter()
            .any(|role| ADMIN_ROLES.contains(&role.as_str()))
    }
}

fn claim_string(claims: &Value, key: &str) -> Option<String> {
    claims
        .get(key)
        .and_then(Value::as_str)
        .map(ToString::to_string)
}

fn claim_roles(claims: &Value) -> Vec<String> {
    match claims.get("roles") {
        Some(Value::String(value)) => value
            .split(',')
            .map(str::trim)
            .filter(|role| !role.is_empty())
            .map(ToString::to_string)
            .collect(),
        Some(Value::Array(values)) => values
            .iter()
            .filter_map(Value::as_str)
            .map(ToString::to_string)
            .collect(),
        _ => Vec::new(),
    }
}

fn normalize_roles(roles: Vec<String>) -> Vec<String> {
    let mut deduped = BTreeSet::new();
    for role in roles {
        let normalized = role.trim().to_ascii_lowercase();
        if !normalized.is_empty() {
            deduped.insert(normalized);
        }
    }
    deduped.into_iter().collect()
}

async fn authenticate_request(
    state: &AppState,
    headers: &HeaderMap,
    body: &Bytes,
    meta: &RequestMeta,
) -> Result<AuthPrincipal, ApiError> {
    match &state.auth {
        AuthConfig::Hmac { secret } => {
            verify_hmac(headers, body, meta, secret)?;
            Ok(AuthPrincipal::from_hmac_headers(headers))
        }
        AuthConfig::Oidc(oidc) => {
            let token = bearer_token(headers).ok_or_else(|| {
                api_error(
                    meta,
                    RelayOrbError::new(ErrorCode::Unauthorized, "missing bearer token"),
                )
            })?;
            verify_oidc_jwt(&token, oidc)
                .await
                .map_err(|err| api_error(meta, err))
        }
    }
}

async fn verify_auth(
    state: &AppState,
    headers: &HeaderMap,
    body: &Bytes,
    meta: &RequestMeta,
) -> Result<(), ApiError> {
    authenticate_request(state, headers, body, meta)
        .await
        .map(|_| ())
}

fn bearer_token(headers: &HeaderMap) -> Option<String> {
    let value = headers.get("authorization")?.to_str().ok()?;
    value
        .strip_prefix("Bearer ")
        .or_else(|| value.strip_prefix("bearer "))
        .map(ToString::to_string)
}

fn verify_hmac(
    headers: &HeaderMap,
    body: &Bytes,
    meta: &RequestMeta,
    secret: &str,
) -> Result<(), ApiError> {
    let signature_hex = headers
        .get("x-relayorb-signature")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| {
            api_error(
                meta,
                RelayOrbError::new(ErrorCode::Unauthorized, "missing x-relayorb-signature"),
            )
        })?;

    let signature = hex::decode(signature_hex).map_err(|_| {
        api_error(
            meta,
            RelayOrbError::new(ErrorCode::Unauthorized, "invalid signature encoding"),
        )
    })?;

    let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).map_err(|_| {
        api_error(
            meta,
            RelayOrbError::new(ErrorCode::Unauthorized, "invalid HMAC secret"),
        )
    })?;
    mac.update(body);
    mac.verify_slice(&signature).map_err(|_| {
        api_error(
            meta,
            RelayOrbError::new(ErrorCode::Unauthorized, "signature verification failed"),
        )
    })
}

async fn verify_oidc_jwt(
    token: &str,
    oidc: &OidcAuthState,
) -> Result<AuthPrincipal, RelayOrbError> {
    let header = decode_header(token)
        .map_err(|_| RelayOrbError::new(ErrorCode::Unauthorized, "invalid JWT header"))?;
    if !is_supported_jwt_alg(header.alg) {
        return Err(RelayOrbError::new(
            ErrorCode::Unauthorized,
            "unsupported JWT algorithm",
        ));
    }

    let kid = header
        .kid
        .ok_or_else(|| RelayOrbError::new(ErrorCode::Unauthorized, "JWT missing kid"))?;

    let mut jwk = oidc.jwks.find_key(&kid).await;
    if jwk.is_none() {
        oidc.jwks.refresh().await.map_err(|err| {
            RelayOrbError::new(ErrorCode::Unauthorized, "failed refreshing JWKS")
                .with_details(json!({"error": err.to_string()}))
        })?;
        jwk = oidc.jwks.find_key(&kid).await;
    }

    let jwk = jwk.ok_or_else(|| {
        RelayOrbError::new(
            ErrorCode::Unauthorized,
            "JWT kid not found in JWKS after refresh",
        )
    })?;

    verify_jwt_with_jwk(token, &jwk, oidc, header.alg)
}

fn is_supported_jwt_alg(alg: Algorithm) -> bool {
    matches!(
        alg,
        Algorithm::RS256
            | Algorithm::RS384
            | Algorithm::RS512
            | Algorithm::PS256
            | Algorithm::PS384
            | Algorithm::PS512
            | Algorithm::ES256
            | Algorithm::ES384
    )
}

fn verify_jwt_with_jwk(
    token: &str,
    jwk: &Jwk,
    oidc: &OidcAuthState,
    algorithm: Algorithm,
) -> Result<AuthPrincipal, RelayOrbError> {
    let mut validation = Validation::new(algorithm);
    validation.set_issuer(std::slice::from_ref(&oidc.issuer));
    validation.set_audience(std::slice::from_ref(&oidc.audience));
    validation.leeway = oidc.clock_skew_seconds;
    validation.validate_exp = true;
    validation.validate_nbf = true;

    let decoding_key = DecodingKey::from_jwk(jwk)
        .map_err(|_| RelayOrbError::new(ErrorCode::Unauthorized, "failed to build decoding key"))?;

    let claims = decode::<Value>(token, &decoding_key, &validation)
        .map_err(|_| RelayOrbError::new(ErrorCode::Unauthorized, "JWT verification failed"))?
        .claims;
    Ok(AuthPrincipal::from_oidc_claims(&claims))
}

async fn fetch_jwks(client: &reqwest::Client, url: &str) -> anyhow::Result<JwkSet> {
    let response = client
        .get(url)
        .send()
        .await
        .with_context(|| format!("failed to fetch JWKS from {url}"))?;
    let status = response.status();
    if !status.is_success() {
        anyhow::bail!("JWKS endpoint returned non-success status: {status}");
    }

    let body = response
        .text()
        .await
        .context("failed to read JWKS response body")?;
    let jwks: JwkSet = serde_json::from_str(&body).context("failed to parse JWKS response")?;
    Ok(jwks)
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
    let result = error_result_label(err.code);
    counter!(
        "relayorb_gateway_request_errors_total",
        "env" => labels.env,
        "service_name" => labels.service_name,
        "version" => labels.version,
        "region" => labels.region,
        "result" => result,
        "error_code" => error_code_label(err.code)
    )
    .increment(1);
    error!(
        requestId = %meta.request_id,
        traceId = %meta.trace_id,
        code = ?err.code,
        message = %err.message,
        "gateway request failed"
    );
    ApiError::from_inner(meta.request_id.clone(), meta.trace_id.clone(), err)
}

fn init_metric_context(env: String, service_name: String, version: String, region: String) {
    let _ = METRIC_CONTEXT.set(MetricContext {
        env,
        service_name,
        version,
        region,
    });
}

fn metric_context() -> MetricContext {
    METRIC_CONTEXT
        .get()
        .cloned()
        .unwrap_or_else(|| MetricContext {
            env: std::env::var("RELAYORB_ENV").unwrap_or_else(|_| "dev".to_string()),
            service_name: std::env::var("RELAYORB_SERVICE_NAME")
                .unwrap_or_else(|_| "relayorb-gateway".to_string()),
            version: std::env::var("RELAYORB_VERSION").unwrap_or_else(|_| "dev".to_string()),
            region: std::env::var("RELAYORB_REGION").unwrap_or_else(|_| "global".to_string()),
        })
}
