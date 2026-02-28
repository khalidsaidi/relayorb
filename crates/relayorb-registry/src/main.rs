use std::{collections::BTreeSet, net::SocketAddr, path::Path as FsPath, str::FromStr, sync::Arc};

use anyhow::Context;
use axum::{
    extract::{Path, Query, State},
    http::HeaderMap,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use jsonwebtoken::{
    decode, decode_header,
    jwk::{Jwk, JwkSet},
    Algorithm, DecodingKey, Validation,
};
use once_cell::sync::Lazy;
use relayorb_core::{
    canonicalize_json, init_tracing, is_valid_capability_id, load_base_settings,
    validate_json_with_schema, ApiError, CapabilityManifest, CapabilitySchemaHashes, ErrorCode,
    ProviderStats, ProviderView, RelayOrbError, RequestMeta, SuccessEnvelope,
};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::SqlitePool;
use time::OffsetDateTime;
use tokio::sync::RwLock;
use tower_http::trace::TraceLayer;
use tracing::{error, info, info_span, warn};
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
    worker_auth: WorkerAuthConfig,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HealthResponse {
    ok: bool,
    service: String,
    env: String,
    unix_time: i64,
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
    #[serde(alias = "enforce_in_prod")]
    enforce_in_prod: bool,
    #[serde(default)]
    rules: Vec<OwnershipRule>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OwnershipRule {
    #[serde(alias = "capability_prefix")]
    capability_prefix: String,
    #[serde(default)]
    env: Option<String>,
    #[serde(alias = "allowed_service_names")]
    allowed_service_names: Vec<String>,
    #[serde(default)]
    #[serde(alias = "allowed_service_accounts")]
    allowed_service_accounts: Vec<String>,
}

#[derive(Debug, Clone)]
struct WorkerIdentity {
    subject: Option<String>,
    email: Option<String>,
}

#[derive(Clone)]
enum WorkerAuthConfig {
    Disabled,
    Oidc(OidcWorkerAuthState),
}

#[derive(Clone)]
struct OidcWorkerAuthState {
    issuer: String,
    audience: String,
    clock_skew_seconds: u64,
    jwks: JwksCache,
}

#[derive(Clone)]
struct JwksCache {
    url: String,
    client: Client,
    value: Arc<RwLock<Arc<JwkSet>>>,
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
        worker_identity: Option<&WorkerIdentity>,
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
        let mut allowed_identity_bindings = BTreeSet::new();
        let mut matched_prefixes = BTreeSet::new();

        for rule in &matching_rules {
            matched_prefixes.insert(rule.capability_prefix.clone());
            for name in &rule.allowed_service_names {
                let trimmed = name.trim();
                if !trimmed.is_empty() {
                    allowed_service_names.insert(trimmed.to_string());
                }
            }
            for identity in &rule.allowed_service_accounts {
                let trimmed = identity.trim().to_ascii_lowercase();
                if !trimmed.is_empty() {
                    allowed_identity_bindings.insert(trimmed);
                }
            }
        }

        if !allowed_service_names.contains(normalized_service_name) {
            return Err(RelayOrbError::new(
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
            })));
        }

        if !allowed_identity_bindings.is_empty() {
            let identity = worker_identity.ok_or_else(|| {
                RelayOrbError::new(
                    ErrorCode::Forbidden,
                    "worker identity token is required for governed capability registration",
                )
                .with_details(json!({
                    "env": registration_env,
                    "capabilityId": capability_id,
                    "serviceName": normalized_service_name,
                    "matchedPrefixes": matched_prefixes,
                }))
            })?;

            if !identity.matches_any(&allowed_identity_bindings) {
                return Err(RelayOrbError::new(
                    ErrorCode::Forbidden,
                    format!(
                        "worker identity is not allowed to register capability '{}' in env '{}'",
                        capability_id, registration_env
                    ),
                )
                .with_details(json!({
                    "env": registration_env,
                    "capabilityId": capability_id,
                    "serviceName": normalized_service_name,
                    "workerSubject": identity.subject,
                    "workerEmail": identity.email,
                    "allowedServiceAccounts": allowed_identity_bindings,
                    "matchedPrefixes": matched_prefixes,
                })));
            }
        }

        Ok(())
    }

    fn requires_identity_binding(
        &self,
        registration_env: &str,
        capabilities: &[CapabilityManifest],
    ) -> bool {
        if !self.enforce_for_env(registration_env) {
            return false;
        }

        capabilities.iter().any(|capability| {
            self.rules.iter().any(|rule| {
                rule.matches(registration_env, &capability.capability_id)
                    && rule.requires_identity_binding()
            })
        })
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

    fn requires_identity_binding(&self) -> bool {
        self.allowed_service_accounts
            .iter()
            .any(|entry| !entry.trim().is_empty())
    }
}

impl WorkerIdentity {
    fn matches_any(&self, allowed: &BTreeSet<String>) -> bool {
        if let Some(email) = &self.email {
            if allowed.contains(&email.to_ascii_lowercase()) {
                return true;
            }
        }

        if let Some(subject) = &self.subject {
            if allowed.contains(&subject.to_ascii_lowercase()) {
                return true;
            }
        }

        false
    }
}

async fn build_worker_auth_config() -> anyhow::Result<WorkerAuthConfig> {
    let mode = std::env::var("REGISTRY_WORKER_AUTH_MODE")
        .unwrap_or_else(|_| "disabled".to_string())
        .trim()
        .to_ascii_lowercase();

    match mode.as_str() {
        "disabled" => Ok(WorkerAuthConfig::Disabled),
        "oidc" => {
            let issuer = std::env::var("REGISTRY_WORKER_OIDC_ISSUER")
                .unwrap_or_else(|_| "https://accounts.google.com".to_string());
            let audience = std::env::var("REGISTRY_WORKER_OIDC_AUDIENCE")
                .context("REGISTRY_WORKER_AUTH_MODE=oidc requires REGISTRY_WORKER_OIDC_AUDIENCE")?;
            let jwks_url = std::env::var("REGISTRY_WORKER_JWKS_URL")
                .unwrap_or_else(|_| "https://www.googleapis.com/oauth2/v3/certs".to_string());
            let clock_skew_seconds = std::env::var("REGISTRY_WORKER_AUTH_CLOCK_SKEW_SECONDS")
                .ok()
                .and_then(|value| value.parse::<u64>().ok())
                .unwrap_or(120);
            let client = Client::new();
            let jwks = JwksCache::new(jwks_url, client).await?;
            Ok(WorkerAuthConfig::Oidc(OidcWorkerAuthState {
                issuer,
                audience,
                clock_skew_seconds,
                jwks,
            }))
        }
        _ => anyhow::bail!("unsupported REGISTRY_WORKER_AUTH_MODE '{mode}'"),
    }
}

fn spawn_jwks_refresh(oidc: OidcWorkerAuthState, refresh_seconds: u64) {
    let interval = refresh_seconds.max(30);
    tokio::spawn(async move {
        let mut ticker = tokio::time::interval(std::time::Duration::from_secs(interval));
        loop {
            ticker.tick().await;
            if let Err(err) = oidc.jwks.refresh().await {
                warn!(error = %err, "registry worker JWKS refresh failed");
            }
        }
    });
}

impl JwksCache {
    async fn new(url: String, client: Client) -> anyhow::Result<Self> {
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

async fn authenticate_worker_identity(
    auth: &WorkerAuthConfig,
    headers: &HeaderMap,
) -> Result<WorkerIdentity, RelayOrbError> {
    match auth {
        WorkerAuthConfig::Disabled => Err(RelayOrbError::new(
            ErrorCode::Forbidden,
            "worker identity verification is disabled on registry",
        )),
        WorkerAuthConfig::Oidc(oidc) => {
            let token = bearer_token(headers).ok_or_else(|| {
                RelayOrbError::new(ErrorCode::Unauthorized, "missing bearer token")
            })?;
            verify_worker_oidc_jwt(&token, oidc).await
        }
    }
}

async fn verify_worker_oidc_jwt(
    token: &str,
    oidc: &OidcWorkerAuthState,
) -> Result<WorkerIdentity, RelayOrbError> {
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
                .with_details(json!({ "error": err.to_string() }))
        })?;
        jwk = oidc.jwks.find_key(&kid).await;
    }

    let jwk = jwk.ok_or_else(|| {
        RelayOrbError::new(
            ErrorCode::Unauthorized,
            "JWT kid not found in JWKS after refresh",
        )
    })?;

    verify_worker_jwt_with_jwk(token, &jwk, oidc, header.alg)
}

fn verify_worker_jwt_with_jwk(
    token: &str,
    jwk: &Jwk,
    oidc: &OidcWorkerAuthState,
    algorithm: Algorithm,
) -> Result<WorkerIdentity, RelayOrbError> {
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

    Ok(WorkerIdentity {
        subject: claim_string(&claims, "sub"),
        email: claim_string(&claims, "email"),
    })
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

fn claim_string(claims: &Value, key: &str) -> Option<String> {
    claims
        .get(key)
        .and_then(Value::as_str)
        .map(ToString::to_string)
}

fn bearer_token(headers: &HeaderMap) -> Option<String> {
    let value = headers.get("authorization")?.to_str().ok()?;
    value
        .strip_prefix("Bearer ")
        .or_else(|| value.strip_prefix("bearer "))
        .map(ToString::to_string)
}

async fn fetch_jwks(client: &Client, url: &str) -> anyhow::Result<JwkSet> {
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
    let worker_auth = build_worker_auth_config().await?;
    let jwks_refresh_interval_seconds =
        std::env::var("REGISTRY_WORKER_JWKS_REFRESH_INTERVAL_SECONDS")
            .ok()
            .and_then(|value| value.parse::<u64>().ok())
            .unwrap_or(300);

    if let WorkerAuthConfig::Oidc(oidc) = worker_auth.clone() {
        spawn_jwks_refresh(oidc, jwks_refresh_interval_seconds);
    }

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
        worker_auth,
    });

    let router = Router::new()
        .route("/health", get(health))
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
        workerAuthMode = %match &state.worker_auth {
            WorkerAuthConfig::Disabled => "disabled",
            WorkerAuthConfig::Oidc(_) => "oidc",
        },
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
    let worker_identity = if state
        .ownership_policy
        .requires_identity_binding(&registration_env, &request.capabilities)
    {
        Some(
            authenticate_worker_identity(&state.worker_auth, &headers)
                .await
                .map_err(|err| api_error(&meta, err))?,
        )
    } else {
        None
    };

    for capability in &request.capabilities {
        state
            .ownership_policy
            .assert_registration_allowed(
                &registration_env,
                request.service_name.as_deref(),
                worker_identity.as_ref(),
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

async fn health(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, ApiError> {
    let meta = request_meta(&headers, None);
    Ok(Json(SuccessEnvelope::ok(
        &meta,
        HealthResponse {
            ok: true,
            service: "relayorb-registry".to_string(),
            env: state.env.clone(),
            unix_time: OffsetDateTime::now_utc().unix_timestamp(),
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
                allowed_service_accounts: vec![
                    "relayorb-rag-sa@relayorb-prod.iam.gserviceaccount.com".to_string(),
                ],
            }],
        }
    }

    #[test]
    fn ownership_allows_matching_service_in_prod() {
        let policy = prod_policy();
        let result = policy.assert_registration_allowed(
            "prod",
            Some("relayorb-rag-prod"),
            Some(&super::WorkerIdentity {
                subject: Some("svc-subject".to_string()),
                email: Some("relayorb-rag-sa@relayorb-prod.iam.gserviceaccount.com".to_string()),
            }),
            "rag.search@v1",
        );
        assert!(result.is_ok());
    }

    #[test]
    fn ownership_rejects_non_matching_service_in_prod() {
        let policy = prod_policy();
        let err = policy
            .assert_registration_allowed(
                "prod",
                Some("relayorb-rogue-prod"),
                Some(&super::WorkerIdentity {
                    subject: Some("svc-subject".to_string()),
                    email: Some(
                        "relayorb-rag-sa@relayorb-prod.iam.gserviceaccount.com".to_string(),
                    ),
                }),
                "rag.search@v1",
            )
            .expect_err("expected forbidden error");
        assert!(err.message.contains("not allowed"));
    }

    #[test]
    fn ownership_allows_ungoverned_capability() {
        let policy = prod_policy();
        let result = policy.assert_registration_allowed(
            "prod",
            Some("relayorb-other-prod"),
            None,
            "doc.patch@v1",
        );
        assert!(result.is_ok());
    }

    #[test]
    fn ownership_not_enforced_outside_prod() {
        let policy = prod_policy();
        let result = policy.assert_registration_allowed(
            "staging",
            Some("relayorb-rogue-staging"),
            None,
            "rag.search@v1",
        );
        assert!(result.is_ok());
    }

    #[test]
    fn ownership_rejects_missing_identity_when_rule_requires_it() {
        let policy = prod_policy();
        let err = policy
            .assert_registration_allowed("prod", Some("relayorb-rag-prod"), None, "rag.search@v1")
            .expect_err("expected forbidden error");
        assert!(err.message.contains("identity token is required"));
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
