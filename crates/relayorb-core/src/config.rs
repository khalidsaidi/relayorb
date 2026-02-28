use anyhow::Context;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BaseSettings {
    #[serde(default = "default_env")]
    pub relayorb_env: String,
    pub relayorb_region: Option<String>,
    #[serde(default = "default_registry_url")]
    pub registry_url: String,
    #[serde(default = "default_database_url")]
    pub database_url: String,
    #[serde(default = "default_auth_mode")]
    pub auth_mode: String,
    #[serde(default)]
    pub allow_hmac_in_prod: bool,
    pub secret_auth_hmac: Option<String>,
    pub oidc_issuer: Option<String>,
    pub oidc_audience: Option<String>,
    pub jwks_url: Option<String>,
    // Backward-compat alias. Prefer jwks_url / JWKS_URL.
    pub jwt_public_keys_url: Option<String>,
    #[serde(default = "default_auth_clock_skew_seconds")]
    pub auth_clock_skew_seconds: u64,
    #[serde(default = "default_jwks_refresh_interval_seconds")]
    pub jwks_refresh_interval_seconds: u64,
    pub otel_exporter_otlp_endpoint: Option<String>,
    #[serde(default = "default_policy_path")]
    pub policy_path: String,
    #[serde(default = "default_service_name")]
    pub relayorb_service_name: String,
}

pub fn load_base_settings() -> anyhow::Result<BaseSettings> {
    let cfg = config::Config::builder()
        .add_source(config::File::with_name("config/dev").required(false))
        .build()
        .context("failed to load config/dev.toml")?;

    let mut settings: BaseSettings = cfg
        .try_deserialize()
        .context("failed to deserialize base settings")?;

    if let Ok(v) = std::env::var("RELAYORB_ENV") {
        settings.relayorb_env = v;
    }
    if let Ok(v) = std::env::var("RELAYORB_REGION") {
        settings.relayorb_region = Some(v);
    }
    if let Ok(v) = std::env::var("REGISTRY_URL") {
        settings.registry_url = v;
    }
    if let Ok(v) = std::env::var("DATABASE_URL") {
        settings.database_url = v;
    }
    if let Ok(v) = std::env::var("AUTH_MODE") {
        settings.auth_mode = v;
    }
    if let Ok(v) = std::env::var("ALLOW_HMAC_IN_PROD") {
        settings.allow_hmac_in_prod = matches!(
            v.trim().to_ascii_lowercase().as_str(),
            "1" | "true" | "yes" | "on"
        );
    }
    if let Ok(v) = std::env::var("SECRET_AUTH_HMAC") {
        settings.secret_auth_hmac = Some(v);
    }
    if let Ok(v) = std::env::var("OIDC_ISSUER") {
        settings.oidc_issuer = Some(v);
    }
    if let Ok(v) = std::env::var("OIDC_AUDIENCE") {
        settings.oidc_audience = Some(v);
    }
    if let Ok(v) = std::env::var("JWKS_URL") {
        settings.jwks_url = Some(v);
    }
    if let Ok(v) = std::env::var("JWT_PUBLIC_KEYS_URL") {
        settings.jwt_public_keys_url = Some(v);
    }
    if let Ok(v) = std::env::var("AUTH_CLOCK_SKEW_SECONDS") {
        if let Ok(parsed) = v.parse::<u64>() {
            settings.auth_clock_skew_seconds = parsed;
        }
    }
    if let Ok(v) = std::env::var("JWKS_REFRESH_INTERVAL_SECONDS") {
        if let Ok(parsed) = v.parse::<u64>() {
            settings.jwks_refresh_interval_seconds = parsed;
        }
    }
    if let Ok(v) = std::env::var("OTEL_EXPORTER_OTLP_ENDPOINT") {
        settings.otel_exporter_otlp_endpoint = Some(v);
    }
    if let Ok(v) = std::env::var("POLICY_PATH") {
        settings.policy_path = v;
    }
    if let Ok(v) = std::env::var("RELAYORB_SERVICE_NAME") {
        settings.relayorb_service_name = v;
    }

    if settings.jwks_url.is_none() {
        settings.jwks_url = settings.jwt_public_keys_url.clone();
    }

    Ok(settings)
}

fn default_env() -> String {
    "dev".to_string()
}

fn default_registry_url() -> String {
    "http://127.0.0.1:8081".to_string()
}

fn default_database_url() -> String {
    "sqlite://./data/relayorb.db?mode=rwc".to_string()
}

fn default_auth_mode() -> String {
    "hmac".to_string()
}

fn default_auth_clock_skew_seconds() -> u64 {
    120
}

fn default_jwks_refresh_interval_seconds() -> u64 {
    300
}

fn default_policy_path() -> String {
    "config/policy.toml".to_string()
}

fn default_service_name() -> String {
    "relayorb-service".to_string()
}
