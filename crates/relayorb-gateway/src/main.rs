use std::{net::SocketAddr, str::FromStr, sync::Arc, time::Instant};

use anyhow::Context;
use axum::{
    body::Bytes,
    extract::{Path, State},
    http::HeaderMap,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use hmac::{Hmac, Mac};
use jsonwebtoken::{decode, decode_header, jwk::JwkSet, Algorithm, DecodingKey, Validation};
use once_cell::sync::Lazy;
use relayorb_core::{
    canonicalize_json, init_tracing, load_base_settings, validate_json_with_schema, ApiError,
    CapabilityManifest, ErrorCode, ProviderView, RelayOrbError, RequestMeta, SuccessEnvelope,
};
use relayorb_policy::{PolicyEngine, SqliteBudgetStore};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::Sha256;
use sqlx::SqlitePool;
use time::OffsetDateTime;
use tokio::time::Duration;
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

#[derive(Clone)]
struct AppState {
    env: String,
    registry_url: String,
    hmac_secret: Option<String>,
    jwks: Option<Arc<JwkSet>>,
    client: reqwest::Client,
    pool: SqlitePool,
    policy: Arc<PolicyEngine>,
    budgets: SqliteBudgetStore,
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
    request_id: String,
    trace_id: String,
    capability_id: String,
    req_canon_json: String,
    req_sha256: String,
    response_json: Value,
    status: String,
    latency_ms: i64,
    created_at: i64,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let base = load_base_settings()?;
    init_tracing(
        "relayorb-gateway",
        base.otel_exporter_otlp_endpoint.as_deref(),
    )?;

    let bind_addr =
        std::env::var("GATEWAY_BIND_ADDR").unwrap_or_else(|_| "0.0.0.0:8080".to_string());
    let pool = SqlitePool::connect(&base.database_url).await?;
    sqlx::migrate!("./migrations").run(&pool).await?;

    let policy = Arc::new(PolicyEngine::from_file(&base.policy_path)?);
    let budgets = SqliteBudgetStore::new(pool.clone(), policy.budget_config().clone()).await?;

    let jwks = if base.relayorb_env == "prod" {
        if let Some(url) = base.jwt_public_keys_url.as_deref() {
            Some(Arc::new(fetch_jwks(url).await?))
        } else {
            None
        }
    } else {
        None
    };

    let state = Arc::new(AppState {
        env: base.relayorb_env,
        registry_url: base.registry_url,
        hmac_secret: base.secret_auth_hmac,
        jwks,
        client: reqwest::Client::new(),
        pool,
        policy,
        budgets,
    });

    let router = Router::new()
        .route("/v1/invoke", post(invoke))
        .route("/v1/batchInvoke", post(batch_invoke))
        .route("/v1/replay/:request_id", get(replay))
        .with_state(state)
        .layer(TraceLayer::new_for_http());

    let addr = SocketAddr::from_str(&bind_addr)?;
    info!(%addr, "gateway listening");
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, router).await?;
    Ok(())
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
    Ok(Json(response))
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
            Ok(envelope) => {
                results.push(
                    serde_json::to_value(envelope).unwrap_or_else(|_| json!({"status": "error"})),
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

    let row = sqlx::query_as::<_, (String, String, String, String, String, String, String, i64, i64)>(
        r#"
        SELECT request_id, trace_id, capability_id, req_canon_json, req_sha256, res_json, status, latency_ms, created_at
        FROM invocations
        WHERE request_id = ?1
        "#,
    )
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

    let response_json: Value =
        serde_json::from_str(&row.5).unwrap_or_else(|_| json!({"raw": row.5}));
    let replay = ReplayResponse {
        request_id: row.0,
        trace_id: row.1,
        capability_id: row.2,
        req_canon_json: row.3,
        req_sha256: row.4,
        response_json,
        status: row.6,
        latency_ms: row.7,
        created_at: row.8,
    };

    Ok(Json(SuccessEnvelope::ok(&meta, replay)))
}

async fn process_invoke(
    state: Arc<AppState>,
    headers: &HeaderMap,
    request: InvokeRequest,
) -> Result<SuccessEnvelope<Value>, ApiError> {
    let meta = request_meta(headers, Some(&request.request_id), None);

    let started = Instant::now();
    let span = info_span!(
        "invoke",
        requestId = %meta.request_id,
        traceId = %meta.trace_id,
        capability = %request.capability,
        agentId = %request.caller.agent_id
    );
    let _guard = span.enter();

    let registry = fetch_registry_capability(&state, &meta, &request.capability).await?;

    state
        .policy
        .authorize(
            &request.caller.role,
            &request.capability,
            &registry.manifest.side_effects,
        )
        .map_err(|err| api_error(&meta, err))?;

    let budget_key = request
        .caller
        .budget_key
        .clone()
        .unwrap_or_else(|| request.caller.agent_id.clone());
    state
        .budgets
        .enforce(&budget_key)
        .await
        .map_err(|err| api_error(&meta, err))?;

    validate_json_with_schema(&registry.manifest.input_schema, &request.payload).map_err(
        |errors| {
            api_error(
                &meta,
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
            &meta,
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
    let worker_url = format!(
        "{}/invoke/{}",
        provider.base_url.trim_end_matches('/'),
        request.capability
    );

    let worker_started = Instant::now();
    let worker_response = tokio::time::timeout(
        Duration::from_millis(timeout_ms),
        state
            .client
            .post(worker_url)
            .header("x-request-id", &meta.request_id)
            .header("x-trace-id", &meta.trace_id)
            .json(&worker_payload)
            .send(),
    )
    .await
    .map_err(|_| {
        api_error(
            &meta,
            RelayOrbError::new(
                ErrorCode::WorkerTimeout,
                format!("worker timed out after {timeout_ms}ms"),
            ),
        )
    })?
    .map_err(|err| {
        api_error(
            &meta,
            RelayOrbError::new(ErrorCode::WorkerError, "failed to call worker")
                .with_details(json!({"error": err.to_string()})),
        )
    })?;

    let status_code = worker_response.status();
    let worker_json: Value = worker_response.json().await.map_err(|err| {
        api_error(
            &meta,
            RelayOrbError::new(ErrorCode::WorkerError, "worker response was not valid JSON")
                .with_details(json!({"error": err.to_string()})),
        )
    })?;

    if !status_code.is_success() {
        return Err(api_error(
            &meta,
            RelayOrbError::new(ErrorCode::WorkerError, "worker returned an error").with_details(
                json!({"workerResponse": worker_json, "statusCode": status_code.as_u16()}),
            ),
        ));
    }

    let worker_data = worker_json
        .get("data")
        .cloned()
        .unwrap_or_else(|| worker_json.clone());

    validate_json_with_schema(&registry.manifest.output_schema, &worker_data).map_err(
        |errors| {
            api_error(
                &meta,
                RelayOrbError::new(
                    ErrorCode::SchemaValidationFailed,
                    "worker output failed capability output schema validation",
                )
                .with_details(json!({"errors": errors})),
            )
        },
    )?;

    let elapsed_ms = started.elapsed().as_millis() as i64;
    let worker_latency = worker_started.elapsed().as_millis() as i64;

    let request_canonical = canonicalize_json(&json!({
        "caller": {
            "agentId": request.caller.agent_id,
            "role": request.caller.role,
            "budgetKey": budget_key
        },
        "capability": request.capability,
        "payload": worker_payload.get("payload").cloned().unwrap_or(Value::Null)
    }))
    .map_err(|err| {
        api_error(
            &meta,
            RelayOrbError::new(ErrorCode::Internal, "failed canonicalizing request payload")
                .with_details(json!({"error": err.to_string()})),
        )
    })?;

    record_invocation(
        &state,
        &meta,
        InvocationRecord {
            canonical: &request_canonical,
            request: &request,
            routed_to: &routed_to,
            response: &worker_data,
            status: "ok",
            latency_ms: elapsed_ms,
        },
    )
    .await?;

    info!(routedTo = %routed_to, latencyMs = elapsed_ms, workerLatencyMs = worker_latency, "invoke completed");

    Ok(SuccessEnvelope::ok(&meta, worker_data).with_meta(json!({
        "routedTo": routed_to,
        "latencyMs": elapsed_ms,
        "retries": 0,
        "traceId": meta.trace_id
    })))
}

async fn fetch_registry_capability(
    state: &AppState,
    meta: &RequestMeta,
    capability: &str,
) -> Result<RegistryCapabilityResponse, ApiError> {
    let url = format!(
        "{}/v1/capabilities/{}",
        state.registry_url.trim_end_matches('/'),
        capability
    );

    let response = state.client.get(url).send().await.map_err(|err| {
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

struct InvocationRecord<'a> {
    canonical: &'a relayorb_core::CanonicalJson,
    request: &'a InvokeRequest,
    routed_to: &'a str,
    response: &'a Value,
    status: &'a str,
    latency_ms: i64,
}

async fn record_invocation(
    state: &AppState,
    meta: &RequestMeta,
    record: InvocationRecord<'_>,
) -> Result<(), ApiError> {
    let response_json = serde_json::to_string(record.response).map_err(|err| {
        api_error(
            meta,
            RelayOrbError::new(
                ErrorCode::Internal,
                "failed serializing invocation response",
            )
            .with_details(json!({"error": err.to_string()})),
        )
    })?;

    sqlx::query(
        r#"
        INSERT OR REPLACE INTO invocations
            (request_id, trace_id, agent_id, capability_id, routed_to, req_canon_json, req_sha256, res_json, status, latency_ms, created_at)
        VALUES
            (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
        "#,
    )
    .bind(&meta.request_id)
    .bind(&meta.trace_id)
    .bind(&record.request.caller.agent_id)
    .bind(&record.request.capability)
    .bind(record.routed_to)
    .bind(&record.canonical.json)
    .bind(&record.canonical.sha256)
    .bind(response_json)
    .bind(record.status)
    .bind(record.latency_ms)
    .bind(OffsetDateTime::now_utc().unix_timestamp())
    .execute(&state.pool)
    .await
    .map_err(|err| {
        api_error(
            meta,
            RelayOrbError::new(ErrorCode::Internal, "failed recording invocation")
                .with_details(json!({"error": err.to_string()})),
        )
    })?;

    Ok(())
}

async fn verify_auth(
    state: &AppState,
    headers: &HeaderMap,
    body: &Bytes,
    meta: &RequestMeta,
) -> Result<(), ApiError> {
    if state.env == "prod" {
        let token = bearer_token(headers).ok_or_else(|| {
            api_error(
                meta,
                RelayOrbError::new(ErrorCode::Unauthorized, "missing bearer token"),
            )
        })?;

        let jwks = state.jwks.clone().ok_or_else(|| {
            api_error(
                meta,
                RelayOrbError::new(ErrorCode::Unauthorized, "JWT validation not configured"),
            )
        })?;

        verify_jwt(&token, &jwks).map_err(|err| api_error(meta, err))
    } else {
        let secret = state.hmac_secret.as_ref().ok_or_else(|| {
            api_error(
                meta,
                RelayOrbError::new(ErrorCode::Unauthorized, "missing HMAC secret configuration"),
            )
        })?;

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
}

fn bearer_token(headers: &HeaderMap) -> Option<String> {
    let value = headers.get("authorization")?.to_str().ok()?;
    value
        .strip_prefix("Bearer ")
        .or_else(|| value.strip_prefix("bearer "))
        .map(ToString::to_string)
}

fn verify_jwt(token: &str, jwks: &JwkSet) -> Result<(), RelayOrbError> {
    let header = decode_header(token)
        .map_err(|_| RelayOrbError::new(ErrorCode::Unauthorized, "invalid JWT header"))?;
    let kid = header
        .kid
        .ok_or_else(|| RelayOrbError::new(ErrorCode::Unauthorized, "JWT missing kid"))?;

    let jwk = jwks
        .find(&kid)
        .ok_or_else(|| RelayOrbError::new(ErrorCode::Unauthorized, "JWT kid not found in JWKS"))?;

    let decoding_key = DecodingKey::from_jwk(jwk)
        .map_err(|_| RelayOrbError::new(ErrorCode::Unauthorized, "failed to build decoding key"))?;

    let mut validation = Validation::new(Algorithm::RS256);
    validation.validate_exp = true;

    decode::<Value>(token, &decoding_key, &validation)
        .map_err(|_| RelayOrbError::new(ErrorCode::Unauthorized, "JWT verification failed"))?;

    Ok(())
}

async fn fetch_jwks(url: &str) -> anyhow::Result<JwkSet> {
    let response = reqwest::Client::new()
        .get(url)
        .send()
        .await
        .with_context(|| format!("failed to fetch JWKS from {url}"))?;

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
    error!(
        requestId = %meta.request_id,
        traceId = %meta.trace_id,
        code = ?err.code,
        message = %err.message,
        "gateway request failed"
    );
    ApiError::from_inner(meta.request_id.clone(), meta.trace_id.clone(), err)
}
