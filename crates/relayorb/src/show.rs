//! `relayorb list`, `show`, and `export`.

use std::path::Path;

use anyhow::{Context, Result};
use serde_json::{json, Value};

use crate::message::{self, Direction, Kind};
use crate::store::{self, Recorded, Session, SessionMeta, Store};

pub fn list(db_path: &Path, limit: usize) -> Result<()> {
    if !db_path.exists() {
        println!("No recordings yet. Start one with `relayorb record -- <mcp server command>`.");
        return Ok(());
    }
    let sessions = Store::open(db_path)?.list(limit)?;
    if sessions.is_empty() {
        println!("No recordings yet. Start one with `relayorb record -- <mcp server command>`.");
        return Ok(());
    }
    println!(
        "{:<8}  {:<16}  {:<20}  {:>8}  {:>8}  COMMAND",
        "ID", "NAME", "STARTED (UTC)", "MESSAGES", "DURATION"
    );
    for (meta, count) in sessions {
        println!(
            "{:<8}  {:<16}  {:<20}  {:>8}  {:>8}  {}",
            &meta.id[..8.min(meta.id.len())],
            truncate(meta.name.as_deref().unwrap_or("-"), 16),
            format_utc(meta.started_at_ms),
            count,
            duration(&meta),
            truncate(&meta.command.join(" "), 60)
        );
    }
    Ok(())
}

pub fn show(session: &Session, as_json: bool) -> Result<()> {
    if as_json {
        println!("{}", serde_json::to_string_pretty(&timeline_json(session))?);
        return Ok(());
    }
    let meta = &session.meta;
    println!(
        "session {}{}  started {} UTC  ({}{})",
        &meta.id[..8.min(meta.id.len())],
        meta.name
            .as_deref()
            .map(|n| format!(" ({n})"))
            .unwrap_or_default(),
        format_utc(meta.started_at_ms),
        duration(meta),
        meta.exit_code
            .map(|c| format!(", exit {c}"))
            .unwrap_or_default()
    );
    println!("command: {}", meta.command.join(" "));
    println!();

    let exchanges = session.exchanges();
    let mut by_seq = std::collections::HashMap::new();
    for ex in &exchanges {
        by_seq.insert(ex.request.seq, ex.response);
    }
    for rec in &session.messages {
        let offset = (rec.ts_ms - meta.started_at_ms) as f64 / 1000.0;
        let arrow = match rec.direction {
            Direction::ClientToServer => "->",
            Direction::ServerToClient => "<-",
        };
        match rec.message.kind {
            Kind::Request => {
                let method = rec.message.method.as_deref().unwrap_or_default();
                let label = message::label(method, rec.message.body.get("params"));
                let response = by_seq.get(&rec.seq).copied().flatten();
                let (latency, status) = match response {
                    Some(res) => (format!("{}ms", res.ts_ms - rec.ts_ms), status(res)),
                    None => ("-".to_string(), "no answer".to_string()),
                };
                println!("{offset:>9.3}s  {arrow}  {label:<40} {latency:>8}  {status}");
            }
            Kind::Notification => {
                let method = rec.message.method.as_deref().unwrap_or_default();
                println!("{offset:>9.3}s  {arrow}  {method}");
            }
            Kind::Invalid => {
                println!(
                    "{offset:>9.3}s  {arrow}  (not JSON-RPC) {}",
                    truncate(&rec.message.raw, 60)
                );
            }
            Kind::Response => {}
        }
    }
    Ok(())
}

pub fn export(session: &Session, output: Option<&Path>) -> Result<()> {
    let text = store::to_fixture_json(session)?;
    match output {
        Some(path) => {
            std::fs::write(path, text).with_context(|| format!("writing {}", path.display()))?;
            eprintln!(
                "relayorb: wrote {} messages to {}",
                session.messages.len(),
                path.display()
            );
        }
        None => print!("{text}"),
    }
    Ok(())
}

fn status(res: &Recorded) -> String {
    let body = &res.message.body;
    if let Some(err) = body.get("error") {
        let msg = err
            .get("message")
            .and_then(Value::as_str)
            .unwrap_or("error");
        return format!("error: {}", truncate(msg, 60));
    }
    // MCP tool failures come back as a successful response with `isError: true`.
    if body.pointer("/result/isError") == Some(&Value::Bool(true)) {
        let text = body
            .pointer("/result/content/0/text")
            .and_then(Value::as_str)
            .unwrap_or("");
        return format!("tool error: {}", truncate(text, 60));
    }
    "ok".to_string()
}

fn timeline_json(session: &Session) -> Value {
    let start = session.meta.started_at_ms;
    let calls: Vec<Value> = session
        .exchanges()
        .iter()
        .map(|ex| {
            let req = &ex.request.message;
            let method = req.method.as_deref().unwrap_or_default();
            json!({
                "seq": ex.request.seq,
                "offset_ms": ex.request.ts_ms - start,
                "direction": ex.request.direction.as_str(),
                "method": method,
                "label": message::label(method, req.body.get("params")),
                "latency_ms": ex.response.map(|r| r.ts_ms - ex.request.ts_ms),
                "status": ex.response.map(status).unwrap_or_else(|| "no answer".into()),
                "params": req.body.get("params"),
                "response": ex.response.map(|r| &r.message.body),
            })
        })
        .collect();
    json!({ "session": session.meta, "calls": calls })
}

fn duration(meta: &SessionMeta) -> String {
    match meta.ended_at_ms {
        Some(end) => format!("{:.1}s", (end - meta.started_at_ms) as f64 / 1000.0),
        None => "running".to_string(),
    }
}

fn truncate(text: &str, max: usize) -> String {
    let flat = text.replace(['\n', '\r'], " ");
    if flat.chars().count() > max {
        format!("{}…", flat.chars().take(max - 1).collect::<String>())
    } else {
        flat
    }
}

/// `YYYY-MM-DD HH:MM:SS` in UTC, without pulling in a date library.
pub fn format_utc(ms: i64) -> String {
    let secs = ms.div_euclid(1000);
    let (days, rem) = (secs.div_euclid(86_400), secs.rem_euclid(86_400));
    // Civil-from-days (Howard Hinnant).
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = yoe + era * 400 + i64::from(month <= 2);
    format!(
        "{year:04}-{month:02}-{day:02} {:02}:{:02}:{:02}",
        rem / 3600,
        rem % 3600 / 60,
        rem % 60
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn formats_utc() {
        assert_eq!(format_utc(0), "1970-01-01 00:00:00");
        assert_eq!(format_utc(1_791_200_000_000), "2026-10-05 11:33:20");
        assert_eq!(format_utc(951_782_400_000), "2000-02-29 00:00:00");
    }
}
