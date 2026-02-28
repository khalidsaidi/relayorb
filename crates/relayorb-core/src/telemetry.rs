use anyhow::Context;
use metrics_exporter_prometheus::{PrometheusBuilder, PrometheusHandle};
use once_cell::sync::OnceCell;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

#[cfg(feature = "otel")]
use opentelemetry::{global, trace::TracerProvider as _, KeyValue};
#[cfg(feature = "otel")]
use opentelemetry_otlp::WithExportConfig;
#[cfg(feature = "otel")]
use opentelemetry_sdk::{runtime::Tokio, trace as sdktrace, Resource};

static TRACING_INIT: OnceCell<()> = OnceCell::new();
static METRICS_INIT: OnceCell<Option<PrometheusHandle>> = OnceCell::new();

pub fn init_tracing(service_name: &str, otel_endpoint: Option<&str>) -> anyhow::Result<()> {
    if TRACING_INIT.get().is_some() {
        return Ok(());
    }

    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));

    #[cfg(feature = "otel")]
    {
        if let Some(endpoint) = otel_endpoint.filter(|v| !v.trim().is_empty()) {
            let tracer_provider =
                opentelemetry_otlp::new_pipeline()
                    .tracing()
                    .with_exporter(
                        opentelemetry_otlp::new_exporter()
                            .tonic()
                            .with_endpoint(endpoint),
                    )
                    .with_trace_config(sdktrace::Config::default().with_resource(Resource::new(
                        vec![KeyValue::new("service.name", service_name.to_string())],
                    )))
                    .install_batch(Tokio)
                    .context("failed to initialize OTEL pipeline")?;
            let tracer = tracer_provider.tracer(service_name.to_string());
            global::set_tracer_provider(tracer_provider);

            tracing_subscriber::registry()
                .with(filter)
                .with(tracing_subscriber::fmt::layer().json())
                .with(tracing_opentelemetry::layer().with_tracer(tracer))
                .try_init()
                .context("failed to initialize tracing subscriber")?;

            TRACING_INIT.set(()).ok();
            return Ok(());
        }
    }

    tracing_subscriber::registry()
        .with(filter)
        .with(tracing_subscriber::fmt::layer().json())
        .try_init()
        .context("failed to initialize tracing subscriber")?;

    let _ = service_name;
    let _ = otel_endpoint;
    TRACING_INIT.set(()).ok();
    Ok(())
}

pub fn init_metrics_exporter() -> anyhow::Result<()> {
    if METRICS_INIT.get().is_some() {
        return Ok(());
    }

    let exporter = std::env::var("RELAYORB_METRICS_EXPORTER")
        .unwrap_or_else(|_| "prometheus".to_string())
        .trim()
        .to_ascii_lowercase();

    let value = if exporter.is_empty() || matches!(exporter.as_str(), "none" | "disabled" | "off") {
        None
    } else if exporter == "prometheus" {
        let handle = PrometheusBuilder::new()
            .install_recorder()
            .context("failed to initialize prometheus recorder")?;
        Some(handle)
    } else {
        anyhow::bail!("unsupported RELAYORB_METRICS_EXPORTER value '{exporter}'");
    };

    METRICS_INIT
        .set(value)
        .map_err(|_| anyhow::anyhow!("metrics exporter already initialized"))?;
    Ok(())
}

pub fn render_prometheus_metrics() -> Option<String> {
    METRICS_INIT
        .get()
        .and_then(|handle| handle.as_ref().map(PrometheusHandle::render))
}
