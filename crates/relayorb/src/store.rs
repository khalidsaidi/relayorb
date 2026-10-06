//! Recording storage: a local SQLite database, plus portable JSON session files.

use std::path::{Path, PathBuf};

use anyhow::{anyhow, bail, Context, Result};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::message::{self, Direction, Kind, Message};

pub const FIXTURE_FORMAT: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionMeta {
    pub id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    pub command: Vec<String>,
    pub started_at_ms: i64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ended_at_ms: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub exit_code: Option<i64>,
}

#[derive(Debug, Clone)]
pub struct Recorded {
    pub seq: i64,
    pub ts_ms: i64,
    pub direction: Direction,
    pub message: Message,
}

#[derive(Debug, Clone)]
pub struct Session {
    pub meta: SessionMeta,
    pub messages: Vec<Recorded>,
}

/// A request paired with the response that answered it (if any arrived).
pub struct Exchange<'a> {
    pub request: &'a Recorded,
    pub response: Option<&'a Recorded>,
}

impl Session {
    /// Pair each request with the first later response travelling the other way with the same id.
    pub fn exchanges(&self) -> Vec<Exchange<'_>> {
        let mut used = vec![false; self.messages.len()];
        let mut out = Vec::new();
        for (i, req) in self.messages.iter().enumerate() {
            if req.message.kind != Kind::Request {
                continue;
            }
            let response = self.messages[i + 1..]
                .iter()
                .enumerate()
                .find(|(j, res)| {
                    !used[i + 1 + j]
                        && res.message.kind == Kind::Response
                        && res.direction == req.direction.opposite()
                        && res.message.rpc_id == req.message.rpc_id
                })
                .map(|(j, res)| {
                    used[i + 1 + j] = true;
                    res
                });
            out.push(Exchange {
                request: req,
                response,
            });
        }
        out
    }
}

pub fn default_db_path() -> PathBuf {
    let home = std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."));
    home.join(".relayorb").join("recordings.db")
}

pub struct Store {
    conn: Connection,
}

impl Store {
    pub fn open(path: &Path) -> Result<Self> {
        if let Some(parent) = path.parent() {
            if !parent.as_os_str().is_empty() {
                std::fs::create_dir_all(parent)
                    .with_context(|| format!("creating {}", parent.display()))?;
            }
        }
        let conn = Connection::open(path).with_context(|| format!("opening {}", path.display()))?;
        // Agents often start several servers at once, each wrapped in its own recorder.
        conn.busy_timeout(std::time::Duration::from_secs(10))?;
        conn.pragma_update(None, "journal_mode", "WAL")?;
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS sessions (
               id TEXT PRIMARY KEY,
               name TEXT,
               command TEXT NOT NULL,
               started_at_ms INTEGER NOT NULL,
               ended_at_ms INTEGER,
               exit_code INTEGER
             );
             CREATE TABLE IF NOT EXISTS messages (
               session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
               seq INTEGER NOT NULL,
               ts_ms INTEGER NOT NULL,
               direction TEXT NOT NULL,
               kind TEXT NOT NULL,
               method TEXT,
               rpc_id TEXT,
               body TEXT NOT NULL,
               PRIMARY KEY (session_id, seq)
             );
             CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at_ms);",
        )?;
        Ok(Self { conn })
    }

    pub fn create_session(&self, meta: &SessionMeta) -> Result<()> {
        self.conn.execute(
            "INSERT INTO sessions (id, name, command, started_at_ms) VALUES (?1, ?2, ?3, ?4)",
            params![
                meta.id,
                meta.name,
                serde_json::to_string(&meta.command)?,
                meta.started_at_ms
            ],
        )?;
        Ok(())
    }

    pub fn insert_message(&self, session_id: &str, rec: &Recorded) -> Result<()> {
        let body = match rec.message.kind {
            Kind::Invalid if rec.message.body.is_null() => rec.message.raw.clone(),
            _ => rec.message.body.to_string(),
        };
        self.conn.execute(
            "INSERT INTO messages (session_id, seq, ts_ms, direction, kind, method, rpc_id, body)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                session_id,
                rec.seq,
                rec.ts_ms,
                rec.direction.as_str(),
                rec.message.kind.as_str(),
                rec.message.method,
                rec.message.rpc_id,
                body
            ],
        )?;
        Ok(())
    }

    pub fn finish_session(&self, id: &str, ended_at_ms: i64, exit_code: Option<i64>) -> Result<()> {
        self.conn.execute(
            "UPDATE sessions SET ended_at_ms = ?2, exit_code = ?3 WHERE id = ?1",
            params![id, ended_at_ms, exit_code],
        )?;
        Ok(())
    }

    /// Sessions newest first, with their message counts.
    pub fn list(&self, limit: usize) -> Result<Vec<(SessionMeta, i64)>> {
        let mut stmt = self.conn.prepare(
            "SELECT s.id, s.name, s.command, s.started_at_ms, s.ended_at_ms, s.exit_code,
                    (SELECT COUNT(*) FROM messages m WHERE m.session_id = s.id)
             FROM sessions s ORDER BY s.started_at_ms DESC LIMIT ?1",
        )?;
        let rows = stmt.query_map(params![limit as i64], |row| {
            Ok((meta_from_row(row)?, row.get::<_, i64>(6)?))
        })?;
        Ok(rows.collect::<Result<_, _>>()?)
    }

    /// Resolve a session name (newest session with that name), full id, or unique id prefix.
    pub fn resolve_id(&self, prefix: &str) -> Result<String> {
        // `name~N`: the Nth run before the newest session with that name (`name~0` = newest).
        let (name, offset) = match prefix.rsplit_once('~') {
            Some((name, n)) if !name.is_empty() && n.parse::<u32>().is_ok() => {
                (name, n.parse::<u32>().unwrap_or(0))
            }
            _ => (prefix, 0),
        };
        let by_name: Option<String> = self
            .conn
            .query_row(
                "SELECT id FROM sessions WHERE name = ?1 ORDER BY started_at_ms DESC LIMIT 1 OFFSET ?2",
                params![name, offset],
                |row| row.get(0),
            )
            .optional()?;
        if by_name.is_none() && offset > 0 {
            bail!(
                "there is no run '{prefix}': fewer than {} recorded sessions named '{name}'",
                offset + 1
            );
        }
        if let Some(id) = by_name {
            return Ok(id);
        }
        let mut stmt = self
            .conn
            .prepare("SELECT id FROM sessions WHERE id LIKE ?1 || '%' ESCAPE '\\' LIMIT 2")?;
        let escaped = prefix
            .replace('\\', "\\\\")
            .replace('%', "\\%")
            .replace('_', "\\_");
        let ids: Vec<String> = stmt
            .query_map(params![escaped], |row| row.get(0))?
            .collect::<Result<_, _>>()?;
        match ids.as_slice() {
            [id] => Ok(id.clone()),
            [] => bail!("no recorded session matches '{prefix}' (see `relayorb list`)"),
            _ => bail!("'{prefix}' matches more than one session; use more characters"),
        }
    }

    pub fn load(&self, prefix: &str) -> Result<Session> {
        let id = self.resolve_id(prefix)?;
        let meta = self
            .conn
            .query_row(
                "SELECT id, name, command, started_at_ms, ended_at_ms, exit_code FROM sessions WHERE id = ?1",
                params![id],
                meta_from_row,
            )
            .optional()?
            .ok_or_else(|| anyhow!("session {id} disappeared"))?;
        let mut stmt = self.conn.prepare(
            "SELECT seq, ts_ms, direction, kind, method, rpc_id, body
             FROM messages WHERE session_id = ?1 ORDER BY seq",
        )?;
        let rows = stmt.query_map(params![id], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, Option<String>>(4)?,
                row.get::<_, Option<String>>(5)?,
                row.get::<_, String>(6)?,
            ))
        })?;
        let mut messages = Vec::new();
        for row in rows {
            let (seq, ts_ms, direction, kind, method, rpc_id, body) = row?;
            let direction = Direction::parse(&direction)
                .ok_or_else(|| anyhow!("bad direction '{direction}' in session {id}"))?;
            let kind = Kind::parse(&kind);
            let parsed = serde_json::from_str::<Value>(&body).ok();
            let message = Message {
                kind,
                method,
                rpc_id,
                body: parsed.clone().unwrap_or(Value::Null),
                raw: body,
            };
            messages.push(Recorded {
                seq,
                ts_ms,
                direction,
                message,
            });
        }
        Ok(Session { meta, messages })
    }

    pub fn delete(&self, id: &str) -> Result<()> {
        self.conn
            .execute("DELETE FROM messages WHERE session_id = ?1", params![id])?;
        self.conn
            .execute("DELETE FROM sessions WHERE id = ?1", params![id])?;
        Ok(())
    }
}

fn meta_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<SessionMeta> {
    let command: String = row.get(2)?;
    Ok(SessionMeta {
        id: row.get(0)?,
        name: row.get(1)?,
        command: serde_json::from_str(&command).unwrap_or_else(|_| vec![command]),
        started_at_ms: row.get(3)?,
        ended_at_ms: row.get(4)?,
        exit_code: row.get(5)?,
    })
}

// ---- Portable session files -------------------------------------------------

#[derive(Serialize, Deserialize)]
struct FixtureFile {
    relayorb: u32,
    session: SessionMeta,
    messages: Vec<FixtureMessage>,
}

#[derive(Serialize, Deserialize)]
struct FixtureMessage {
    seq: i64,
    ts_ms: i64,
    direction: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    body: Option<Value>,
    /// Verbatim text for frames that were not valid JSON.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    raw: Option<String>,
}

pub fn to_fixture_json(session: &Session) -> Result<String> {
    let file = FixtureFile {
        relayorb: FIXTURE_FORMAT,
        session: session.meta.clone(),
        messages: session
            .messages
            .iter()
            .map(|rec| {
                let is_raw = rec.message.kind == Kind::Invalid && rec.message.body.is_null();
                FixtureMessage {
                    seq: rec.seq,
                    ts_ms: rec.ts_ms,
                    direction: rec.direction.as_str().to_string(),
                    body: (!is_raw).then(|| rec.message.body.clone()),
                    raw: is_raw.then(|| rec.message.raw.clone()),
                }
            })
            .collect(),
    };
    Ok(serde_json::to_string_pretty(&file)? + "\n")
}

pub fn from_fixture_json(text: &str) -> Result<Session> {
    let file: FixtureFile = serde_json::from_str(text).context("not a relayorb session file")?;
    if file.relayorb != FIXTURE_FORMAT {
        bail!(
            "session file format {} is not supported (expected {FIXTURE_FORMAT})",
            file.relayorb
        );
    }
    let mut messages = Vec::with_capacity(file.messages.len());
    for m in file.messages {
        let direction = Direction::parse(&m.direction)
            .ok_or_else(|| anyhow!("bad direction '{}' at seq {}", m.direction, m.seq))?;
        let message = match (m.body, m.raw) {
            (Some(body), _) => message::classify(body),
            (None, raw) => Message {
                kind: Kind::Invalid,
                method: None,
                rpc_id: None,
                body: Value::Null,
                raw: raw.unwrap_or_default(),
            },
        };
        messages.push(Recorded {
            seq: m.seq,
            ts_ms: m.ts_ms,
            direction,
            message,
        });
    }
    Ok(Session {
        meta: file.session,
        messages,
    })
}

/// Load a session from a JSON file (if `reference` is an existing path) or from the database.
pub fn load_session(db_path: &Path, reference: &str) -> Result<Session> {
    let path = Path::new(reference);
    if path.is_file() {
        let text = std::fs::read_to_string(path).with_context(|| format!("reading {reference}"))?;
        return from_fixture_json(&text).with_context(|| format!("loading {reference}"));
    }
    if !db_path.exists() {
        bail!(
            "'{reference}' is not a file, and there is no recordings database at {} yet",
            db_path.display()
        );
    }
    Store::open(db_path)?.load(reference)
}

pub fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rec(seq: i64, dir: Direction, line: &str) -> Recorded {
        Recorded {
            seq,
            ts_ms: seq * 10,
            direction: dir,
            message: message::parse_line(line).remove(0),
        }
    }

    fn sample() -> Session {
        Session {
            meta: SessionMeta {
                id: "abc".into(),
                name: Some("t".into()),
                command: vec!["srv".into()],
                started_at_ms: 0,
                ended_at_ms: Some(100),
                exit_code: Some(0),
            },
            messages: vec![
                rec(
                    0,
                    Direction::ClientToServer,
                    r#"{"jsonrpc":"2.0","id":1,"method":"tools/list"}"#,
                ),
                rec(
                    1,
                    Direction::ClientToServer,
                    r#"{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"x"}}"#,
                ),
                rec(
                    2,
                    Direction::ServerToClient,
                    r#"{"jsonrpc":"2.0","id":2,"result":{"b":1}}"#,
                ),
                rec(
                    3,
                    Direction::ServerToClient,
                    r#"{"jsonrpc":"2.0","id":1,"result":{"a":1}}"#,
                ),
                rec(4, Direction::ServerToClient, "garbage"),
            ],
        }
    }

    #[test]
    fn pairs_out_of_order_responses() {
        let s = sample();
        let ex = s.exchanges();
        assert_eq!(ex.len(), 2);
        assert_eq!(ex[0].response.unwrap().seq, 3);
        assert_eq!(ex[1].response.unwrap().seq, 2);
    }

    #[test]
    fn fixture_round_trip() {
        let s = sample();
        let text = to_fixture_json(&s).unwrap();
        let back = from_fixture_json(&text).unwrap();
        assert_eq!(back.messages.len(), 5);
        assert_eq!(back.messages[4].message.raw, "garbage");
        assert_eq!(back.messages[4].message.kind, Kind::Invalid);
        assert_eq!(back.exchanges().len(), 2);
    }

    #[test]
    fn db_round_trip_and_prefix() {
        let dir = tempfile::tempdir().unwrap();
        let store = Store::open(&dir.path().join("r.db")).unwrap();
        let s = sample();
        store.create_session(&s.meta).unwrap();
        for m in &s.messages {
            store.insert_message("abc", m).unwrap();
        }
        store.finish_session("abc", 100, Some(0)).unwrap();
        let back = store.load("ab").unwrap();
        assert_eq!(store.load("t").unwrap().meta.id, "abc"); // by name
        assert_eq!(back.messages.len(), 5);
        assert_eq!(back.messages[4].message.raw, "garbage");
        assert_eq!(store.list(10).unwrap()[0].1, 5);
        assert!(store.load("zz").is_err());
    }
}
