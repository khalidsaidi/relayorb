use anyhow::Context;
use once_cell::sync::OnceCell;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

static INIT: OnceCell<()> = OnceCell::new();

pub fn init_tracing(service_name: &str, _otel_endpoint: Option<&str>) -> anyhow::Result<()> {
    if INIT.get().is_some() {
        return Ok(());
    }

    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));

    #[cfg(feature = "otel")]
    {
        if let Some(endpoint) = _otel_endpoint.filter(|v| !v.trim().is_empty()) {
            let tracer = opentelemetry_otlp::new_pipeline()
                .tracing()
                .with_exporter(
                    opentelemetry_otlp::new_exporter()
                        .tonic()
                        .with_endpoint(endpoint),
                )
                .with_trace_config(opentelemetry::sdk::trace::config().with_resource(
                    opentelemetry::sdk::Resource::new(vec![opentelemetry::KeyValue::new(
                        "service.name",
                        service_name.to_string(),
                    )]),
                ))
                .install_batch(opentelemetry::runtime::Tokio)
                .context("failed to initialize OTEL pipeline")?;

            tracing_subscriber::registry()
                .with(filter)
                .with(tracing_subscriber::fmt::layer().json())
                .with(tracing_opentelemetry::layer().with_tracer(tracer))
                .try_init()
                .context("failed to initialize tracing subscriber")?;

            INIT.set(()).ok();
            return Ok(());
        }
    }

    tracing_subscriber::registry()
        .with(filter)
        .with(tracing_subscriber::fmt::layer().json())
        .try_init()
        .context("failed to initialize tracing subscriber")?;

    let _ = service_name;
    INIT.set(()).ok();
    Ok(())
}
