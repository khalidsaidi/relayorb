//! `relayorb diff`: compare two recorded runs and find the first tool call where they diverge.
//!
//! Runs are compared call by call in order (agent-to-server requests, except `initialize` and
//! `ping`). For each position the first difference wins: a different method or tool, then
//! different arguments, then a different answer. Host and server versions come from each run's
//! `initialize` exchange, so "what changed" includes the client build.

use std::collections::BTreeMap;

use anyhow::Result;
use serde_json::{json, Value};

use crate::check;
use crate::message::{self, Direction};
use crate::store::{Recorded, Session};

const SKIPPED_METHODS: &[&str] = &["initialize", "ping"];

pub struct Options {
    pub ignore_keys: Vec<String>,
    pub all: bool,
    pub json: bool,
}

#[derive(Debug, Clone)]
struct Step {
    label: String,
    params: Value,
    answer: Option<Value>,
    status: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Kind {
    Call,
    Arguments,
    Result,
    OnlyInA,
    OnlyInB,
}

impl Kind {
    fn as_str(self) -> &'static str {
        match self {
            Kind::Call => "different_call",
            Kind::Arguments => "different_arguments",
            Kind::Result => "different_result",
            Kind::OnlyInA => "only_in_a",
            Kind::OnlyInB => "only_in_b",
        }
    }

    fn describe(self) -> &'static str {
        match self {
            Kind::Call => "a different tool or method was called",
            Kind::Arguments => "same tool, different arguments",
            Kind::Result => "same call, different answer",
            Kind::OnlyInA => "run B stopped here; run A kept going",
            Kind::OnlyInB => "run A stopped here; run B kept going",
        }
    }
}

struct Difference {
    /// 1-based call number.
    call: usize,
    kind: Kind,
    details: Vec<String>,
}

pub struct RunInfo {
    pub client: Option<String>,
    pub server: Option<String>,
    pub protocol: Option<String>,
}

pub fn run_info(session: &Session) -> RunInfo {
    let init = session.exchanges().into_iter().find(|ex| {
        ex.request.direction == Direction::ClientToServer
            && ex.request.message.method.as_deref() == Some("initialize")
    });
    let name_version = |v: Option<&Value>| {
        v.map(|info| {
            let name = info.get("name").and_then(Value::as_str).unwrap_or("?");
            match info.get("version").and_then(Value::as_str) {
                Some(version) => format!("{name} {version}"),
                None => name.to_string(),
            }
        })
    };
    RunInfo {
        client: init
            .as_ref()
            .and_then(|ex| name_version(ex.request.message.body.pointer("/params/clientInfo"))),
        server: init.as_ref().and_then(|ex| {
            name_version(
                ex.response
                    .and_then(|r| r.message.body.pointer("/result/serverInfo")),
            )
        }),
        protocol: init.as_ref().and_then(|ex| {
            ex.request
                .message
                .body
                .pointer("/params/protocolVersion")
                .and_then(Value::as_str)
                .map(str::to_string)
        }),
    }
}

fn status(response: Option<&Recorded>) -> String {
    let Some(res) = response else {
        return "no answer".into();
    };
    let body = &res.message.body;
    if body.get("error").is_some() {
        "error".into()
    } else if body.pointer("/result/isError") == Some(&Value::Bool(true)) {
        "tool error".into()
    } else {
        "ok".into()
    }
}

fn steps(session: &Session, ignore_keys: &[String]) -> Vec<Step> {
    session
        .exchanges()
        .into_iter()
        .filter(|ex| {
            ex.request.direction == Direction::ClientToServer
                && !SKIPPED_METHODS.contains(&ex.request.message.method.as_deref().unwrap_or(""))
        })
        .map(|ex| {
            let method = ex.request.message.method.clone().unwrap_or_default();
            let body = &ex.request.message.body;
            Step {
                label: message::label(&method, body.get("params")),
                params: message::match_params(body),
                answer: ex
                    .response
                    .map(|r| check::normalize(&r.message.body, ignore_keys)),
                status: status(ex.response),
            }
        })
        .collect()
}

fn compare(a: &[Step], b: &[Step]) -> Vec<Difference> {
    let mut out = Vec::new();
    for i in 0..a.len().max(b.len()) {
        let call = i + 1;
        match (a.get(i), b.get(i)) {
            (Some(sa), Some(sb)) => {
                if sa.label != sb.label {
                    out.push(Difference {
                        call,
                        kind: Kind::Call,
                        details: vec![format!("A: {}", sa.label), format!("B: {}", sb.label)],
                    });
                } else if sa.params != sb.params {
                    out.push(Difference {
                        call,
                        kind: Kind::Arguments,
                        details: check::diff(&sa.params, &sb.params),
                    });
                } else if sa.answer != sb.answer {
                    let details = match (&sa.answer, &sb.answer) {
                        (Some(x), Some(y)) => check::diff(x, y),
                        _ => vec![format!("A: {}  B: {}", sa.status, sb.status)],
                    };
                    out.push(Difference {
                        call,
                        kind: Kind::Result,
                        details,
                    });
                }
            }
            (Some(sa), None) => out.push(Difference {
                call,
                kind: Kind::OnlyInA,
                details: vec![format!("A: {}", sa.label)],
            }),
            (None, Some(sb)) => out.push(Difference {
                call,
                kind: Kind::OnlyInB,
                details: vec![format!("B: {}", sb.label)],
            }),
            (None, None) => {}
        }
    }
    out
}

/// How many times each tool/method was called, for the "tools used" summary.
fn tally(steps: &[Step]) -> BTreeMap<String, usize> {
    let mut counts = BTreeMap::new();
    for s in steps {
        *counts.entry(s.label.clone()).or_insert(0) += 1;
    }
    counts
}

fn short_id(session: &Session) -> String {
    let id = &session.meta.id;
    let short = id.get(..8).unwrap_or(id);
    match &session.meta.name {
        Some(name) => format!("{short} ({name})"),
        None => short.to_string(),
    }
}

fn compact(value: &Value) -> String {
    let text = value.to_string();
    if text.chars().count() > 70 {
        format!("{}…", text.chars().take(70).collect::<String>())
    } else {
        text
    }
}

pub fn run(a: Session, b: Session, opts: Options) -> Result<i32> {
    let (info_a, info_b) = (run_info(&a), run_info(&b));
    let (steps_a, steps_b) = (steps(&a, &opts.ignore_keys), steps(&b, &opts.ignore_keys));
    let differences = compare(&steps_a, &steps_b);
    let identical = differences.is_empty();

    if opts.json {
        let step_json = |s: Option<&Step>| {
            s.map(|s| json!({"label": s.label, "params": s.params, "status": s.status, "answer": s.answer}))
        };
        let diff_json = |d: &Difference| {
            json!({
                "call": d.call,
                "kind": d.kind.as_str(),
                "details": d.details,
                "a": step_json(steps_a.get(d.call - 1)),
                "b": step_json(steps_b.get(d.call - 1)),
            })
        };
        let run_json = |s: &Session, info: &RunInfo, n: usize| {
            json!({
                "id": s.meta.id,
                "name": s.meta.name,
                "client": info.client,
                "server": info.server,
                "protocol_version": info.protocol,
                "calls": n,
            })
        };
        let out = json!({
            "identical": identical,
            "a": run_json(&a, &info_a, steps_a.len()),
            "b": run_json(&b, &info_b, steps_b.len()),
            "first_divergence": differences.first().map(diff_json),
            "differences": differences.iter().map(diff_json).collect::<Vec<_>>(),
        });
        println!("{}", serde_json::to_string_pretty(&out)?);
        return Ok(if identical { 0 } else { 1 });
    }

    println!("relayorb diff: A = {}   B = {}", short_id(&a), short_id(&b));
    let row = |label: &str, x: Option<&str>, y: Option<&str>| {
        let (x, y) = (x.unwrap_or("-"), y.unwrap_or("-"));
        let mark = if x == y { "" } else { "   <- differs" };
        println!("  {label:<9} A: {x:<32} B: {y}{mark}");
    };
    row("client", info_a.client.as_deref(), info_b.client.as_deref());
    row("server", info_a.server.as_deref(), info_b.server.as_deref());
    row(
        "protocol",
        info_a.protocol.as_deref(),
        info_b.protocol.as_deref(),
    );
    println!("  calls     A: {:<32} B: {}", steps_a.len(), steps_b.len());
    println!();

    let Some(first) = differences.first() else {
        println!("No divergence: same calls, same arguments, same answers.");
        return Ok(0);
    };

    println!(
        "First divergence at call #{} ({} matching call{} before it): {}",
        first.call,
        first.call - 1,
        if first.call == 2 { "" } else { "s" },
        first.kind.describe()
    );
    let show_side = |side: &str, step: Option<&Step>| match step {
        Some(s) => println!(
            "  {side}: {:<36} {}  [{}]",
            s.label,
            compact(&s.params),
            s.status
        ),
        None => println!("  {side}: (no call)"),
    };
    show_side("A", steps_a.get(first.call - 1));
    show_side("B", steps_b.get(first.call - 1));
    for line in first.details.iter().take(8) {
        println!("     {line}");
    }

    let (tally_a, tally_b) = (tally(&steps_a), tally(&steps_b));
    let mut changed = Vec::new();
    for label in tally_a
        .keys()
        .chain(tally_b.keys())
        .collect::<std::collections::BTreeSet<_>>()
    {
        let (x, y) = (
            tally_a.get(label).copied().unwrap_or(0),
            tally_b.get(label).copied().unwrap_or(0),
        );
        if x != y {
            changed.push(format!("{label}: A {x}x, B {y}x"));
        }
    }
    if !changed.is_empty() {
        println!();
        println!("Tools used differently:");
        for line in changed {
            println!("  {line}");
        }
    }

    if differences.len() > 1 {
        println!();
        if opts.all {
            println!("All differences:");
            for d in &differences {
                println!("  call #{:<3} {}", d.call, d.kind.describe());
                for line in d.details.iter().take(4) {
                    println!("       {line}");
                }
            }
        } else {
            println!(
                "{} more difference{} after this (use --all to list them).",
                differences.len() - 1,
                if differences.len() == 2 { "" } else { "s" }
            );
        }
    }
    Ok(1)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn step(label: &str, params: Value, answer: Value) -> Step {
        Step {
            label: label.into(),
            params,
            answer: Some(answer),
            status: "ok".into(),
        }
    }

    #[test]
    fn finds_first_divergence_by_kind() {
        let a = vec![
            step("tools/list", json!(null), json!({"result": {"tools": [1]}})),
            step(
                "tools/call read",
                json!({"name": "read", "arguments": {"p": "a"}}),
                json!({"result": 1}),
            ),
            step(
                "tools/call write",
                json!({"name": "write"}),
                json!({"result": 2}),
            ),
        ];

        let mut b = a.clone();
        assert!(compare(&a, &b).is_empty());

        b[1].params = json!({"name": "read", "arguments": {"p": "b"}});
        let d = compare(&a, &b);
        assert_eq!(d[0].call, 2);
        assert_eq!(d[0].kind, Kind::Arguments);
        assert!(d[0].details[0].contains("arguments.p"));

        let mut c = a.clone();
        c[0].answer = Some(json!({"result": {"tools": []}}));
        assert_eq!(compare(&a, &c)[0].kind, Kind::Result);

        let mut e = a.clone();
        e[2].label = "tools/call delete".into();
        assert_eq!(compare(&a, &e)[0].kind, Kind::Call);

        let f = a[..2].to_vec();
        let d = compare(&a, &f);
        assert_eq!((d[0].call, d[0].kind), (3, Kind::OnlyInA));
        assert_eq!(compare(&f, &a)[0].kind, Kind::OnlyInB);
    }
}
