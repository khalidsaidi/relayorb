FROM rust:1.85-bookworm AS metrics-proxy-builder
WORKDIR /app
COPY Cargo.toml Cargo.lock rust-toolchain.toml ./
COPY crates ./crates
RUN cargo build --release -p relayorb-metrics-proxy

FROM otel/opentelemetry-collector-contrib:0.109.0
COPY collector-prod.yaml /etc/otelcol-contrib/config.yaml
COPY entrypoint.sh /usr/local/bin/relayorb-otel-entrypoint.sh
COPY --from=metrics-proxy-builder /app/target/release/relayorb-metrics-proxy /usr/local/bin/relayorb-metrics-proxy
RUN chmod +x /usr/local/bin/relayorb-otel-entrypoint.sh /usr/local/bin/relayorb-metrics-proxy
ENTRYPOINT ["/usr/local/bin/relayorb-otel-entrypoint.sh"]
