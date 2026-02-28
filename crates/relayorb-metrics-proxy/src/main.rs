use std::{net::SocketAddr, str::FromStr, sync::Arc};

use anyhow::Context;
use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use relayorb_core::{
    add_cloud_run_iam_headers, init_tracing, trace_id_from_traceparent, SuccessEnvelope,
};
use reqwest::Client;
use serde_json::json;
use tracing::{info, warn};
use uuid::Uuid;

#[derive(Clone)]
struct ScrapeTarget {
    name: &'static str,
    base_url: String,
    metrics_token: String,
}

#[derive(Clone)]
struct AppState {
    client: Client,
    gateway: ScrapeTarget,
    registry: ScrapeTarget,
    worker: ScrapeTarget,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    init_tracing("relayorb-metrics-proxy", None)?;

    let bind_addr =
        std::env::var("METRICS_PROXY_BIND_ADDR").unwrap_or_else(|_| "127.0.0.1:19090".to_string());
    let gateway = build_target("gateway", "GATEWAY_BASE_URL", "GATEWAY_METRICS_TOKEN")?;
    let registry = build_target("registry", "REGISTRY_BASE_URL", "REGISTRY_METRICS_TOKEN")?;
    let worker = build_target("worker", "WORKER_BASE_URL", "WORKER_METRICS_TOKEN")?;
    let client = Client::new();

    let state = Arc::new(AppState {
        client,
        gateway,
        registry,
        worker,
    });

    let app = Router::new()
        .route("/health", get(health))
        .route("/gateway", get(gateway_metrics))
        .route("/registry", get(registry_metrics))
        .route("/worker", get(worker_metrics))
        .with_state(state);

    let addr = SocketAddr::from_str(&bind_addr)?;
    info!(%addr, "metrics proxy listening");
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

fn build_target(
    name: &'static str,
    base_url_key: &'static str,
    metrics_token_key: &'static str,
) -> anyhow::Result<ScrapeTarget> {
    let base_url = std::env::var(base_url_key)
        .with_context(|| format!("{base_url_key} is required for metrics proxy"))?;
    let metrics_token = std::env::var(metrics_token_key)
        .with_context(|| format!("{metrics_token_key} is required for metrics proxy"))?;
    if metrics_token.trim().is_empty() {
        anyhow::bail!("{metrics_token_key} must not be empty");
    }
    Ok(ScrapeTarget {
        name,
        base_url: base_url.trim_end_matches('/').to_string(),
        metrics_token,
    })
}

async fn health(headers: HeaderMap) -> impl IntoResponse {
    let trace_id = header_trace_id(&headers).unwrap_or_else(|| Uuid::new_v4().to_string());
    Json(SuccessEnvelope::ok(
        &relayorb_core::RequestMeta {
            request_id: Uuid::new_v4().to_string(),
            trace_id,
        },
        json!({"ok": true, "service": "relayorb-metrics-proxy"}),
    ))
}

async fn gateway_metrics(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    proxy_metrics(&state.client, &state.gateway).await
}

async fn registry_metrics(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    proxy_metrics(&state.client, &state.registry).await
}

async fn worker_metrics(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    proxy_metrics(&state.client, &state.worker).await
}

async fn proxy_metrics(client: &Client, target: &ScrapeTarget) -> axum::response::Response {
    let metrics_url = format!("{}/metrics", target.base_url);
    let mut request_builder = client
        .get(&metrics_url)
        .header("Authorization", format!("Bearer {}", target.metrics_token));
    request_builder = match add_cloud_run_iam_headers(request_builder, client, &target.base_url)
        .await
    {
        Ok(builder) => builder,
        Err(err) => {
            warn!(target = target.name, error = %err, "failed to prepare Cloud Run IAM headers");
            return (
                StatusCode::BAD_GATEWAY,
                format!("failed to prepare upstream auth: {err}"),
            )
                .into_response();
        }
    };

    let response = match request_builder.send().await {
        Ok(response) => response,
        Err(err) => {
            warn!(target = target.name, error = %err, "metrics upstream request failed");
            return (
                StatusCode::BAD_GATEWAY,
                format!("failed to fetch upstream metrics: {err}"),
            )
                .into_response();
        }
    };

    let status = response.status();
    let bytes = match response.bytes().await {
        Ok(bytes) => bytes,
        Err(err) => {
            warn!(target = target.name, error = %err, "failed reading upstream metrics body");
            return (
                StatusCode::BAD_GATEWAY,
                format!("failed to read upstream metrics response: {err}"),
            )
                .into_response();
        }
    };

    let mut out_headers = HeaderMap::new();
    out_headers.insert(
        axum::http::header::CONTENT_TYPE,
        axum::http::HeaderValue::from_static("text/plain; version=0.0.4; charset=utf-8"),
    );
    (status, out_headers, bytes).into_response()
}

fn header_trace_id(headers: &HeaderMap) -> Option<String> {
    headers
        .get("traceparent")
        .and_then(|value| value.to_str().ok())
        .and_then(trace_id_from_traceparent)
}
