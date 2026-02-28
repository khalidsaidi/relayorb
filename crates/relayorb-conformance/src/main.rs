use std::{
    fs,
    path::{Path, PathBuf},
    time::Instant,
};

use anyhow::{bail, Context};
use clap::{Parser, Subcommand, ValueEnum};
use hmac::{Hmac, Mac};
use jsonschema::Draft;
use relayorb_core::{is_valid_capability_id, validate_json_with_schema};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::Sha256;
use time::{format_description::well_known::Rfc3339, OffsetDateTime};
use uuid::Uuid;

type HmacSha256 = Hmac<Sha256>;

#[derive(Debug, Parser)]
#[command(name = "relayorb-conformance")]
#[command(about = "RelayOrb capability conformance harness")]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Debug, Subcommand)]
enum Command {
    Validate(ValidateArgs),
    Run(RunArgs),
}

#[derive(Debug, Parser)]
struct ValidateArgs {
    #[arg(long)]
    manifest: PathBuf,
    #[arg(long)]
    vectors: PathBuf,
}

#[derive(Debug, Parser)]
struct RunArgs {
    #[arg(long)]
    target: Target,
    #[arg(long)]
    base_url: String,
    #[arg(long)]
    manifest: PathBuf,
    #[arg(long)]
    vectors: PathBuf,
    #[arg(long)]
    bearer_token_env: Option<String>,
    #[arg(long)]
    hmac_env: Option<String>,
}

#[derive(Debug, Clone, Copy, ValueEnum)]
enum Target {
    Worker,
    Gateway,
}

impl Target {
    fn as_str(self) -> &'static str {
        match self {
            Self::Worker => "worker",
            Self::Gateway => "gateway",
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ConformanceManifest {
    capability: String,
    input_schema: Value,
    output_schema: Value,
    error_schema: Value,
    side_effects: String,
    limits: ManifestLimits,
    #[allow(dead_code)]
    routing: Option<Value>,
    #[allow(dead_code)]
    owner: Option<String>,
    #[allow(dead_code)]
    description: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ManifestLimits {
    timeout_ms: u64,
    max_retries: u32,
}

#[derive(Debug, Clone, Deserialize)]
struct VectorFile {
    capability: String,
    cases: Vec<TestCase>,
}

#[derive(Debug, Clone, Deserialize)]
struct TestCase {
    name: String,
    input: Value,
    expect: CaseExpectation,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CaseExpectation {
    status: String,
    #[serde(default)]
    output_schema: Option<String>,
    #[serde(default)]
    error_code: Option<String>,
}

#[derive(Debug, Clone)]
struct CaseHttpResult {
    http_status: u16,
    body: Value,
}

#[derive(Debug, Clone)]
struct RuntimeAuth {
    bearer_token: Option<String>,
    hmac_secret: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ConformanceReport {
    capability: String,
    passed: usize,
    failed: usize,
    failures: Vec<CaseFailure>,
    target: String,
    base_url: String,
    started_at: String,
    finished_at: String,
    cases: Vec<CaseReport>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CaseReport {
    name: String,
    status: String,
    latency_ms: u128,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CaseFailure {
    name: String,
    message: String,
}

#[tokio::main]
async fn main() {
    let cli = Cli::parse();
    let exit_code = match run(cli).await {
        Ok(code) => code,
        Err(err) => {
            eprintln!("error: {err:#}");
            1
        }
    };

    std::process::exit(exit_code);
}

async fn run(cli: Cli) -> anyhow::Result<i32> {
    match cli.command {
        Command::Validate(args) => run_validate(args),
        Command::Run(args) => run_runtime(args).await,
    }
}

fn run_validate(args: ValidateArgs) -> anyhow::Result<i32> {
    let manifest = load_json::<ConformanceManifest>(&args.manifest)?;
    let vectors = load_json::<VectorFile>(&args.vectors)?;

    let failures = validate_suite(&args.manifest, &manifest, &args.vectors, &vectors);
    if failures.is_empty() {
        println!(
            "validated capability '{}' ({} vectors)",
            manifest.capability,
            vectors.cases.len()
        );
        Ok(0)
    } else {
        eprintln!(
            "conformance validation failed with {} issue(s):",
            failures.len()
        );
        for failure in failures {
            eprintln!("- {failure}");
        }
        Ok(2)
    }
}

async fn run_runtime(args: RunArgs) -> anyhow::Result<i32> {
    let manifest = load_json::<ConformanceManifest>(&args.manifest)?;
    let vectors = load_json::<VectorFile>(&args.vectors)?;

    let validation_failures = validate_suite(&args.manifest, &manifest, &args.vectors, &vectors);
    if !validation_failures.is_empty() {
        eprintln!(
            "conformance validation failed with {} issue(s):",
            validation_failures.len()
        );
        for failure in validation_failures {
            eprintln!("- {failure}");
        }
        return Ok(2);
    }

    let auth = load_runtime_auth(&args)?;
    let client = reqwest::Client::new();
    let started = now_rfc3339();

    let mut passed = 0_usize;
    let mut failed = 0_usize;
    let mut failures = Vec::new();
    let mut cases = Vec::new();

    for case in &vectors.cases {
        let began = Instant::now();
        let response = execute_case(
            &client,
            args.target,
            &args.base_url,
            &manifest.capability,
            &case.input,
            &auth,
        )
        .await;

        let latency_ms = began.elapsed().as_millis();
        match response {
            Ok(result) => match evaluate_case(case, &manifest, &result) {
                Ok(_) => {
                    passed += 1;
                    cases.push(CaseReport {
                        name: case.name.clone(),
                        status: "pass".to_string(),
                        latency_ms,
                    });
                }
                Err(message) => {
                    failed += 1;
                    failures.push(CaseFailure {
                        name: case.name.clone(),
                        message: message.to_string(),
                    });
                    cases.push(CaseReport {
                        name: case.name.clone(),
                        status: "fail".to_string(),
                        latency_ms,
                    });
                }
            },
            Err(err) => {
                failed += 1;
                failures.push(CaseFailure {
                    name: case.name.clone(),
                    message: format!("request failed: {err}"),
                });
                cases.push(CaseReport {
                    name: case.name.clone(),
                    status: "fail".to_string(),
                    latency_ms,
                });
            }
        }
    }

    let finished = now_rfc3339();
    let report = ConformanceReport {
        capability: manifest.capability.clone(),
        passed,
        failed,
        failures,
        target: args.target.as_str().to_string(),
        base_url: args.base_url.clone(),
        started_at: started,
        finished_at: finished,
        cases,
    };

    let report_path = write_report(&report)?;
    println!(
        "capability={} target={} passed={} failed={} report={}",
        report.capability,
        report.target,
        report.passed,
        report.failed,
        report_path.display()
    );

    if report.failed == 0 {
        Ok(0)
    } else {
        Ok(3)
    }
}

fn load_json<T>(path: &Path) -> anyhow::Result<T>
where
    T: for<'de> Deserialize<'de>,
{
    let content =
        fs::read_to_string(path).with_context(|| format!("failed reading '{}'", path.display()))?;
    serde_json::from_str(&content).with_context(|| format!("failed parsing '{}'", path.display()))
}

fn validate_suite(
    manifest_path: &Path,
    manifest: &ConformanceManifest,
    vectors_path: &Path,
    vectors: &VectorFile,
) -> Vec<String> {
    let mut failures = Vec::new();

    if !is_valid_capability_id(&manifest.capability) {
        failures.push(format!(
            "manifest capability '{}' does not match required format <namespace>.<name>@v<major>",
            manifest.capability
        ));
    }

    let manifest_stem = manifest_path
        .file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or_default();
    if manifest_stem != manifest.capability {
        failures.push(format!(
            "manifest filename stem '{}' must match manifest capability '{}'",
            manifest_stem, manifest.capability
        ));
    }

    if vectors.capability != manifest.capability {
        failures.push(format!(
            "vectors capability '{}' must match manifest capability '{}'",
            vectors.capability, manifest.capability
        ));
    }

    let vectors_stem = vectors_path
        .file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or_default();
    if vectors_stem != vectors.capability {
        failures.push(format!(
            "vectors filename stem '{}' must match vectors capability '{}'",
            vectors_stem, vectors.capability
        ));
    }

    if vectors.cases.is_empty() {
        failures.push("vectors must contain at least one test case".to_string());
    }

    for case in &vectors.cases {
        let expected = case.expect.status.to_ascii_lowercase();
        if expected != "ok" && expected != "error" {
            failures.push(format!(
                "case '{}' has invalid expect.status '{}'; expected 'ok' or 'error'",
                case.name, case.expect.status
            ));
        }

        if let Some(output_schema) = &case.expect.output_schema {
            if output_schema != "default" {
                failures.push(format!(
                    "case '{}' uses unsupported expect.outputSchema '{}'; only 'default' is supported",
                    case.name, output_schema
                ));
            }
        }
    }

    let side_effects = manifest.side_effects.to_ascii_lowercase();
    if side_effects != "read_only" && side_effects != "mutating" {
        failures.push(format!(
            "manifest sideEffects '{}' must be 'read_only' or 'mutating'",
            manifest.side_effects
        ));
    }

    if manifest.limits.timeout_ms == 0 {
        failures.push("manifest limits.timeoutMs must be > 0".to_string());
    }
    if manifest.limits.max_retries > 16 {
        failures.push(format!(
            "manifest limits.maxRetries '{}' exceeds supported harness sanity bound (16)",
            manifest.limits.max_retries
        ));
    }

    compile_schema("inputSchema", &manifest.input_schema, &mut failures);
    compile_schema("outputSchema", &manifest.output_schema, &mut failures);
    compile_schema("errorSchema", &manifest.error_schema, &mut failures);

    validate_error_schema_contract(&manifest.error_schema, &mut failures);

    failures
}

fn compile_schema(name: &str, schema: &Value, failures: &mut Vec<String>) {
    if let Err(err) = jsonschema::options()
        .with_draft(Draft::Draft202012)
        .build(schema)
    {
        failures.push(format!("manifest {name} failed to compile: {err}"));
    }
}

fn validate_error_schema_contract(schema: &Value, failures: &mut Vec<String>) {
    let valid_error = json!({
        "requestId": "req-1",
        "traceId": "trace-1",
        "status": "error",
        "error": {
            "code": "INTERNAL",
            "message": "example",
            "details": {}
        }
    });

    if let Err(errors) = validate_json_with_schema(schema, &valid_error) {
        failures.push(format!(
            "errorSchema rejected valid RelayOrb error envelope: {}",
            errors.join("; ")
        ));
    }

    let invalid_error = json!({
        "traceId": "trace-1",
        "status": "error",
        "error": {
            "code": "INTERNAL",
            "message": "example",
            "details": {}
        }
    });

    if validate_json_with_schema(schema, &invalid_error).is_ok() {
        failures.push(
            "errorSchema accepted invalid envelope missing required field 'requestId'".to_string(),
        );
    }
}

fn load_runtime_auth(args: &RunArgs) -> anyhow::Result<RuntimeAuth> {
    if args.bearer_token_env.is_some() && args.hmac_env.is_some() {
        bail!("specify only one of --bearer-token-env or --hmac-env");
    }

    let bearer_token = if let Some(env_name) = &args.bearer_token_env {
        Some(
            std::env::var(env_name)
                .with_context(|| format!("environment variable '{}' is not set", env_name))?,
        )
    } else {
        None
    };

    let hmac_secret = if let Some(env_name) = &args.hmac_env {
        Some(
            std::env::var(env_name)
                .with_context(|| format!("environment variable '{}' is not set", env_name))?,
        )
    } else {
        None
    };

    Ok(RuntimeAuth {
        bearer_token,
        hmac_secret,
    })
}

async fn execute_case(
    client: &reqwest::Client,
    target: Target,
    base_url: &str,
    capability: &str,
    input: &Value,
    auth: &RuntimeAuth,
) -> anyhow::Result<CaseHttpResult> {
    let request_id = Uuid::new_v4().to_string();
    let trace_id = Uuid::new_v4().to_string();

    let (url, body) = match target {
        Target::Worker => (
            format!("{}/invoke/{}", base_url.trim_end_matches('/'), capability),
            json!({
                "requestId": request_id,
                "traceId": trace_id,
                "payload": input
            }),
        ),
        Target::Gateway => (
            format!("{}/v1/invoke", base_url.trim_end_matches('/')),
            json!({
                "requestId": request_id,
                "caller": {
                    "agentId": "conformance-harness",
                    "role": "researcher"
                },
                "capability": capability,
                "payload": input
            }),
        ),
    };

    let body_string = serde_json::to_string(&body).context("failed serializing request body")?;
    let mut request = client
        .post(url)
        .header("content-type", "application/json")
        .body(body_string.clone());

    if let Some(token) = &auth.bearer_token {
        request = request.bearer_auth(token);
    }

    if let Some(secret) = &auth.hmac_secret {
        let signature = hmac_signature(secret, body_string.as_bytes())?;
        request = request
            .header("x-relayorb-signature", signature)
            .header("x-relayorb-agent-id", "conformance-harness")
            .header("x-relayorb-role", "researcher");
    }

    let response = request.send().await.context("request send failed")?;
    let http_status = response.status().as_u16();
    let text = response
        .text()
        .await
        .context("failed to read response body")?;

    let body_json: Value = serde_json::from_str(&text).unwrap_or_else(|_| json!({"raw": text}));
    Ok(CaseHttpResult {
        http_status,
        body: body_json,
    })
}

fn evaluate_case(
    case: &TestCase,
    manifest: &ConformanceManifest,
    result: &CaseHttpResult,
) -> anyhow::Result<()> {
    let expected_status = case.expect.status.to_ascii_lowercase();
    let actual_status = result
        .body
        .get("status")
        .and_then(Value::as_str)
        .map(ToString::to_string)
        .unwrap_or_else(|| {
            if result.http_status >= 400 {
                "error".to_string()
            } else {
                "ok".to_string()
            }
        });

    match expected_status.as_str() {
        "ok" => {
            if actual_status != "ok" {
                bail!(
                    "expected status 'ok' but got '{}' (http {})",
                    actual_status,
                    result.http_status
                );
            }

            let data = result
                .body
                .get("data")
                .ok_or_else(|| anyhow::anyhow!("response missing 'data' field"))?;
            validate_json_with_schema(&manifest.output_schema, data)
                .map_err(|errors| anyhow::anyhow!(errors.join("; ")))
                .context("response data failed manifest outputSchema")?;

            if let Some(output_schema) = &case.expect.output_schema {
                if output_schema != "default" {
                    bail!(
                        "unsupported output schema selector '{}'; expected 'default'",
                        output_schema
                    );
                }
            }

            Ok(())
        }
        "error" => {
            if actual_status != "error" {
                bail!(
                    "expected status 'error' but got '{}' (http {})",
                    actual_status,
                    result.http_status
                );
            }

            validate_json_with_schema(&manifest.error_schema, &result.body)
                .map_err(|errors| anyhow::anyhow!(errors.join("; ")))
                .context("error response failed manifest errorSchema")?;

            if let Some(expected_code) = &case.expect.error_code {
                let actual_code = result
                    .body
                    .get("error")
                    .and_then(|value| value.get("code"))
                    .and_then(Value::as_str)
                    .unwrap_or_default();

                if actual_code != expected_code {
                    bail!(
                        "expected error code '{}' but got '{}'",
                        expected_code,
                        actual_code
                    );
                }
            }

            Ok(())
        }
        other => bail!("unsupported expected status '{}'", other),
    }
}

fn write_report(report: &ConformanceReport) -> anyhow::Result<PathBuf> {
    let reports_dir = Path::new("conformance/reports");
    fs::create_dir_all(reports_dir).with_context(|| {
        format!(
            "failed creating reports directory '{}'",
            reports_dir.display()
        )
    })?;

    let timestamp = OffsetDateTime::now_utc().unix_timestamp();
    let safe_capability = sanitize_for_filename(&report.capability);
    let filename = format!("{}-{}.json", safe_capability, timestamp);
    let report_path = reports_dir.join(filename);

    let content = serde_json::to_string_pretty(report).context("failed serializing report")?;
    fs::write(&report_path, content)
        .with_context(|| format!("failed writing report '{}'", report_path.display()))?;

    Ok(report_path)
}

fn sanitize_for_filename(value: &str) -> String {
    value
        .chars()
        .map(|ch| match ch {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            _ => ch,
        })
        .collect()
}

fn now_rfc3339() -> String {
    OffsetDateTime::now_utc()
        .format(&Rfc3339)
        .unwrap_or_else(|_| OffsetDateTime::now_utc().unix_timestamp().to_string())
}

fn hmac_signature(secret: &str, body: &[u8]) -> anyhow::Result<String> {
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).context("invalid hmac key")?;
    mac.update(body);
    Ok(hex::encode(mac.finalize().into_bytes()))
}
