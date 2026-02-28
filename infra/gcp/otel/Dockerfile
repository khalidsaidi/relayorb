FROM rust:1.85-bookworm AS metrics-proxy-builder
WORKDIR /app
COPY Cargo.toml Cargo.lock rust-toolchain.toml ./
COPY crates ./crates
RUN cargo build --release -p relayorb-metrics-proxy

FROM otel/opentelemetry-collector-contrib:0.109.0 AS otel-collector

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=otel-collector /otelcol-contrib /otelcol-contrib
COPY infra/gcp/otel/collector-prod.yaml /etc/otelcol-contrib/config.yaml
COPY --chmod=0555 infra/gcp/otel/entrypoint.sh /usr/local/bin/relayorb-otel-entrypoint.sh
COPY --from=metrics-proxy-builder --chmod=0555 /app/target/release/relayorb-metrics-proxy /usr/local/bin/relayorb-metrics-proxy
ENTRYPOINT ["/usr/local/bin/relayorb-otel-entrypoint.sh"]
