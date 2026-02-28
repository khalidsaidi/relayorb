use std::{collections::BTreeSet, net::SocketAddr, path::Path as FsPath, str::FromStr, sync::Arc};

use axum::{
    extract::{Path, Query, State},
    http::HeaderMap,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use once_cell::sync::Lazy;
use relayorb_core::{
    canonicalize_json, init_tracing, is_valid_capability_id, load_base_settings,
    validate_json_with_schema, ApiError, CapabilityManifest, CapabilitySchemaHashes, ErrorCode,
    ProviderStats, ProviderView, RelayOrbError, RequestMeta, SuccessEnvelope,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::SqlitePool;
use time::OffsetDateTime;
use tower_http::trace::TraceLayer;
use tracing::{error, info, info_span};
use uuid::Uuid;

static REGISTER_SCHEMA: Lazy<Value> = Lazy::new(|| {
    json!({
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "required": ["instanceId", "baseUrl", "capabilities"],
      "properties": {
        "instanceId": {"type": "string", "minLength": 1},
        "serviceName": {"type": ["string", "null"], "minLength": 1},
        "baseUrl": {"type": "string", "format": "uri"},
        "env": {"type": ["string", "null"], "minLength": 1},
        "region": {"type": ["string", "null"]},
        "ttlSeconds": {"type": ["integer", "null"], "minimum": 5, "maximum": 600},
        "capabilities": {
          "type": "array",
          "minItems": 1,
          "items": {
            "type": "object",
            "required": ["capabilityId", "sideEffects", "inputSchema", "outputSchema", "errorSchema", "limits", "routing"]
          }
        }
      }
    })
});

static HEARTBEAT_SCHEMA: Lazy<Value> = Lazy::new(|| {
    json!({
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "required": ["instanceId"],
      "properties": {
        "instanceId": {"type": "string", "minLength": 1},
        "ttlSeconds": {"type": ["integer", "null"], "minimum": 5, "maximum": 600},
        "stats": {
          "type": ["object", "null"],
          "properties": {
            "inFlight": {"type": ["integer", "null"], "minimum": 0},
            "recentLatencyMs": {"type": ["number", "null"], "minimum": 0},
            "recentErrorRate": {"type": ["number", "null"], "minimum": 0, "maximum": 1}
          }
        }
      }
    })
});

#[derive(Clone)]
struct AppState {
    pool: SqlitePool,
    default_ttl_seconds: i64,
    env: String,
    ownership_policy: OwnershipPolicy,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RegisterRequest {
    instance_id: String,
    service_name: Option<String>,
    base_url: String,
    env: Option<String>,
    region: Option<String>,
    ttl_seconds: Option<i64>,
    capabilities: Vec<CapabilityManifest>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RegisterAck {
    acknowledged: bool,
    next_heartbeat_in_seconds: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HeartbeatRequest {
    instance_id: String,
    ttl_seconds: Option<i64>,
    stats: Option<ProviderStats>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HeartbeatAck {
    ok: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CapabilityLookupResponse {
    manifest: CapabilityManifest,
    providers: Vec<ProviderView>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DiscoverResponse {
    prefix: String,
    capabilities: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct IncludeUnhealthyQuery {
    include_unhealthy: Option<u8>,
    env: Option<String>,
}

#[derive(Debug, Deserialize)]
struct DiscoverQuery {
    prefix: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct OwnershipPolicy {
    #[serde(default)]
    enforce_in_prod: bool,
    #[serde(default)]
    rules: Vec<OwnershipRule>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OwnershipRule {
    capability_prefix: String,
    env: Option<String>,
    allowed_service_names: Vec<String>,
}

impl OwnershipPolicy {
    fn from_path(path: &str) -> anyhow::Result<Self> {
        if !FsPath::new(path).exists() {
            return Ok(Self::default());
        }

        let cfg = config::Config::builder()
            .add_source(config::File::from(FsPath::new(path)))
            .build()?;

        Ok(cfg.try_deserialize()?)
    }

    fn enforce_for_env(&self, env: &str) -> bool {
        self.enforce_in_prod && env.eq_ignore_ascii_case("prod")
    }

    fn assert_registration_allowed(
        &self,
        registration_env: &str,
        service_name: Option<&str>,
        capability_id: &str,
    ) -> Result<(), RelayOrbError> {
        if !self.enforce_for_env(registration_env) {
            return Ok(());
        }

        let matching_rules = self
            .rules
            .iter()
            .filter(|rule| rule.matches(registration_env, capability_id))
            .collect::<Vec<_>>();

        if matching_rules.is_empty() {
            return Ok(());
        }

        let normalized_service_name = service_name
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .ok_or_else(|| {
                RelayOrbError::new(
                    ErrorCode::Forbidden,
                    "serviceName is required for governed capability registration in prod",
                )
                .with_details(json!({
                    "env": registration_env,
                    "capabilityId": capability_id,
                    "matchedPrefixes": matching_rules.iter().map(|rule| rule.capability_prefix.clone()).collect::<Vec<_>>()
                }))
            })?;

        let mut allowed_service_names = BTreeSet::new();
        let mut matched_prefixes = BTreeSet::new();

        for rule in &matching_rules {
            matched_prefixes.insert(rule.capability_prefix.clone());
            for name in &rule.allowed_service_names {
                let trimmed = name.trim();
                if !trimmed.is_empty() {
                    allowed_service_names.insert(trimmed.to_string());
                }
            }
        }

        if allowed_service_names.contains(normalized_service_name) {
            return Ok(());
        }

        Err(RelayOrbError::new(
            ErrorCode::Forbidden,
            format!(
                "service '{}' is not allowed to register capability '{}' in env '{}'",
                normalized_service_name, capability_id, registration_env
            ),
        )
        .with_details(json!({
            "env": registration_env,
            "capabilityId": capability_id,
            "serviceName": normalized_service_name,
            "allowedServiceNames": allowed_service_names,
            "matchedPrefixes": matched_prefixes,
        })))
    }
}

impl OwnershipRule {
    fn matches(&self, env: &str, capability_id: &str) -> bool {
        if self.capability_prefix.is_empty() {
            return false;
        }

        let env_matches = self
            .env
            .as_deref()
            .map(|candidate| candidate == env)
            .unwrap_or(true);

        env_matches && capability_id.starts_with(&self.capability_prefix)
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let base = load_base_settings()?;
    init_tracing(
        "relayorb-registry",
        base.otel_exporter_otlp_endpoint.as_deref(),
    )?;

    let bind_addr =
        std::env::var("REGISTRY_BIND_ADDR").unwrap_or_else(|_| "0.0.0.0:8081".to_string());
    let database_url = std::env::var("DATABASE_URL").unwrap_or(base.database_url);
    let ttl_seconds = std::env::var("REGISTRY_DEFAULT_TTL_SECONDS")
        .ok()
        .and_then(|v| v.parse::<i64>().ok())
        .unwrap_or(60);
    let ownership_policy_path = std::env::var("REGISTRY_OWNERSHIP_POLICY_PATH")
        .unwrap_or_else(|_| "config/registry-ownership.toml".to_string());
    let ownership_policy = OwnershipPolicy::from_path(&ownership_policy_path)?;

    let pool = SqlitePool::connect(&database_url).await?;
    sqlx::migrate!("./migrations").run(&pool).await?;
    sqlx::query("PRAGMA foreign_keys = ON")
        .execute(&pool)
        .await
        .ok();

    let state = Arc::new(AppState {
        pool,
        default_ttl_seconds: ttl_seconds,
        env: base.relayorb_env,
        ownership_policy,
    });

    let router = Router::new()
        .route("/v1/register", post(register))
        .route("/v1/heartbeat", post(heartbeat))
        .route("/v1/capabilities/:capability_id", get(get_capability))
        .route("/v1/discover", get(discover))
        .with_state(state.clone())
        .layer(TraceLayer::new_for_http());

    let addr = SocketAddr::from_str(&bind_addr)?;
    info!(
        %addr,
        env = %state.env,
        ownershipPolicyPath = %ownership_policy_path,
        ownershipRules = state.ownership_policy.rules.len(),
        ownershipEnforceInProd = state.ownership_policy.enforce_in_prod,
        "registry listening"
    );
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, router).await?;

    Ok(())
}

async fn register(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Result<impl IntoResponse, ApiError> {
    let meta = request_meta(&headers, body.get("requestId").and_then(Value::as_str));

    validate_json_with_schema(&REGISTER_SCHEMA, &body).map_err(|errors| {
        api_error(
            &meta,
            RelayOrbError::new(
                ErrorCode::SchemaValidationFailed,
                "invalid register request",
            )
            .with_details(json!({ "errors": errors })),
        )
    })?;

    let request: RegisterRequest = serde_json::from_value(body).map_err(|err| {
        api_error(
            &meta,
            RelayOrbError::new(
                ErrorCode::SchemaValidationFailed,
                "failed to parse register request",
            )
            .with_details(json!({ "error": err.to_string() })),
        )
    })?;

    for capability in &request.capabilities {
        if !is_valid_capability_id(&capability.capability_id) {
            return Err(api_error(
                &meta,
                RelayOrbError::new(
                    ErrorCode::SchemaValidationFailed,
                    format!("invalid capability id: {}", capability.capability_id),
                ),
            ));
        }
    }

    let span = info_span!(
        "registry_register",
        requestId = %meta.request_id,
        traceId = %meta.trace_id,
        instanceId = %request.instance_id,
        env = %request.env.clone().unwrap_or_else(|| state.env.clone()),
        capabilityCount = request.capabilities.len()
    );
    let _guard = span.enter();

    let now = OffsetDateTime::now_utc().unix_timestamp();
    let ttl = request.ttl_seconds.unwrap_or(state.default_ttl_seconds);
    let registration_env = request.env.clone().unwrap_or_else(|| state.env.clone());

    for capability in &request.capabilities {
        state
            .ownership_policy
            .assert_registration_allowed(
                &registration_env,
                request.service_name.as_deref(),
                &capability.capability_id,
            )
            .map_err(|err| api_error(&meta, err))?;
    }

    let mut tx = state.pool.begin().await.map_err(|err| {
        api_error(
            &meta,
            RelayOrbError::new(ErrorCode::Internal, "failed to begin register transaction")
                .with_details(json!({ "error": err.to_string() })),
        )
    })?;

    sqlx::query(
        r#"
        INSERT INTO instances (instance_id, service_name, base_url, env, region, last_heartbeat, ttl_seconds, stats_json)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
        ON CONFLICT(instance_id)
        DO UPDATE SET service_name = excluded.service_name,
                      base_url = excluded.base_url,
                      env = excluded.env,
                      region = excluded.region,
                      last_heartbeat = excluded.last_heartbeat,
                      ttl_seconds = excluded.ttl_seconds
        "#,
    )
    .bind(&request.instance_id)
    .bind(&request.service_name)
    .bind(&request.base_url)
    .bind(&registration_env)
    .bind(&request.region)
    .bind(now)
    .bind(ttl)
    .bind("{}")
    .execute(&mut *tx)
    .await
    .map_err(|err| {
        api_error(
            &meta,
            RelayOrbError::new(ErrorCode::Internal, "failed to upsert instance")
                .with_details(json!({ "error": err.to_string() })),
        )
    })?;

    sqlx::query("DELETE FROM instance_capabilities WHERE instance_id = ?1")
        .bind(&request.instance_id)
        .execute(&mut *tx)
        .await
        .map_err(|err| {
            api_error(
                &meta,
                RelayOrbError::new(ErrorCode::Internal, "failed to clear instance capabilities")
                    .with_details(json!({ "error": err.to_string() })),
            )
        })?;

    for manifest in &request.capabilities {
        let hashes = schema_hashes(manifest).map_err(|err| {
            api_error(
                &meta,
                RelayOrbError::new(ErrorCode::Internal, "failed to canonicalize schema")
                    .with_details(json!({ "error": err.to_string() })),
            )
        })?;

        let manifest_json = serde_json::to_string(manifest).map_err(|err| {
            api_error(
                &meta,
                RelayOrbError::new(
                    ErrorCode::Internal,
                    "failed serializing capability manifest",
                )
                .with_details(json!({ "error": err.to_string() })),
            )
        })?;

        let hashes_json = serde_json::to_string(&hashes).map_err(|err| {
            api_error(
                &meta,
                RelayOrbError::new(ErrorCode::Internal, "failed serializing schema hashes")
                    .with_details(json!({ "error": err.to_string() })),
            )
        })?;

        sqlx::query(
            r#"
            INSERT INTO capabilities (capability_id, manifest_json, schema_hashes, created_at)
            VALUES (?1, ?2, ?3, ?4)
            ON CONFLICT(capability_id)
            DO UPDATE SET manifest_json = excluded.manifest_json,
                          schema_hashes = excluded.schema_hashes
            "#,
        )
        .bind(&manifest.capability_id)
        .bind(&manifest_json)
        .bind(&hashes_json)
        .bind(now)
        .execute(&mut *tx)
        .await
        .map_err(|err| {
            api_error(
                &meta,
                RelayOrbError::new(ErrorCode::Internal, "failed upserting capability")
                    .with_details(json!({ "error": err.to_string() })),
            )
        })?;

        sqlx::query(
            r#"
            INSERT INTO instance_capabilities (instance_id, capability_id)
            VALUES (?1, ?2)
            ON CONFLICT(instance_id, capability_id) DO NOTHING
            "#,
        )
        .bind(&request.instance_id)
        .bind(&manifest.capability_id)
        .execute(&mut *tx)
        .await
        .map_err(|err| {
            api_error(
                &meta,
                RelayOrbError::new(ErrorCode::Internal, "failed linking instance capability")
                    .with_details(json!({ "error": err.to_string() })),
            )
        })?;
    }

    tx.commit().await.map_err(|err| {
        api_error(
            &meta,
            RelayOrbError::new(
                ErrorCode::Internal,
                "failed committing register transaction",
            )
            .with_details(json!({ "error": err.to_string() })),
        )
    })?;

    let response = SuccessEnvelope::ok(
        &meta,
        RegisterAck {
            acknowledged: true,
            next_heartbeat_in_seconds: ttl,
        },
    );
    Ok(Json(response))
}

async fn heartbeat(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Result<impl IntoResponse, ApiError> {
    let meta = request_meta(&headers, body.get("requestId").and_then(Value::as_str));

    validate_json_with_schema(&HEARTBEAT_SCHEMA, &body).map_err(|errors| {
        api_error(
            &meta,
            RelayOrbError::new(
                ErrorCode::SchemaValidationFailed,
                "invalid heartbeat payload",
            )
            .with_details(json!({ "errors": errors })),
        )
    })?;

    let request: HeartbeatRequest = serde_json::from_value(body).map_err(|err| {
        api_error(
            &meta,
            RelayOrbError::new(
                ErrorCode::SchemaValidationFailed,
                "failed to parse heartbeat payload",
            )
            .with_details(json!({ "error": err.to_string() })),
        )
    })?;

    let now = OffsetDateTime::now_utc().unix_timestamp();
    let ttl = request.ttl_seconds.unwrap_or(state.default_ttl_seconds);
    let stats_json = serde_json::to_string(&request.stats.unwrap_or_default()).map_err(|err| {
        api_error(
            &meta,
            RelayOrbError::new(ErrorCode::Internal, "failed serializing heartbeat stats")
                .with_details(json!({ "error": err.to_string() })),
        )
    })?;

    let rows = sqlx::query(
        r#"
        UPDATE instances
        SET last_heartbeat = ?1,
            ttl_seconds = ?2,
            stats_json = ?3
        WHERE instance_id = ?4
        "#,
    )
    .bind(now)
    .bind(ttl)
    .bind(stats_json)
    .bind(&request.instance_id)
    .execute(&state.pool)
    .await
    .map_err(|err| {
        api_error(
            &meta,
            RelayOrbError::new(ErrorCode::Internal, "failed updating heartbeat")
                .with_details(json!({ "error": err.to_string() })),
        )
    })?
    .rows_affected();

    if rows == 0 {
        return Err(api_error(
            &meta,
            RelayOrbError::new(
                ErrorCode::NoHealthyProviders,
                format!("instance '{}' is not registered", request.instance_id),
            ),
        ));
    }

    Ok(Json(SuccessEnvelope::ok(&meta, HeartbeatAck { ok: true })))
}

async fn get_capability(
    State(state): State<Arc<AppState>>,
    Path(capability_id): Path<String>,
    Query(query): Query<IncludeUnhealthyQuery>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, ApiError> {
    let meta = request_meta(&headers, None);

    if !is_valid_capability_id(&capability_id) {
        return Err(api_error(
            &meta,
            RelayOrbError::new(
                ErrorCode::SchemaValidationFailed,
                format!("invalid capability id '{}'", capability_id),
            ),
        ));
    }

    let include_unhealthy = query.include_unhealthy.unwrap_or(0) == 1;
    let env = resolve_lookup_env(&state.env, query.env.as_deref()).map_err(|err| {
        api_error(
            &meta,
            err.with_details(json!({
                "registryEnv": state.env,
                "requestedEnv": query.env,
            })),
        )
    })?;
    let manifest_json: Option<String> =
        sqlx::query_scalar("SELECT manifest_json FROM capabilities WHERE capability_id = ?1")
            .bind(&capability_id)
            .fetch_optional(&state.pool)
            .await
            .map_err(|err| {
                api_error(
                    &meta,
                    RelayOrbError::new(ErrorCode::Internal, "failed querying capability")
                        .with_details(json!({ "error": err.to_string() })),
                )
            })?;

    let manifest_json = manifest_json.ok_or_else(|| {
        api_error(
            &meta,
            RelayOrbError::new(
                ErrorCode::CapabilityNotFound,
                format!("capability '{}' not found", capability_id),
            ),
        )
    })?;

    let manifest: CapabilityManifest = serde_json::from_str(&manifest_json).map_err(|err| {
        api_error(
            &meta,
            RelayOrbError::new(ErrorCode::Internal, "failed decoding manifest")
                .with_details(json!({ "error": err.to_string() })),
        )
    })?;

    let rows = sqlx::query_as::<
        _,
        (
            String,
            String,
            Option<String>,
            String,
            Option<String>,
            i64,
            i64,
            String,
        ),
    >(
        r#"
        SELECT i.instance_id, i.base_url, i.service_name, i.env, i.region, i.last_heartbeat, i.ttl_seconds, i.stats_json
        FROM instances i
        JOIN instance_capabilities ic ON ic.instance_id = i.instance_id
        WHERE ic.capability_id = ?1
          AND i.env = ?2
        "#,
    )
    .bind(&capability_id)
    .bind(&env)
    .fetch_all(&state.pool)
    .await
    .map_err(|err| {
        api_error(
            &meta,
            RelayOrbError::new(ErrorCode::Internal, "failed querying providers")
                .with_details(json!({ "error": err.to_string() })),
        )
    })?;

    let now = OffsetDateTime::now_utc().unix_timestamp();
    let providers = rows
        .into_iter()
        .filter_map(
            |(
                instance_id,
                base_url,
                service_name,
                provider_env,
                region,
                last_heartbeat,
                ttl_seconds,
                stats_json,
            )| {
                let healthy = now - last_heartbeat <= ttl_seconds;
                if healthy || include_unhealthy {
                    let stats: ProviderStats =
                        serde_json::from_str(&stats_json).unwrap_or_default();
                    Some(ProviderView {
                        instance_id,
                        base_url,
                        service_name,
                        env: Some(provider_env),
                        region,
                        last_heartbeat,
                        ttl_seconds,
                        healthy,
                        stats,
                    })
                } else {
                    None
                }
            },
        )
        .collect::<Vec<_>>();

    let response = SuccessEnvelope::ok(
        &meta,
        CapabilityLookupResponse {
            manifest,
            providers,
        },
    );

    Ok(Json(response))
}

async fn discover(
    State(state): State<Arc<AppState>>,
    Query(query): Query<DiscoverQuery>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, ApiError> {
    let meta = request_meta(&headers, None);
    let prefix = query.prefix.unwrap_or_default();

    let like_expr = format!("{}%", prefix);
    let rows = sqlx::query_scalar::<_, String>(
        "SELECT capability_id FROM capabilities WHERE capability_id LIKE ?1 ORDER BY capability_id",
    )
    .bind(like_expr)
    .fetch_all(&state.pool)
    .await
    .map_err(|err| {
        api_error(
            &meta,
            RelayOrbError::new(ErrorCode::Internal, "failed discovery query")
                .with_details(json!({ "error": err.to_string() })),
        )
    })?;

    Ok(Json(SuccessEnvelope::ok(
        &meta,
        DiscoverResponse {
            prefix,
            capabilities: rows,
        },
    )))
}

fn request_meta(headers: &HeaderMap, body_request_id: Option<&str>) -> RequestMeta {
    let request_id = body_request_id
        .map(ToString::to_string)
        .or_else(|| header_value(headers, "x-request-id"))
        .unwrap_or_else(|| Uuid::new_v4().to_string());

    let trace_id =
        header_value(headers, "x-trace-id").unwrap_or_else(|| Uuid::new_v4().to_string());

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
        "request failed"
    );
    ApiError::from_inner(meta.request_id.clone(), meta.trace_id.clone(), err)
}

fn schema_hashes(
    manifest: &CapabilityManifest,
) -> Result<CapabilitySchemaHashes, serde_json::Error> {
    let input = canonicalize_json(&manifest.input_schema)?;
    let output = canonicalize_json(&manifest.output_schema)?;
    let error = canonicalize_json(&manifest.error_schema)?;

    Ok(CapabilitySchemaHashes {
        input_sha256: input.sha256,
        output_sha256: output.sha256,
        error_sha256: error.sha256,
    })
}

fn resolve_lookup_env(
    registry_env: &str,
    requested_env: Option<&str>,
) -> Result<String, RelayOrbError> {
    let requested = requested_env
        .map(str::trim)
        .filter(|value| !value.is_empty());

    if registry_env.eq_ignore_ascii_case("prod") {
        if let Some(candidate) = requested {
            if candidate != registry_env {
                return Err(RelayOrbError::new(
                    ErrorCode::Forbidden,
                    "env override is not allowed when registry env is prod",
                ));
            }
        }
        return Ok(registry_env.to_string());
    }

    Ok(requested.unwrap_or(registry_env).to_string())
}

#[cfg(test)]
mod tests {
    use super::{resolve_lookup_env, OwnershipPolicy, OwnershipRule};

    fn prod_policy() -> OwnershipPolicy {
        OwnershipPolicy {
            enforce_in_prod: true,
            rules: vec![OwnershipRule {
                capability_prefix: "rag.".to_string(),
                env: Some("prod".to_string()),
                allowed_service_names: vec!["relayorb-rag-prod".to_string()],
            }],
        }
    }

    #[test]
    fn ownership_allows_matching_service_in_prod() {
        let policy = prod_policy();
        let result =
            policy.assert_registration_allowed("prod", Some("relayorb-rag-prod"), "rag.search@v1");
        assert!(result.is_ok());
    }

    #[test]
    fn ownership_rejects_non_matching_service_in_prod() {
        let policy = prod_policy();
        let err = policy
            .assert_registration_allowed("prod", Some("relayorb-rogue-prod"), "rag.search@v1")
            .expect_err("expected forbidden error");
        assert!(err.message.contains("not allowed"));
    }

    #[test]
    fn ownership_allows_ungoverned_capability() {
        let policy = prod_policy();
        let result =
            policy.assert_registration_allowed("prod", Some("relayorb-other-prod"), "doc.patch@v1");
        assert!(result.is_ok());
    }

    #[test]
    fn ownership_not_enforced_outside_prod() {
        let policy = prod_policy();
        let result = policy.assert_registration_allowed(
            "staging",
            Some("relayorb-rogue-staging"),
            "rag.search@v1",
        );
        assert!(result.is_ok());
    }

    #[test]
    fn lookup_env_blocks_cross_env_override_in_prod() {
        let err = resolve_lookup_env("prod", Some("dev")).expect_err("expected forbidden");
        assert!(err.message.contains("not allowed"));
    }

    #[test]
    fn lookup_env_allows_override_in_non_prod() {
        let env = resolve_lookup_env("staging", Some("dev")).expect("expected env to resolve");
        assert_eq!(env, "dev");
    }
}
