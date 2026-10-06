//! `relayorb check`: re-send recorded requests to a live MCP server and diff the answers.

use std::process::Stdio;
use std::time::{Duration, Instant};

use anyhow::{anyhow, bail, Context, Result};
use serde_json::{json, Value};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{ChildStdin, Command};
use tokio::sync::mpsc;

use crate::message::{self, Direction, Kind, Message};
use crate::replay::Replayer;
use crate::store::Session;

const MAX_DIFFS_SHOWN: usize = 8;
const SKIPPED_METHODS: &[&str] = &["initialize", "ping"];

pub struct Options {
    pub timeout: Duration,
    pub ignore_keys: Vec<String>,
}

pub async fn run(session: Session, command: Vec<String>, opts: Options) -> Result<i32> {
    let Some((program, args)) = command.split_first() else {
        bail!("missing server command, e.g. `relayorb check session.json -- node server.js`");
    };

    let exchanges = session.exchanges();
    let initialize = exchanges.iter().find(|ex| {
        ex.request.direction == Direction::ClientToServer
            && ex.request.message.method.as_deref() == Some("initialize")
    });
    let calls: Vec<_> = exchanges
        .iter()
        .filter(|ex| {
            ex.request.direction == Direction::ClientToServer
                && ex.response.is_some()
                && !SKIPPED_METHODS.contains(&ex.request.message.method.as_deref().unwrap_or(""))
        })
        .collect();
    if calls.is_empty() {
        bail!("the recording has no answered requests to check");
    }

    let mut child = Command::new(crate::spawn::program(program))
        .args(args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .kill_on_drop(true)
        .spawn()
        .with_context(|| format!("starting MCP server `{program}`"))?;
    let mut server = Server {
        stdin: child.stdin.take().expect("piped stdin"),
        rx: spawn_reader(child.stdout.take().expect("piped stdout")),
        next_id: 0,
        timeout: opts.timeout,
        agent_answers: Replayer::answering(&session, Direction::ServerToClient),
    };

    let init_params = initialize
        .and_then(|ex| ex.request.message.body.get("params").cloned())
        .unwrap_or_else(|| {
            json!({
                "protocolVersion": "2025-06-18",
                "capabilities": {},
                "clientInfo": {"name": "relayorb", "version": env!("CARGO_PKG_VERSION")}
            })
        });
    let init = server
        .call("initialize", Some(init_params))
        .await
        .context("server did not answer initialize")?;
    if let Some(err) = init.body.get("error") {
        bail!("server rejected initialize: {err}");
    }
    server
        .send(&json!({"jsonrpc": "2.0", "method": "notifications/initialized"}))
        .await?;

    println!(
        "relayorb check: {} recorded call{} against `{}`",
        calls.len(),
        if calls.len() == 1 { "" } else { "s" },
        command.join(" ")
    );
    let (mut passed, mut failed) = (0usize, 0usize);
    for ex in calls {
        let req = &ex.request.message;
        let method = req.method.as_deref().unwrap_or_default();
        let label = message::label(method, req.body.get("params"));
        let started = Instant::now();
        let live = server.call(method, req.body.get("params").cloned()).await;
        let elapsed = started.elapsed().as_millis();
        let expected = normalize(
            &ex.response.expect("filtered").message.body,
            &opts.ignore_keys,
        );
        let diffs = match &live {
            Ok(live) => diff(&expected, &normalize(&live.body, &opts.ignore_keys)),
            Err(err) => vec![format!("no answer: {err:#}")],
        };
        if diffs.is_empty() {
            passed += 1;
            println!("  PASS  {label:<40} {elapsed:>6}ms");
        } else {
            failed += 1;
            println!("  FAIL  {label:<40} {elapsed:>6}ms");
            for line in diffs.iter().take(MAX_DIFFS_SHOWN) {
                println!("        {line}");
            }
            if diffs.len() > MAX_DIFFS_SHOWN {
                println!(
                    "        ... {} more differences",
                    diffs.len() - MAX_DIFFS_SHOWN
                );
            }
        }
        if live.is_err() {
            break; // The server is gone or stuck; later calls would only time out.
        }
    }
    println!("{passed} passed, {failed} failed");
    drop(server);
    let _ = child.start_kill();
    Ok(if failed == 0 { 0 } else { 1 })
}

struct Server {
    stdin: ChildStdin,
    rx: mpsc::UnboundedReceiver<Message>,
    next_id: u64,
    timeout: Duration,
    /// The agent's recorded answers to server-initiated requests (sampling, roots, ...).
    agent_answers: Replayer,
}

impl Server {
    async fn send(&mut self, value: &Value) -> Result<()> {
        let mut line = value.to_string();
        line.push('\n');
        self.stdin.write_all(line.as_bytes()).await?;
        self.stdin.flush().await?;
        Ok(())
    }

    async fn call(&mut self, method: &str, params: Option<Value>) -> Result<Message> {
        self.next_id += 1;
        let id = format!("relayorb-check-{}", self.next_id);
        let mut request = json!({"jsonrpc": "2.0", "id": id, "method": method});
        if let Some(params) = params {
            request["params"] = params;
        }
        self.send(&request).await?;
        let want = Value::String(id).to_string();
        let deadline = tokio::time::Instant::now() + self.timeout;
        loop {
            let msg = tokio::time::timeout_at(deadline, self.rx.recv())
                .await
                .map_err(|_| anyhow!("timed out after {}s", self.timeout.as_secs()))?
                .ok_or_else(|| anyhow!("server closed its output"))?;
            match msg.kind {
                Kind::Response if msg.rpc_id.as_deref() == Some(want.as_str()) => return Ok(msg),
                // The server asked us something (roots, sampling, ...). We are not a real client.
                // The server asked the agent something (sampling, roots, ...): answer the way the
                // agent did in the recording, or with an error if it never came up.
                Kind::Request => {
                    let reply = self.agent_answers.answer(&msg).unwrap_or_else(|| {
                        json!({
                            "jsonrpc": "2.0",
                            "id": msg.body.get("id").cloned().unwrap_or(Value::Null),
                            "error": {"code": -32601, "message": "relayorb check: no recorded answer"}
                        })
                    });
                    self.send(&reply).await?;
                }
                _ => {}
            }
        }
    }
}

fn spawn_reader(stdout: tokio::process::ChildStdout) -> mpsc::UnboundedReceiver<Message> {
    let (tx, rx) = mpsc::unbounded_channel();
    tokio::spawn(async move {
        let mut lines = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            for msg in message::parse_line(&line) {
                if tx.send(msg).is_err() {
                    return;
                }
            }
        }
    });
    rx
}

/// Drop the envelope (`id`, `jsonrpc`) and any ignored keys, at any depth.
pub fn normalize(body: &Value, ignore_keys: &[String]) -> Value {
    fn strip(value: &Value, ignore: &[String]) -> Value {
        match value {
            Value::Object(map) => Value::Object(
                map.iter()
                    .filter(|(k, _)| !ignore.iter().any(|i| i == *k))
                    .map(|(k, v)| (k.clone(), strip(v, ignore)))
                    .collect(),
            ),
            Value::Array(items) => Value::Array(items.iter().map(|v| strip(v, ignore)).collect()),
            other => other.clone(),
        }
    }
    let mut out = serde_json::Map::new();
    for key in ["result", "error"] {
        if let Some(v) = body.get(key) {
            out.insert(key.to_string(), strip(v, ignore_keys));
        }
    }
    Value::Object(out)
}

/// Human-readable differences between two JSON values, as `path: old -> new` lines.
pub fn diff(expected: &Value, actual: &Value) -> Vec<String> {
    let mut out = Vec::new();
    walk("", expected, actual, &mut out);
    out
}

fn walk(path: &str, a: &Value, b: &Value, out: &mut Vec<String>) {
    match (a, b) {
        (Value::Object(ma), Value::Object(mb)) => {
            for (k, va) in ma {
                let p = join(path, k);
                match mb.get(k) {
                    Some(vb) => walk(&p, va, vb, out),
                    None => out.push(format!("- {p}: {}", short(va))),
                }
            }
            for (k, vb) in mb {
                if !ma.contains_key(k) {
                    out.push(format!("+ {}: {}", join(path, k), short(vb)));
                }
            }
        }
        (Value::Array(xa), Value::Array(xb)) => {
            for i in 0..xa.len().max(xb.len()) {
                let p = format!("{path}[{i}]");
                match (xa.get(i), xb.get(i)) {
                    (Some(va), Some(vb)) => walk(&p, va, vb, out),
                    (Some(va), None) => out.push(format!("- {p}: {}", short(va))),
                    (None, Some(vb)) => out.push(format!("+ {p}: {}", short(vb))),
                    (None, None) => {}
                }
            }
        }
        _ if a != b => out.push(format!(
            "~ {}: {} -> {}",
            if path.is_empty() { "(root)" } else { path },
            short(a),
            short(b)
        )),
        _ => {}
    }
}

fn join(path: &str, key: &str) -> String {
    if path.is_empty() {
        key.to_string()
    } else {
        format!("{path}.{key}")
    }
}

fn short(v: &Value) -> String {
    let text = v.to_string();
    if text.chars().count() > 80 {
        format!("{}…", text.chars().take(80).collect::<String>())
    } else {
        text
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn diff_reports_changes_additions_and_removals() {
        let a = json!({"result":{"content":[{"text":"hi"}],"old":1}});
        let b = json!({"result":{"content":[{"text":"bye"},{"text":"x"}],"new":2}});
        let d = diff(&a, &b);
        assert!(d.contains(&"~ result.content[0].text: \"hi\" -> \"bye\"".to_string()));
        assert!(d.contains(&"+ result.content[1]: {\"text\":\"x\"}".to_string()));
        assert!(d.contains(&"- result.old: 1".to_string()));
        assert!(d.contains(&"+ result.new: 2".to_string()));
        assert!(diff(&a, &a).is_empty());
    }

    #[test]
    fn normalize_drops_envelope_and_ignored_keys() {
        let body = json!({"jsonrpc":"2.0","id":4,"result":{"ts":1,"v":{"ts":2,"k":3}}});
        assert_eq!(
            normalize(&body, &["ts".to_string()]),
            json!({"result":{"v":{"k":3}}})
        );
    }
}
