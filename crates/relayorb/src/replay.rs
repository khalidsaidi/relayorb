//! `relayorb replay`: act as an MCP server that answers from a recorded session.
//!
//! Matching, per incoming request:
//! 1. same method and same params (key order and `_meta` ignored), in recorded order;
//! 2. otherwise the same method (and same tool/prompt/resource name), in recorded order;
//! 3. once a group is used up, its last answer is repeated.
//!
//! The recorded answer is sent back with the live request's id.

use std::collections::HashMap;

use anyhow::Result;
use serde_json::{json, Value};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};

use crate::message::{self, Direction, Kind};
use crate::store::Session;

#[derive(Default)]
struct Queue {
    answers: Vec<Value>,
    next: usize,
}

impl Queue {
    fn take(&mut self) -> Option<Value> {
        let answer = self.answers.get(self.next).or(self.answers.last())?.clone();
        self.next = (self.next + 1).min(self.answers.len());
        Some(answer)
    }
}

pub struct Replayer {
    exact: HashMap<String, Queue>,
    loose: HashMap<String, Queue>,
}

impl Replayer {
    pub fn new(session: &Session) -> Self {
        let mut exact: HashMap<String, Queue> = HashMap::new();
        let mut loose: HashMap<String, Queue> = HashMap::new();
        for ex in session.exchanges() {
            // Only answers the server gave to the agent; requests the server made are not replayed.
            if ex.request.direction != Direction::ClientToServer {
                continue;
            }
            let (Some(method), Some(response)) = (&ex.request.message.method, ex.response) else {
                continue;
            };
            let body = &ex.request.message.body;
            let answer = response.message.body.clone();
            exact
                .entry(message::match_key(method, body))
                .or_default()
                .answers
                .push(answer.clone());
            loose
                .entry(loose_key(method, body))
                .or_default()
                .answers
                .push(answer);
        }
        Self { exact, loose }
    }

    /// Answer one request; `None` for notifications and responses (nothing to send).
    pub fn answer(&mut self, msg: &message::Message) -> Option<Value> {
        if msg.kind != Kind::Request {
            return None;
        }
        let method = msg.method.as_deref()?;
        let id = msg.body.get("id").cloned().unwrap_or(Value::Null);

        let mut exact_hit = None;
        if let Some(queue) = self.exact.get_mut(&message::match_key(method, &msg.body)) {
            exact_hit = queue.take();
        }
        let recorded = exact_hit.or_else(|| {
            self.loose
                .get_mut(&loose_key(method, &msg.body))
                .and_then(Queue::take)
        });

        Some(match recorded {
            Some(mut answer) => {
                if let Value::Object(map) = &mut answer {
                    map.insert("id".into(), id);
                }
                answer
            }
            None if method == "ping" => json!({"jsonrpc": "2.0", "id": id, "result": {}}),
            None => json!({
                "jsonrpc": "2.0",
                "id": id,
                "error": {
                    "code": -32601,
                    "message": format!(
                        "relayorb replay: no recorded answer for {}",
                        message::label(method, msg.body.get("params"))
                    ),
                }
            }),
        })
    }
}

fn loose_key(method: &str, body: &Value) -> String {
    message::label(method, body.get("params"))
}

pub async fn run(session: Session) -> Result<i32> {
    let mut replayer = Replayer::new(&session);
    let short = session.meta.id.get(..8).unwrap_or(&session.meta.id);
    eprintln!("relayorb: replaying session {short}");

    let mut lines = BufReader::new(tokio::io::stdin()).lines();
    let mut stdout = tokio::io::stdout();
    while let Some(line) = lines.next_line().await? {
        let trimmed = line.trim();
        let is_batch = trimmed.starts_with('[');
        let answers: Vec<Value> = message::parse_line(trimmed)
            .iter()
            .filter_map(|msg| replayer.answer(msg))
            .collect();
        let out = match (is_batch, answers.len()) {
            (_, 0) => continue,
            (true, _) => Value::Array(answers).to_string(),
            (false, _) => answers[0].to_string(),
        };
        stdout.write_all(out.as_bytes()).await?;
        stdout.write_all(b"\n").await?;
        stdout.flush().await?;
    }
    Ok(0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::store::{Recorded, SessionMeta};

    fn session(lines: &[(Direction, &str)]) -> Session {
        Session {
            meta: SessionMeta {
                id: "s".into(),
                name: None,
                command: vec![],
                started_at_ms: 0,
                ended_at_ms: None,
                exit_code: None,
            },
            messages: lines
                .iter()
                .enumerate()
                .map(|(i, (d, l))| Recorded {
                    seq: i as i64,
                    ts_ms: 0,
                    direction: *d,
                    message: message::parse_line(l).remove(0),
                })
                .collect(),
        }
    }

    fn ask(r: &mut Replayer, line: &str) -> Value {
        r.answer(&message::parse_line(line).remove(0)).unwrap()
    }

    #[test]
    fn replays_exact_then_loose_then_last() {
        use Direction::*;
        let s = session(&[
            (
                ClientToServer,
                r#"{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"add","arguments":{"a":1}}}"#,
            ),
            (
                ServerToClient,
                r#"{"jsonrpc":"2.0","id":1,"result":{"v":"one"}}"#,
            ),
            (
                ClientToServer,
                r#"{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"add","arguments":{"a":2}}}"#,
            ),
            (
                ServerToClient,
                r#"{"jsonrpc":"2.0","id":2,"result":{"v":"two"}}"#,
            ),
        ]);
        let mut r = Replayer::new(&s);
        // Exact match wins even out of order, and gets the live id.
        let a = ask(
            &mut r,
            r#"{"jsonrpc":"2.0","id":"x","method":"tools/call","params":{"arguments":{"a":2},"name":"add"}}"#,
        );
        assert_eq!(a, json!({"jsonrpc":"2.0","id":"x","result":{"v":"two"}}));
        // Unknown args fall back to same tool name, in order.
        let b = ask(
            &mut r,
            r#"{"jsonrpc":"2.0","id":9,"method":"tools/call","params":{"name":"add","arguments":{"a":5}}}"#,
        );
        assert_eq!(b["result"]["v"], "one");
        // Unknown tool is an error, not a hang.
        let c = ask(
            &mut r,
            r#"{"jsonrpc":"2.0","id":10,"method":"tools/call","params":{"name":"nope"}}"#,
        );
        assert_eq!(c["error"]["code"], -32601);
        assert!(c["error"]["message"]
            .as_str()
            .unwrap()
            .contains("tools/call nope"));
        // Ping always works; notifications get no answer.
        assert_eq!(
            ask(&mut r, r#"{"jsonrpc":"2.0","id":11,"method":"ping"}"#)["result"],
            json!({})
        );
        assert!(r
            .answer(
                &message::parse_line(r#"{"jsonrpc":"2.0","method":"notifications/initialized"}"#)
                    .remove(0)
            )
            .is_none());
    }
}
