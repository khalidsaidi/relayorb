//! End-to-end tests: drive the real binary against a mock stdio MCP server.

use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Output, Stdio};

use serde_json::{json, Value};

const BIN: &str = env!("CARGO_BIN_EXE_relayorb");

fn mock_server() -> Vec<String> {
    let script = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/mock_server.py");
    vec!["python3".into(), script.to_string_lossy().into_owned()]
}

fn relayorb(db: &Path) -> Command {
    let mut cmd = Command::new(BIN);
    cmd.arg("--db").arg(db);
    cmd
}

fn run(cmd: &mut Command) -> Output {
    cmd.output().expect("run relayorb")
}

fn stdout(out: &Output) -> String {
    String::from_utf8_lossy(&out.stdout).into_owned()
}

/// Send each request line, wait for its answer, and return all answers.
fn converse(mut child: std::process::Child, requests: &[Value]) -> (Vec<Value>, i32) {
    let mut stdin = child.stdin.take().unwrap();
    let mut reader = BufReader::new(child.stdout.take().unwrap());
    let mut answers = Vec::new();
    for req in requests {
        writeln!(stdin, "{req}").unwrap();
        stdin.flush().unwrap();
        if req.get("id").is_none() {
            continue;
        }
        // Skip server notifications until the response for this request arrives.
        loop {
            let mut line = String::new();
            assert!(
                reader.read_line(&mut line).unwrap() > 0,
                "server closed early"
            );
            let msg: Value = serde_json::from_str(&line).unwrap();
            // Answer server-initiated requests (sampling) like a real agent would.
            if msg.get("method").is_some() && msg.get("id").is_some() {
                let reply = json!({"jsonrpc":"2.0","id":msg["id"],"result":{"role":"assistant","content":{"type":"text","text":"hi from the agent"},"model":"test","stopReason":"endTurn"}});
                writeln!(stdin, "{reply}").unwrap();
                stdin.flush().unwrap();
                continue;
            }
            if msg.get("id") == req.get("id") {
                answers.push(msg);
                break;
            }
        }
    }
    drop(stdin);
    let status = child.wait().unwrap();
    (answers, status.code().unwrap_or(-1))
}

fn session_requests() -> Vec<Value> {
    vec![
        json!({"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"0"}}}),
        json!({"jsonrpc":"2.0","method":"notifications/initialized"}),
        json!({"jsonrpc":"2.0","id":2,"method":"tools/list"}),
        json!({"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"add","arguments":{"a":2,"b":3}}}),
        json!({"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"fail","arguments":{}}}),
    ]
}

fn record_session(db: &Path) -> String {
    let child = relayorb(db)
        .args(["record", "--name", "mock", "--"])
        .args(mock_server())
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .unwrap();
    let (answers, code) = converse(child, &session_requests());
    assert_eq!(code, 0);
    // The proxy is transparent: answers are the server's own.
    assert_eq!(answers[2]["result"]["content"][0]["text"], "5");
    assert_eq!(answers[3]["result"]["isError"], true);

    let list = stdout(&run(relayorb(db).arg("list")));
    let line = list.lines().find(|l| l.contains("mock")).expect("listed");
    line.split_whitespace().next().unwrap().to_string()
}

fn tmp_db() -> (tempfile::TempDir, PathBuf) {
    let dir = tempfile::tempdir().unwrap();
    let db = dir.path().join("rec.db");
    (dir, db)
}

#[test]
fn record_show_export_replay_check() {
    let (dir, db) = tmp_db();
    let id = record_session(&db);

    // show: every call, with outcomes.
    let shown = stdout(&run(relayorb(&db).args(["show", &id])));
    assert!(shown.contains("initialize"), "{shown}");
    assert!(shown.contains("tools/call add"), "{shown}");
    assert!(shown.contains("tool error: boom"), "{shown}");
    assert!(shown.contains("notifications/message"), "{shown}");

    let json_out: Value =
        serde_json::from_str(&stdout(&run(relayorb(&db).args(["show", &id, "--json"])))).unwrap();
    assert_eq!(json_out["calls"].as_array().unwrap().len(), 4);

    // export -> file, then replay from the file with no real server.
    let fixture = dir.path().join("session.json");
    let out = run(relayorb(&db).args(["export", &id, "-o"]).arg(&fixture));
    assert!(out.status.success());

    let child = Command::new(BIN)
        .arg("--db")
        .arg(dir.path().join("unused.db"))
        .arg("replay")
        .arg(&fixture)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .unwrap();
    let (answers, code) = converse(
        child,
        &[
            json!({"jsonrpc":"2.0","id":"a","method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"other","version":"9"}}}),
            json!({"jsonrpc":"2.0","method":"notifications/initialized"}),
            json!({"jsonrpc":"2.0","id":"b","method":"tools/call","params":{"arguments":{"b":3,"a":2},"name":"add"}}),
            json!({"jsonrpc":"2.0","id":"c","method":"tools/call","params":{"name":"missing"}}),
        ],
    );
    assert_eq!(code, 0);
    assert_eq!(answers[0]["id"], "a");
    assert_eq!(answers[0]["result"]["serverInfo"]["name"], "mock");
    assert_eq!(answers[1]["id"], "b");
    assert_eq!(answers[1]["result"]["content"][0]["text"], "5");
    assert_eq!(answers[2]["error"]["code"], -32601);

    // check: same server passes...
    let pass = run(relayorb(&db).args(["check", &id, "--"]).args(mock_server()));
    let text = stdout(&pass);
    assert_eq!(pass.status.code(), Some(0), "{text}");
    assert!(text.contains("3 passed, 0 failed"), "{text}");

    // ...a regressed server fails with a readable diff.
    let fail = run(relayorb(&db)
        .args(["check"])
        .arg(&fixture)
        .arg("--")
        .args(mock_server())
        .env("MOCK_VERSION", "2"));
    let text = stdout(&fail);
    assert_eq!(fail.status.code(), Some(1), "{text}");
    assert!(text.contains("FAIL  tools/call add"), "{text}");
    assert!(
        text.contains(r#"result.content[0].text: "5" -> "6""#),
        "{text}"
    );
    assert!(text.contains("2 passed, 1 failed"), "{text}");

    // delete
    assert!(run(relayorb(&db).args(["delete", &id])).status.success());
    assert!(!stdout(&run(relayorb(&db).arg("list"))).contains("mock"));
}

#[test]
fn record_reports_missing_server() {
    let (_dir, db) = tmp_db();
    let out = run(relayorb(&db).args(["record", "--", "relayorb-no-such-binary"]));
    assert_eq!(out.status.code(), Some(2));
    assert!(String::from_utf8_lossy(&out.stderr).contains("starting MCP server"));
}

#[test]
fn list_without_database() {
    let (_dir, db) = tmp_db();
    let out = run(relayorb(&db).arg("list"));
    assert!(out.status.success());
    assert!(stdout(&out).contains("No recordings yet"));
}

/// Record the standard session against the mock server with extra environment (no assertions).
fn record_with_env(db: &Path, env: &[(&str, &str)]) {
    let mut cmd = relayorb(db);
    cmd.args(["record", "--name", "mock", "--"])
        .args(mock_server())
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    for (k, v) in env {
        cmd.env(k, v);
    }
    let (_, code) = converse(cmd.spawn().unwrap(), &session_requests());
    assert_eq!(code, 0);
    // Distinct start times so name~N ordering is stable.
    std::thread::sleep(std::time::Duration::from_millis(20));
}

#[test]
fn diff_finds_first_divergence_between_runs() {
    let (_dir, db) = tmp_db();
    record_with_env(&db, &[]);
    record_with_env(&db, &[]);

    // Two identical runs: exit 0.
    let same = run(relayorb(&db).args(["diff", "mock~1", "mock"]));
    let text = stdout(&same);
    assert_eq!(same.status.code(), Some(0), "{text}");
    assert!(text.contains("No divergence"), "{text}");
    assert!(text.contains("client    A: test 0"), "{text}");

    // A regressed server: the first divergence is the add call's answer.
    record_with_env(&db, &[("MOCK_VERSION", "2")]);
    let changed = run(relayorb(&db).args(["diff", "mock~1", "mock"]));
    let text = stdout(&changed);
    assert_eq!(changed.status.code(), Some(1), "{text}");
    assert!(text.contains("First divergence at call #2"), "{text}");
    assert!(text.contains("same call, different answer"), "{text}");
    assert!(
        text.contains(r#"result.content[0].text: "5" -> "6""#),
        "{text}"
    );
    assert!(text.contains("server    A: mock 1"), "{text}");
    assert!(text.contains("<- differs"), "{text}");

    // JSON output for scripts that group many runs.
    let json_out: Value = serde_json::from_str(&stdout(&run(
        relayorb(&db).args(["diff", "mock~1", "mock", "--json"])
    )))
    .unwrap();
    assert_eq!(json_out["identical"], false);
    assert_eq!(json_out["first_divergence"]["call"], 2);
    assert_eq!(json_out["first_divergence"]["kind"], "different_result");
    assert_eq!(json_out["b"]["server"], "mock 2");

    // Out-of-range history is a clear error, not a silent fallback.
    let missing = run(relayorb(&db).args(["diff", "mock~9", "mock"]));
    assert_eq!(missing.status.code(), Some(2));
    assert!(String::from_utf8_lossy(&missing.stderr).contains("fewer than 10"));
}

#[test]
fn check_answers_server_requests_from_the_recording() {
    let (dir, db) = tmp_db();
    let mut requests = session_requests();
    requests.push(json!({"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"ask","arguments":{}}}));
    let child = relayorb(&db)
        .args(["record", "--name", "ask", "--"])
        .args(mock_server())
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .unwrap();
    let (answers, code) = converse(child, &requests);
    assert_eq!(code, 0);
    assert_eq!(
        answers[4]["result"]["content"][0]["text"],
        "hi from the agent"
    );

    // The server asks the agent again during check; relayorb answers as the agent did.
    let fixture = dir.path().join("ask.json");
    assert!(
        run(relayorb(&db).args(["export", "ask", "-o"]).arg(&fixture))
            .status
            .success()
    );
    let out = run(relayorb(&db)
        .args(["check"])
        .arg(&fixture)
        .arg("--")
        .args(mock_server()));
    let text = stdout(&out);
    assert_eq!(out.status.code(), Some(0), "{text}");
    assert!(text.contains("PASS  tools/call ask"), "{text}");
}
