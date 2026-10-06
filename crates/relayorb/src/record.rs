//! `relayorb record`: a transparent stdio proxy that records every MCP message.
//!
//! Bytes are forwarded unchanged in both directions. Each frame is stored before it is
//! forwarded, so whatever the other side has seen is already in the recording; a recording
//! failure is reported but never blocks or corrupts the agent <-> server conversation.

use std::path::Path;
use std::process::Stdio;
use std::sync::mpsc;

use anyhow::{bail, Context, Result};
use tokio::io::{AsyncBufReadExt, AsyncRead, AsyncWrite, AsyncWriteExt, BufReader};
use tokio::process::Command;
use tokio::sync::oneshot;

use crate::message::{self, Direction};
use crate::store::{now_ms, Recorded, SessionMeta, Store};

enum Event {
    /// A frame to record. The sender is acknowledged once it is stored.
    Frame(Direction, i64, String, oneshot::Sender<()>),
    Done(Option<i64>),
}

pub async fn run(db_path: &Path, name: Option<String>, command: Vec<String>) -> Result<i32> {
    let Some((program, args)) = command.split_first() else {
        bail!("missing server command, e.g. `relayorb record -- npx -y @modelcontextprotocol/server-everything`");
    };

    let meta = SessionMeta {
        id: uuid::Uuid::new_v4().simple().to_string(),
        name,
        command: command.clone(),
        started_at_ms: now_ms(),
        ended_at_ms: None,
        exit_code: None,
    };

    let store = Store::open(db_path)?;
    store.create_session(&meta)?;
    let short = &meta.id[..8];
    eprintln!(
        "relayorb: recording session {short}{} -> {}",
        meta.name
            .as_deref()
            .map(|n| format!(" ({n})"))
            .unwrap_or_default(),
        db_path.display()
    );

    let (tx, rx) = mpsc::channel::<Event>();
    let session_id = meta.id.clone();
    let writer = std::thread::spawn(move || write_events(store, &session_id, rx));

    let mut child = Command::new(crate::spawn::program(program))
        .args(args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .kill_on_drop(true)
        .spawn()
        .with_context(|| format!("starting MCP server `{program}`"))?;

    let child_stdin = child.stdin.take().expect("piped stdin");
    let child_stdout = child.stdout.take().expect("piped stdout");

    let to_server = tokio::spawn(pump(
        tokio::io::stdin(),
        child_stdin,
        Direction::ClientToServer,
        tx.clone(),
    ));
    let mut to_client = tokio::spawn(pump(
        child_stdout,
        tokio::io::stdout(),
        Direction::ServerToClient,
        tx.clone(),
    ));

    // The session ends when the server exits (its stdout closes) or we are told to stop.
    // When the agent closes our stdin, `pump` closes the server's stdin, which is the
    // MCP stdio shutdown signal; the server then exits on its own.
    let status = tokio::select! {
        _ = &mut to_client => child.wait().await.ok(),
        _ = shutdown_signal() => {
            let _ = child.start_kill();
            child.wait().await.ok()
        }
    };
    to_server.abort();
    to_client.abort();

    let exit_code = status.and_then(|s| s.code()).map(i64::from);
    let _ = tx.send(Event::Done(exit_code));
    drop(tx);
    match writer.join() {
        Ok(Ok(count)) => eprintln!("relayorb: session {short} saved ({count} messages)"),
        Ok(Err(err)) => eprintln!("relayorb: recording error: {err:#}"),
        Err(_) => eprintln!("relayorb: recording thread panicked"),
    }
    Ok(exit_code.map(|c| c as i32).unwrap_or(1))
}

/// Copy newline-delimited frames from `reader` to `writer`, reporting each frame for recording.
async fn pump<R, W>(reader: R, mut writer: W, direction: Direction, tx: mpsc::Sender<Event>)
where
    R: AsyncRead + Unpin,
    W: AsyncWrite + Unpin,
{
    let mut reader = BufReader::new(reader);
    let mut buf = Vec::with_capacity(8 * 1024);
    loop {
        buf.clear();
        match reader.read_until(b'\n', &mut buf).await {
            Ok(0) | Err(_) => break,
            Ok(_) => {}
        }
        // Store the frame before forwarding it, so anything the other side has seen is already
        // in the recording, even if relayorb is killed right after.
        let text = String::from_utf8_lossy(&buf).into_owned();
        let (stored_tx, stored_rx) = oneshot::channel();
        if tx
            .send(Event::Frame(direction, now_ms(), text, stored_tx))
            .is_ok()
        {
            let _ = stored_rx.await;
        }
        if writer.write_all(&buf).await.is_err() || writer.flush().await.is_err() {
            break;
        }
    }
    let _ = writer.shutdown().await;
}

fn write_events(store: Store, session_id: &str, rx: mpsc::Receiver<Event>) -> Result<i64> {
    let mut seq = 0i64;
    let mut exit_code = None;
    for event in rx {
        match event {
            Event::Frame(direction, ts_ms, text, stored) => {
                for message in message::parse_line(&text) {
                    let rec = Recorded {
                        seq,
                        ts_ms,
                        direction,
                        message,
                    };
                    if let Err(err) = store.insert_message(session_id, &rec) {
                        eprintln!("relayorb: failed to record message {seq}: {err:#}");
                    }
                    seq += 1;
                }
                let _ = stored.send(());
            }
            Event::Done(code) => exit_code = code,
        }
    }
    store.finish_session(session_id, now_ms(), exit_code)?;
    Ok(seq)
}

async fn shutdown_signal() {
    #[cfg(unix)]
    {
        use tokio::signal::unix::{signal, SignalKind};
        let mut term = match signal(SignalKind::terminate()) {
            Ok(s) => s,
            Err(_) => return std::future::pending().await,
        };
        tokio::select! {
            _ = tokio::signal::ctrl_c() => {}
            _ = term.recv() => {}
        }
    }
    #[cfg(not(unix))]
    {
        let _ = tokio::signal::ctrl_c().await;
    }
}
