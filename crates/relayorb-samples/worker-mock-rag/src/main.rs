use std::sync::Arc;

use anyhow::Context;
use async_trait::async_trait;
use relayorb_core::{
    init_tracing, load_base_settings, CapabilityManifest, CapabilityRoutingHints,
    CapabilitySideEffects, CapabilityTimeouts, ErrorCode, RelayOrbError,
};
use relayorb_worker_sdk::{CapabilityHandler, CapabilityRegistration, WorkerConfig, WorkerRuntime};
use serde_json::{json, Value};
use tracing::info;
use uuid::Uuid;

struct MockRagHandler;

#[async_trait]
impl CapabilityHandler for MockRagHandler {
    async fn handle(&self, payload: Value) -> Result<Value, RelayOrbError> {
        let query = payload
            .get("query")
            .and_then(Value::as_str)
            .ok_or_else(|| {
                RelayOrbError::new(
                    ErrorCode::SchemaValidationFailed,
                    "'query' must be provided as a string",
                )
            })?;

        let top_k = payload.get("topK").and_then(Value::as_u64).unwrap_or(3);
        let results = (0..top_k)
            .map(|idx| {
                json!({
                    "id": format!("doc-{}", idx + 1),
                    "text": format!("Mock match {} for query '{}'", idx + 1, query),
                    "score": (0.95_f64 - (idx as f64 * 0.05_f64)).max(0.1)
                })
            })
            .collect::<Vec<_>>();

        Ok(json!({
            "results": results,
            "provider": "relayorb-rag"
        }))
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let base = load_base_settings()?;
    init_tracing(
        "worker-mock-rag",
        base.otel_exporter_otlp_endpoint.as_deref(),
    )?;

    let bind_addr =
        std::env::var("WORKER_BIND_ADDR").unwrap_or_else(|_| "0.0.0.0:8090".to_string());
    let env = std::env::var("RELAYORB_ENV").unwrap_or_else(|_| base.relayorb_env.clone());
    let service_name =
        std::env::var("RELAYORB_SERVICE_NAME").unwrap_or_else(|_| format!("relayorb-rag-{env}"));
    let base_url = std::env::var("RELAYORB_PUBLIC_BASE_URL")
        .or_else(|_| std::env::var("WORKER_BASE_URL"))
        .unwrap_or_else(|_| "http://127.0.0.1:8090".to_string());
    let instance_id = std::env::var("WORKER_INSTANCE_ID")
        .unwrap_or_else(|_| format!("{service_name}:{}", Uuid::new_v4()));
    let region = std::env::var("RELAYORB_REGION")
        .ok()
        .or(base.relayorb_region.clone());
    let registry_url = std::env::var("REGISTRY_URL").unwrap_or(base.registry_url);
    let registry_identity_audience = std::env::var("REGISTRY_IDENTITY_AUDIENCE").ok();

    let config = WorkerConfig {
        bind_addr,
        instance_id,
        service_name,
        env,
        base_url,
        region,
        registry_url,
        registry_identity_audience,
        ttl_seconds: 60,
        heartbeat_interval_seconds: 20,
    };

    let runtime = WorkerRuntime::new(
        config,
        vec![CapabilityRegistration {
            manifest: mock_rag_manifest(),
            handler: Arc::new(MockRagHandler),
        }],
    )
    .context("failed to initialize worker runtime")?;

    info!("starting mock rag worker");
    runtime.serve().await
}

fn mock_rag_manifest() -> CapabilityManifest {
    CapabilityManifest {
        capability_id: "rag.search@v1".to_string(),
        side_effects: CapabilitySideEffects::ReadOnly,
        input_schema: json!({
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "type": "object",
            "required": ["query"],
            "properties": {
                "query": {"type": "string", "minLength": 1},
                "topK": {"type": "integer", "minimum": 1, "maximum": 10}
            },
            "additionalProperties": false
        }),
        output_schema: json!({
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "type": "object",
            "required": ["results", "provider"],
            "properties": {
                "provider": {"type": "string"},
                "results": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "required": ["id", "text", "score"],
                        "properties": {
                            "id": {"type": "string"},
                            "text": {"type": "string"},
                            "score": {"type": "number"}
                        },
                        "additionalProperties": false
                    }
                }
            },
            "additionalProperties": false
        }),
        error_schema: json!({
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "type": "object",
            "required": ["requestId", "traceId", "status", "error"],
            "properties": {
                "requestId": {"type": "string"},
                "traceId": {"type": "string"},
                "status": {"const": "error"},
                "error": {
                    "type": "object",
                    "required": ["code", "message", "details"],
                    "properties": {
                        "code": {"type": "string"},
                        "message": {"type": "string"},
                        "details": {"type": "object"}
                    }
                }
            }
        }),
        limits: CapabilityTimeouts {
            timeout_ms: 8_000,
            max_retries: 1,
        },
        routing: CapabilityRoutingHints {
            strategy: "latency".to_string(),
            region_affinity: None,
        },
    }
}
