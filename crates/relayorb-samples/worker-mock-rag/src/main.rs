use std::{sync::Arc, time::Duration};

use anyhow::{bail, Context};
use async_trait::async_trait;
use relayorb_core::{
    init_tracing, load_base_settings, CapabilityManifest, CapabilityRoutingHints,
    CapabilitySideEffects, CapabilityTimeouts, ErrorCode, RelayOrbError,
};
use relayorb_worker_sdk::{CapabilityHandler, CapabilityRegistration, WorkerConfig, WorkerRuntime};
use reqwest::Client;
use serde_json::{json, Value};
use tracing::info;
use uuid::Uuid;

const DEFAULT_WIKIPEDIA_API_BASE: &str = "https://en.wikipedia.org";
const HN_ALGOLIA_API_BASE: &str = "https://hn.algolia.com";
const OPEN_LIBRARY_API_BASE: &str = "https://openlibrary.org";

#[derive(Debug, Clone, Copy)]
enum LiveBackend {
    Wikipedia,
    HackerNews,
    OpenLibrary,
}

impl LiveBackend {
    fn parse(raw: &str) -> anyhow::Result<Self> {
        let normalized = raw.trim().to_ascii_lowercase();
        match normalized.as_str() {
            "wikipedia" | "wiki" => Ok(Self::Wikipedia),
            "hackernews" | "hn" | "algolia-hn" => Ok(Self::HackerNews),
            "openlibrary" | "open-library" | "ol" => Ok(Self::OpenLibrary),
            other => bail!("unsupported RAG_LIVE_BACKEND '{other}'"),
        }
    }

    fn as_str(&self) -> &'static str {
        match self {
            Self::Wikipedia => "wikipedia",
            Self::HackerNews => "hackernews",
            Self::OpenLibrary => "openlibrary",
        }
    }

    fn default_provider_name(&self) -> &'static str {
        match self {
            Self::Wikipedia => "wikipedia-search",
            Self::HackerNews => "hackernews-search",
            Self::OpenLibrary => "openlibrary-search",
        }
    }
}

struct MockRagHandler {
    live_search_enabled: bool,
    live_backend: LiveBackend,
    wikipedia_api_base: String,
    http_user_agent: String,
    provider_name: String,
    response_delay_ms: u64,
    http_client: Client,
}

struct DemoEchoHandler;

fn parse_bool_env(value: &str) -> Option<bool> {
    match value.trim().to_ascii_lowercase().as_str() {
        "1" | "true" | "yes" | "on" => Some(true),
        "0" | "false" | "no" | "off" => Some(false),
        _ => None,
    }
}

impl MockRagHandler {
    fn new(
        live_search_enabled: bool,
        live_backend: LiveBackend,
        wikipedia_api_base: String,
        http_user_agent: String,
        provider_name: String,
        response_delay_ms: u64,
    ) -> Self {
        Self {
            live_search_enabled,
            live_backend,
            wikipedia_api_base,
            http_user_agent,
            provider_name,
            response_delay_ms,
            http_client: Client::builder()
                .timeout(Duration::from_secs(8))
                .build()
                .expect("failed to build HTTP client"),
        }
    }

    async fn live_search(&self, query: &str, top_k: usize) -> Result<Value, RelayOrbError> {
        let results = match self.live_backend {
            LiveBackend::Wikipedia => self.search_wikipedia(query, top_k).await?,
            LiveBackend::HackerNews => self.search_hackernews(query, top_k).await?,
            LiveBackend::OpenLibrary => self.search_openlibrary(query, top_k).await?,
        };

        Ok(json!({
            "results": results,
            "provider": self.provider_name
        }))
    }

    async fn search_wikipedia(
        &self,
        query: &str,
        top_k: usize,
    ) -> Result<Vec<Value>, RelayOrbError> {
        let url = format!(
            "{}/w/api.php",
            self.wikipedia_api_base.trim_end_matches('/')
        );
        let top_k_text = top_k.to_string();
        let response = self
            .http_client
            .get(url)
            .header("user-agent", &self.http_user_agent)
            .query(&[
                ("action", "query"),
                ("list", "search"),
                ("format", "json"),
                ("utf8", "1"),
                ("srsearch", query),
                ("srlimit", top_k_text.as_str()),
            ])
            .send()
            .await
            .map_err(|err| {
                RelayOrbError::new(ErrorCode::WorkerError, "wikipedia search request failed")
                    .with_details(json!({ "backend": "wikipedia", "error": err.to_string() }))
            })?;

        let status = response.status();
        if !status.is_success() {
            return Err(RelayOrbError::new(
                ErrorCode::WorkerError,
                "wikipedia search returned non-200 status",
            )
            .with_details(json!({ "backend": "wikipedia", "status": status.as_u16() })));
        }

        let payload: Value = response.json().await.map_err(|err| {
            RelayOrbError::new(
                ErrorCode::WorkerError,
                "wikipedia search response JSON parsing failed",
            )
            .with_details(json!({ "backend": "wikipedia", "error": err.to_string() }))
        })?;

        let rows = payload
            .get("query")
            .and_then(|value| value.get("search"))
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();

        Ok(rows
            .iter()
            .take(top_k)
            .enumerate()
            .map(|(idx, row)| {
                let id = row
                    .get("pageid")
                    .and_then(Value::as_i64)
                    .map(|value| value.to_string())
                    .unwrap_or_else(|| format!("wiki-{}", idx + 1));
                let title = row
                    .get("title")
                    .and_then(Value::as_str)
                    .unwrap_or("Untitled");
                let snippet = row.get("snippet").and_then(Value::as_str).unwrap_or("");

                json!({
                    "id": id,
                    "text": format!("{}: {}", title, strip_html(snippet)),
                    "score": score_for_rank(idx)
                })
            })
            .collect::<Vec<_>>())
    }

    async fn search_hackernews(
        &self,
        query: &str,
        top_k: usize,
    ) -> Result<Vec<Value>, RelayOrbError> {
        let url = format!(
            "{}/api/v1/search",
            HN_ALGOLIA_API_BASE.trim_end_matches('/')
        );
        let top_k_text = top_k.to_string();
        let response = self
            .http_client
            .get(url)
            .header("user-agent", &self.http_user_agent)
            .query(&[
                ("query", query),
                ("hitsPerPage", top_k_text.as_str()),
                ("tags", "story"),
            ])
            .send()
            .await
            .map_err(|err| {
                RelayOrbError::new(ErrorCode::WorkerError, "hackernews search request failed")
                    .with_details(json!({ "backend": "hackernews", "error": err.to_string() }))
            })?;

        let status = response.status();
        if !status.is_success() {
            return Err(RelayOrbError::new(
                ErrorCode::WorkerError,
                "hackernews search returned non-200 status",
            )
            .with_details(json!({ "backend": "hackernews", "status": status.as_u16() })));
        }

        let payload: Value = response.json().await.map_err(|err| {
            RelayOrbError::new(
                ErrorCode::WorkerError,
                "hackernews search response JSON parsing failed",
            )
            .with_details(json!({ "backend": "hackernews", "error": err.to_string() }))
        })?;

        let hits = payload
            .get("hits")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();

        Ok(hits
            .iter()
            .take(top_k)
            .enumerate()
            .map(|(idx, row)| {
                let id = row
                    .get("objectID")
                    .and_then(Value::as_str)
                    .unwrap_or("hn-unknown")
                    .to_string();
                let title = row
                    .get("title")
                    .and_then(Value::as_str)
                    .or_else(|| row.get("story_title").and_then(Value::as_str))
                    .unwrap_or("Untitled");
                let url = row
                    .get("url")
                    .and_then(Value::as_str)
                    .or_else(|| row.get("story_url").and_then(Value::as_str))
                    .unwrap_or("");

                let text = if url.is_empty() {
                    strip_html(title)
                } else {
                    format!("{} ({})", strip_html(title), url)
                };

                json!({
                    "id": id,
                    "text": text,
                    "score": score_for_rank(idx)
                })
            })
            .collect::<Vec<_>>())
    }

    async fn search_openlibrary(
        &self,
        query: &str,
        top_k: usize,
    ) -> Result<Vec<Value>, RelayOrbError> {
        let url = format!(
            "{}/search.json",
            OPEN_LIBRARY_API_BASE.trim_end_matches('/')
        );
        let top_k_text = top_k.to_string();
        let response = self
            .http_client
            .get(url)
            .header("user-agent", &self.http_user_agent)
            .query(&[("q", query), ("limit", top_k_text.as_str())])
            .send()
            .await
            .map_err(|err| {
                RelayOrbError::new(ErrorCode::WorkerError, "openlibrary search request failed")
                    .with_details(json!({ "backend": "openlibrary", "error": err.to_string() }))
            })?;

        let status = response.status();
        if !status.is_success() {
            return Err(RelayOrbError::new(
                ErrorCode::WorkerError,
                "openlibrary search returned non-200 status",
            )
            .with_details(json!({ "backend": "openlibrary", "status": status.as_u16() })));
        }

        let payload: Value = response.json().await.map_err(|err| {
            RelayOrbError::new(
                ErrorCode::WorkerError,
                "openlibrary search response JSON parsing failed",
            )
            .with_details(json!({ "backend": "openlibrary", "error": err.to_string() }))
        })?;

        let docs = payload
            .get("docs")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();

        Ok(docs
            .iter()
            .take(top_k)
            .enumerate()
            .map(|(idx, row)| {
                let id = row
                    .get("key")
                    .and_then(Value::as_str)
                    .unwrap_or("openlibrary-unknown")
                    .to_string();
                let title = row
                    .get("title")
                    .and_then(Value::as_str)
                    .unwrap_or("Untitled");
                let author = row
                    .get("author_name")
                    .and_then(Value::as_array)
                    .and_then(|authors| authors.first())
                    .and_then(Value::as_str)
                    .unwrap_or("Unknown author");
                let year = row
                    .get("first_publish_year")
                    .and_then(Value::as_i64)
                    .map(|value| value.to_string())
                    .unwrap_or_else(|| "n/a".to_string());

                json!({
                    "id": id,
                    "text": format!("{} — {} (first published: {})", title, author, year),
                    "score": score_for_rank(idx)
                })
            })
            .collect::<Vec<_>>())
    }
}

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

        let top_k = payload.get("topK").and_then(Value::as_u64).unwrap_or(3) as usize;
        let top_k = top_k.clamp(1, 10);

        if self.response_delay_ms > 0 {
            tokio::time::sleep(Duration::from_millis(self.response_delay_ms)).await;
        }

        if self.live_search_enabled {
            return self.live_search(query, top_k).await;
        }

        let results = (0..top_k)
            .map(|idx| {
                json!({
                    "id": format!("doc-{}", idx + 1),
                    "text": format!("Mock match {} for query '{}'", idx + 1, query),
                    "score": score_for_rank(idx)
                })
            })
            .collect::<Vec<_>>();

        Ok(json!({
            "results": results,
            "provider": self.provider_name
        }))
    }
}

#[async_trait]
impl CapabilityHandler for DemoEchoHandler {
    async fn handle(&self, payload: Value) -> Result<Value, RelayOrbError> {
        let text = payload.get("text").and_then(Value::as_str).ok_or_else(|| {
            RelayOrbError::new(
                ErrorCode::SchemaValidationFailed,
                "'text' must be provided as a string",
            )
        })?;

        Ok(json!({
            "echo": text
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
    let version = std::env::var("RELAYORB_VERSION").unwrap_or_else(|_| "dev".to_string());
    let live_search_enabled = std::env::var("RAG_LIVE_SEARCH")
        .map(|value| {
            matches!(
                value.to_ascii_lowercase().as_str(),
                "1" | "true" | "yes" | "on"
            )
        })
        .unwrap_or(false);
    let live_backend = LiveBackend::parse(
        &std::env::var("RAG_LIVE_BACKEND").unwrap_or_else(|_| "wikipedia".to_string()),
    )?;
    let wikipedia_api_base = std::env::var("RAG_WIKI_BASE_URL")
        .unwrap_or_else(|_| DEFAULT_WIKIPEDIA_API_BASE.to_string());
    let http_user_agent = std::env::var("RAG_HTTP_USER_AGENT")
        .unwrap_or_else(|_| "relayorb-worker-mock-rag/0.1".to_string());
    let provider_name = std::env::var("RAG_PROVIDER_NAME")
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| {
            if live_search_enabled {
                live_backend.default_provider_name().to_string()
            } else {
                service_name.clone()
            }
        });
    let response_delay_ms = std::env::var("RAG_RESPONSE_DELAY_MS")
        .ok()
        .and_then(|value| value.parse::<u64>().ok())
        .unwrap_or(0);
    let ttl_seconds = std::env::var("WORKER_TTL_SECONDS")
        .ok()
        .and_then(|value| value.parse::<i64>().ok())
        .unwrap_or(60);
    let heartbeat_interval_seconds = std::env::var("WORKER_HEARTBEAT_INTERVAL_SECONDS")
        .ok()
        .and_then(|value| value.parse::<u64>().ok())
        .unwrap_or(20);
    let enable_demo_echo = std::env::var("ENABLE_DEMO_ECHO")
        .ok()
        .and_then(|value| parse_bool_env(&value))
        .unwrap_or_else(|| !env.eq_ignore_ascii_case("prod"));

    let config = WorkerConfig {
        bind_addr,
        instance_id,
        service_name,
        version,
        env,
        base_url,
        region,
        registry_url,
        registry_identity_audience,
        ttl_seconds,
        heartbeat_interval_seconds,
    };

    let mut registrations = vec![CapabilityRegistration {
        manifest: mock_rag_manifest(),
        handler: Arc::new(MockRagHandler::new(
            live_search_enabled,
            live_backend,
            wikipedia_api_base,
            http_user_agent,
            provider_name.clone(),
            response_delay_ms,
        )),
    }];
    if enable_demo_echo {
        registrations.push(CapabilityRegistration {
            manifest: demo_echo_manifest(),
            handler: Arc::new(DemoEchoHandler),
        });
    }

    let runtime = WorkerRuntime::new(config, registrations)
    .context("failed to initialize worker runtime")?;

    info!(
        live_search_enabled,
        live_backend = live_backend.as_str(),
        provider_name,
        response_delay_ms,
        enable_demo_echo,
        "starting rag worker"
    );
    runtime.serve().await
}

fn score_for_rank(idx: usize) -> f64 {
    (0.95_f64 - (idx as f64 * 0.05_f64)).max(0.1)
}

fn strip_html(input: &str) -> String {
    let mut output = String::with_capacity(input.len());
    let mut in_tag = false;
    for ch in input.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => output.push(ch),
            _ => {}
        }
    }

    output
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
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

fn demo_echo_manifest() -> CapabilityManifest {
    CapabilityManifest {
        capability_id: "demo.echo@v1".to_string(),
        side_effects: CapabilitySideEffects::ReadOnly,
        input_schema: json!({
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "type": "object",
            "required": ["text"],
            "properties": {
                "text": {"type": "string", "minLength": 1, "maxLength": 512}
            },
            "additionalProperties": false
        }),
        output_schema: json!({
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "type": "object",
            "required": ["echo"],
            "properties": {
                "echo": {"type": "string"}
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
            timeout_ms: 2_000,
            max_retries: 0,
        },
        routing: CapabilityRoutingHints {
            strategy: "lowest_latency".to_string(),
            region_affinity: None,
        },
    }
}
