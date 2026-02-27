FROM rust:1.85-bookworm AS builder
WORKDIR /app
COPY Cargo.toml Cargo.lock rust-toolchain.toml ./
COPY config ./config
COPY crates ./crates
RUN cargo build --release -p worker-mock-rag

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /app/target/release/worker-mock-rag /usr/local/bin/worker-mock-rag
COPY config ./config
ENV WORKER_BIND_ADDR=0.0.0.0:8090
CMD ["worker-mock-rag"]
