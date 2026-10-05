//! JSON-RPC message classification and canonical hashing for MCP traffic.

use serde_json::{Map, Value};
use sha2::{Digest, Sha256};

/// Which way a message travelled through the proxy.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Direction {
    /// Agent (MCP client) to tool server.
    ClientToServer,
    /// Tool server to agent (MCP client).
    ServerToClient,
}

impl Direction {
    pub fn as_str(self) -> &'static str {
        match self {
            Direction::ClientToServer => "c2s",
            Direction::ServerToClient => "s2c",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "c2s" => Some(Direction::ClientToServer),
            "s2c" => Some(Direction::ServerToClient),
            _ => None,
        }
    }

    pub fn opposite(self) -> Self {
        match self {
            Direction::ClientToServer => Direction::ServerToClient,
            Direction::ServerToClient => Direction::ClientToServer,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Kind {
    Request,
    Response,
    Notification,
    /// Not valid JSON-RPC (or not JSON at all). Recorded verbatim.
    Invalid,
}

impl Kind {
    pub fn as_str(self) -> &'static str {
        match self {
            Kind::Request => "request",
            Kind::Response => "response",
            Kind::Notification => "notification",
            Kind::Invalid => "invalid",
        }
    }

    pub fn parse(value: &str) -> Self {
        match value {
            "request" => Kind::Request,
            "response" => Kind::Response,
            "notification" => Kind::Notification,
            _ => Kind::Invalid,
        }
    }
}

/// One JSON-RPC message as seen on the wire.
#[derive(Debug, Clone)]
pub struct Message {
    pub kind: Kind,
    pub method: Option<String>,
    /// The JSON-RPC id serialized as compact JSON (so `1` and `"1"` stay distinct).
    pub rpc_id: Option<String>,
    pub body: Value,
    /// Raw text, kept for lines that are not valid JSON.
    pub raw: String,
}

/// Parse one newline-delimited frame. A JSON array (JSON-RPC batch) yields one message per element.
pub fn parse_line(line: &str) -> Vec<Message> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return Vec::new();
    }
    match serde_json::from_str::<Value>(trimmed) {
        Ok(Value::Array(items)) if !items.is_empty() => items.into_iter().map(classify).collect(),
        Ok(value) => vec![classify(value)],
        Err(_) => vec![Message {
            kind: Kind::Invalid,
            method: None,
            rpc_id: None,
            body: Value::Null,
            raw: trimmed.to_string(),
        }],
    }
}

pub fn classify(value: Value) -> Message {
    let raw = value.to_string();
    let Some(obj) = value.as_object() else {
        return Message {
            kind: Kind::Invalid,
            method: None,
            rpc_id: None,
            body: value,
            raw,
        };
    };
    let method = obj
        .get("method")
        .and_then(Value::as_str)
        .map(str::to_string);
    let rpc_id = obj
        .get("id")
        .filter(|id| !id.is_null())
        .map(|id| id.to_string());
    let kind = match (&method, &rpc_id) {
        (Some(_), Some(_)) => Kind::Request,
        (Some(_), None) => Kind::Notification,
        (None, Some(_)) if obj.contains_key("result") || obj.contains_key("error") => {
            Kind::Response
        }
        _ => Kind::Invalid,
    };
    Message {
        kind,
        method,
        rpc_id,
        body: value,
        raw,
    }
}

/// Human label for a request: `tools/call read_file`, `resources/read file:///x`, or just the method.
pub fn label(method: &str, params: Option<&Value>) -> String {
    let detail = params.and_then(|p| match method {
        "tools/call" | "prompts/get" => p.get("name").and_then(Value::as_str),
        "resources/read" | "resources/subscribe" | "resources/unsubscribe" => {
            p.get("uri").and_then(Value::as_str)
        }
        _ => None,
    });
    match detail {
        Some(detail) => format!("{method} {detail}"),
        None => method.to_string(),
    }
}

/// Request params with transport-level noise (`_meta`, e.g. progress tokens) removed.
pub fn match_params(body: &Value) -> Value {
    let mut params = body.get("params").cloned().unwrap_or(Value::Null);
    if let Value::Object(map) = &mut params {
        map.remove("_meta");
    }
    params
}

/// Stable JSON text: object keys sorted recursively, no whitespace.
pub fn canonical_json(value: &Value) -> String {
    fn sort(value: &Value) -> Value {
        match value {
            Value::Object(map) => {
                let mut keys: Vec<&String> = map.keys().collect();
                keys.sort();
                let mut out = Map::new();
                for key in keys {
                    out.insert(key.clone(), sort(&map[key]));
                }
                Value::Object(out)
            }
            Value::Array(items) => Value::Array(items.iter().map(sort).collect()),
            other => other.clone(),
        }
    }
    sort(value).to_string()
}

pub fn sha256_hex(text: &str) -> String {
    hex::encode(Sha256::digest(text.as_bytes()))
}

/// Key used to match a live request against recorded ones: method + canonical params.
pub fn match_key(method: &str, body: &Value) -> String {
    sha256_hex(&format!(
        "{method}\n{}",
        canonical_json(&match_params(body))
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn classifies_messages() {
        let msgs = parse_line(r#"{"jsonrpc":"2.0","id":1,"method":"tools/list"}"#);
        assert_eq!(msgs[0].kind, Kind::Request);
        assert_eq!(msgs[0].rpc_id.as_deref(), Some("1"));

        let msgs = parse_line(r#"{"jsonrpc":"2.0","id":"1","result":{}}"#);
        assert_eq!(msgs[0].kind, Kind::Response);
        assert_eq!(msgs[0].rpc_id.as_deref(), Some("\"1\""));

        let msgs = parse_line(r#"{"jsonrpc":"2.0","method":"notifications/initialized"}"#);
        assert_eq!(msgs[0].kind, Kind::Notification);

        let msgs = parse_line("not json");
        assert_eq!(msgs[0].kind, Kind::Invalid);
        assert_eq!(msgs[0].raw, "not json");

        assert!(parse_line("   ").is_empty());
    }

    #[test]
    fn splits_batches() {
        let msgs =
            parse_line(r#"[{"jsonrpc":"2.0","id":1,"method":"a"},{"jsonrpc":"2.0","method":"b"}]"#);
        assert_eq!(msgs.len(), 2);
        assert_eq!(msgs[1].kind, Kind::Notification);
    }

    #[test]
    fn match_key_ignores_key_order_and_meta() {
        let a = json!({"method":"tools/call","params":{"name":"x","arguments":{"a":1,"b":2}}});
        let b = json!({"method":"tools/call","params":{"arguments":{"b":2,"a":1},"name":"x","_meta":{"progressToken":7}}});
        assert_eq!(match_key("tools/call", &a), match_key("tools/call", &b));
        let c = json!({"method":"tools/call","params":{"name":"x","arguments":{"a":2}}});
        assert_ne!(match_key("tools/call", &a), match_key("tools/call", &c));
    }

    #[test]
    fn labels_requests() {
        assert_eq!(
            label("tools/call", Some(&json!({"name":"read_file"}))),
            "tools/call read_file"
        );
        assert_eq!(label("tools/list", None), "tools/list");
    }
}
