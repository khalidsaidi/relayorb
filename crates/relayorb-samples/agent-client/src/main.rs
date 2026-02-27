use anyhow::Context;
use clap::Parser;
use hmac::{Hmac, Mac};
use serde_json::Value;
use sha2::Sha256;
use uuid::Uuid;

type HmacSha256 = Hmac<Sha256>;

#[derive(Debug, Parser)]
#[command(name = "agent-client")]
#[command(about = "RelayOrb sample agent client")]
struct Args {
    #[arg(long, default_value = "http://127.0.0.1:8080")]
    gateway_url: String,
    #[arg(long, default_value = "agent-client")]
    agent_id: String,
    #[arg(long, default_value = "researcher")]
    role: String,
    #[arg(long)]
    budget_key: Option<String>,
    #[arg(long)]
    payload_file: Option<String>,
    capability: String,
    payload: Option<String>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let args = Args::parse();

    let payload = if let Some(file) = &args.payload_file {
        let content = std::fs::read_to_string(file)
            .with_context(|| format!("failed reading payload file '{file}'"))?;
        serde_json::from_str::<Value>(&content)
            .with_context(|| format!("failed parsing JSON in payload file '{file}'"))?
    } else if let Some(payload) = &args.payload {
        serde_json::from_str::<Value>(payload).context("failed parsing inline JSON payload")?
    } else {
        anyhow::bail!("provide either positional payload JSON or --payload-file")
    };

    let request_id = Uuid::new_v4().to_string();
    let request_body = serde_json::json!({
        "requestId": request_id,
        "caller": {
            "agentId": args.agent_id,
            "role": args.role,
            "budgetKey": args.budget_key
        },
        "capability": args.capability,
        "payload": payload,
        "trace": {}
    });

    let body_string =
        serde_json::to_string(&request_body).context("failed serializing request body")?;
    let secret =
        std::env::var("SECRET_AUTH_HMAC").unwrap_or_else(|_| "relayorb-dev-secret".to_string());
    let signature = sign(&secret, body_string.as_bytes())?;

    let url = format!("{}/v1/invoke", args.gateway_url.trim_end_matches('/'));
    let response = reqwest::Client::new()
        .post(url)
        .header("content-type", "application/json")
        .header("x-relayorb-signature", signature)
        .body(body_string)
        .send()
        .await
        .context("failed to call gateway")?;

    let status = response.status();
    let body = response
        .text()
        .await
        .context("failed reading gateway response")?;

    println!("status: {}", status);
    let parsed: Value =
        serde_json::from_str(&body).unwrap_or_else(|_| serde_json::json!({"raw": body}));
    println!("{}", serde_json::to_string_pretty(&parsed)?);

    if let Some(trace_id) = parsed.get("traceId").and_then(Value::as_str) {
        println!("traceId: {}", trace_id);
    }

    Ok(())
}

fn sign(secret: &str, body: &[u8]) -> anyhow::Result<String> {
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).context("invalid HMAC key")?;
    mac.update(body);
    let signature = mac.finalize().into_bytes();
    Ok(hex::encode(signature))
}
