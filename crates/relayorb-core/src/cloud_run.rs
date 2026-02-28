use std::{collections::HashMap, sync::Mutex};

use anyhow::Context;
use base64::{engine::general_purpose, Engine};
use once_cell::sync::Lazy;
use reqwest::Client;
use serde_json::Value;
use time::OffsetDateTime;

const SERVERLESS_AUTH_HEADER: &str = "x-serverless-authorization";
const METADATA_IDENTITY_URL: &str =
    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity";
const TOKEN_REFRESH_SKEW_SECONDS: i64 = 300;

#[derive(Clone)]
struct CachedIdToken {
    token: String,
    refresh_after_unix: i64,
}

static TOKEN_CACHE: Lazy<Mutex<HashMap<String, CachedIdToken>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

pub async fn cloud_run_id_token(client: &Client, audience: &str) -> anyhow::Result<String> {
    let audience = audience.trim();
    if audience.is_empty() {
        anyhow::bail!("cloud run IAM audience must not be empty");
    }

    let now = OffsetDateTime::now_utc().unix_timestamp();
    if let Some(token) = cached_token(audience, now)? {
        return Ok(token);
    }

    let token = fetch_metadata_identity_token(client, audience).await?;
    let refresh_after_unix = token_refresh_after(&token)?;
    let refresh_after_unix = if refresh_after_unix <= now {
        now + 30
    } else {
        refresh_after_unix
    };

    TOKEN_CACHE
        .lock()
        .map_err(|_| anyhow::anyhow!("cloud run id token cache is poisoned"))?
        .insert(
            audience.to_string(),
            CachedIdToken {
                token: token.clone(),
                refresh_after_unix,
            },
        );

    Ok(token)
}

pub async fn add_cloud_run_iam_headers(
    request: reqwest::RequestBuilder,
    client: &Client,
    audience: &str,
) -> anyhow::Result<reqwest::RequestBuilder> {
    let token = cloud_run_id_token(client, audience).await?;
    Ok(request.header(SERVERLESS_AUTH_HEADER, format!("Bearer {token}")))
}

fn cached_token(audience: &str, now_unix: i64) -> anyhow::Result<Option<String>> {
    let cache = TOKEN_CACHE
        .lock()
        .map_err(|_| anyhow::anyhow!("cloud run id token cache is poisoned"))?;
    Ok(cache.get(audience).and_then(|cached| {
        if now_unix < cached.refresh_after_unix {
            Some(cached.token.clone())
        } else {
            None
        }
    }))
}

async fn fetch_metadata_identity_token(client: &Client, audience: &str) -> anyhow::Result<String> {
    let mut url = reqwest::Url::parse(METADATA_IDENTITY_URL)
        .context("failed to parse metadata identity URL")?;
    url.query_pairs_mut()
        .append_pair("audience", audience)
        .append_pair("format", "full");

    let response = client
        .get(url)
        .header("Metadata-Flavor", "Google")
        .send()
        .await
        .context("failed to fetch identity token from metadata server")?;

    if !response.status().is_success() {
        anyhow::bail!(
            "metadata identity token endpoint returned non-success status: {}",
            response.status()
        );
    }

    let token = response
        .text()
        .await
        .context("failed reading identity token response body")?;
    let trimmed = token.trim();
    if trimmed.is_empty() {
        anyhow::bail!("metadata identity token endpoint returned an empty token");
    }
    Ok(trimmed.to_string())
}

fn token_refresh_after(token: &str) -> anyhow::Result<i64> {
    let payload_segment = token
        .split('.')
        .nth(1)
        .ok_or_else(|| anyhow::anyhow!("identity token does not contain a payload segment"))?;

    let payload_bytes = general_purpose::URL_SAFE_NO_PAD
        .decode(payload_segment)
        .or_else(|_| general_purpose::URL_SAFE.decode(payload_segment))
        .context("failed to decode JWT payload")?;

    let payload: Value =
        serde_json::from_slice(&payload_bytes).context("failed to parse JWT payload")?;
    let exp = payload
        .get("exp")
        .and_then(Value::as_i64)
        .ok_or_else(|| anyhow::anyhow!("identity token payload missing integer 'exp' claim"))?;
    Ok(exp - TOKEN_REFRESH_SKEW_SECONDS)
}

#[cfg(test)]
mod tests {
    use super::token_refresh_after;
    use base64::{engine::general_purpose, Engine};

    #[test]
    fn parses_refresh_time_from_jwt_payload() {
        let header = general_purpose::URL_SAFE_NO_PAD.encode(br#"{"alg":"RS256"}"#);
        let payload = general_purpose::URL_SAFE_NO_PAD.encode(br#"{"exp":1700000000}"#);
        let token = format!("{header}.{payload}.sig");
        assert_eq!(token_refresh_after(&token).unwrap(), 1_699_999_700);
    }
}
