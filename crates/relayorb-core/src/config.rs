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
    pub secret_auth_hmac: Option<String>,
    pub jwt_public_keys_url: Option<String>,
    pub otel_exporter_otlp_endpoint: Option<String>,
    #[serde(default = "default_policy_path")]
    pub policy_path: String,
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
    if let Ok(v) = std::env::var("SECRET_AUTH_HMAC") {
        settings.secret_auth_hmac = Some(v);
    }
    if let Ok(v) = std::env::var("JWT_PUBLIC_KEYS_URL") {
        settings.jwt_public_keys_url = Some(v);
    }
    if let Ok(v) = std::env::var("OTEL_EXPORTER_OTLP_ENDPOINT") {
        settings.otel_exporter_otlp_endpoint = Some(v);
    }
    if let Ok(v) = std::env::var("POLICY_PATH") {
        settings.policy_path = v;
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

fn default_policy_path() -> String {
    "config/policy.toml".to_string()
}
