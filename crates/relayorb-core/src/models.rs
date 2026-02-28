use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

use crate::errors::ErrorCode;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RequestMeta {
    pub request_id: String,
    pub trace_id: String,
}

impl RequestMeta {
    pub fn fresh() -> Self {
        Self {
            request_id: Uuid::new_v4().to_string(),
            trace_id: Uuid::new_v4().to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SuccessEnvelope<T>
where
    T: Serialize,
{
    pub request_id: String,
    pub trace_id: String,
    pub status: String,
    pub data: T,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub meta: Option<Value>,
}

impl<T> SuccessEnvelope<T>
where
    T: Serialize,
{
    pub fn ok(meta: &RequestMeta, data: T) -> Self {
        Self {
            request_id: meta.request_id.clone(),
            trace_id: meta.trace_id.clone(),
            status: "ok".to_string(),
            data,
            meta: None,
        }
    }

    pub fn with_meta(mut self, value: Value) -> Self {
        self.meta = Some(value);
        self
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ErrorEnvelope {
    pub request_id: String,
    pub trace_id: String,
    pub status: String,
    pub error: ErrorBody,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ErrorBody {
    pub code: ErrorCode,
    pub message: String,
    pub details: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CapabilitySideEffects {
    ReadOnly,
    Mutating,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CapabilityTimeouts {
    pub timeout_ms: u64,
    pub max_retries: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CapabilityRoutingHints {
    pub strategy: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub region_affinity: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CapabilityManifest {
    pub capability_id: String,
    pub side_effects: CapabilitySideEffects,
    pub input_schema: Value,
    pub output_schema: Value,
    pub error_schema: Value,
    pub limits: CapabilityTimeouts,
    pub routing: CapabilityRoutingHints,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CapabilitySchemaHashes {
    pub input_sha256: String,
    pub output_sha256: String,
    pub error_sha256: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProviderStats {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub in_flight: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub recent_latency_ms: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub recent_error_rate: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderView {
    pub instance_id: String,
    pub base_url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub service_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub env: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub region: Option<String>,
    pub last_heartbeat: i64,
    pub ttl_seconds: i64,
    pub healthy: bool,
    pub stats: ProviderStats,
}
