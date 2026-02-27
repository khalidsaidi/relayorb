FROM rust:1.85-bookworm AS builder
WORKDIR /app
COPY Cargo.toml Cargo.lock rust-toolchain.toml ./
COPY config ./config
COPY crates ./crates
RUN cargo build --release -p relayorb-registry

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /app/target/release/relayorb-registry /usr/local/bin/relayorb-registry
COPY config ./config
RUN mkdir -p /data
ENV DATABASE_URL=sqlite:///data/registry.db?mode=rwc
ENV REGISTRY_BIND_ADDR=0.0.0.0:8081
CMD ["relayorb-registry"]
