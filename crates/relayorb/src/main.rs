//! RelayOrb: a flight recorder for AI agents.
//!
//! Wrap any stdio MCP server to record every message between an agent and its tools,
//! then inspect, replay, or regression-check those sessions.

mod check;
mod diff;
mod message;
mod record;
mod replay;
mod show;
mod store;

use std::path::PathBuf;
use std::time::Duration;

use anyhow::Result;
use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(
    name = "relayorb",
    version,
    about = "A flight recorder for AI agents: record, replay, and regression-check MCP tool calls.",
    after_help = "Example (MCP client config):\n  \"command\": \"relayorb\",\n  \"args\": [\"record\", \"--name\", \"fs\", \"--\", \"npx\", \"-y\", \"@modelcontextprotocol/server-filesystem\", \"/tmp\"]"
)]
struct Cli {
    /// Recordings database [default: ~/.relayorb/recordings.db]
    #[arg(long, global = true, env = "RELAYORB_DB")]
    db: Option<PathBuf>,

    #[command(subcommand)]
    command: Cmd,
}

#[derive(Subcommand)]
enum Cmd {
    /// Run an MCP server and record everything that passes between it and the agent
    Record {
        /// Label for this recording
        #[arg(long)]
        name: Option<String>,
        /// The MCP server command, after `--`
        #[arg(last = true, required = true, value_name = "SERVER_COMMAND")]
        command: Vec<String>,
    },
    /// List recorded sessions, newest first
    #[command(alias = "ls")]
    List {
        #[arg(long, default_value_t = 20)]
        limit: usize,
    },
    /// Show what happened in a session: every call, its latency, and its outcome
    Show {
        /// Session name (name~1 = the run before the newest), id or prefix, or a session JSON file
        session: String,
        /// Print machine-readable JSON instead
        #[arg(long)]
        json: bool,
    },
    /// Save a session as a JSON file (e.g. a test fixture to commit)
    Export {
        /// Session name or id (or unique prefix)
        session: String,
        /// Output file [default: stdout]
        #[arg(short, long)]
        output: Option<PathBuf>,
    },
    /// Pretend to be the MCP server, answering from a recording (no real tools needed)
    Replay {
        /// Session name (name~1 = the run before the newest), id or prefix, or a session JSON file
        session: String,
    },
    /// Re-send recorded calls to a live MCP server and report any answer that changed
    Check {
        /// Session name (name~1 = the run before the newest), id or prefix, or a session JSON file
        session: String,
        /// Seconds to wait for each answer
        #[arg(long, default_value_t = 30)]
        timeout: u64,
        /// Ignore this JSON key wherever it appears (repeatable), e.g. --ignore-key timestamp
        #[arg(long = "ignore-key", value_name = "KEY")]
        ignore_keys: Vec<String>,
        /// The MCP server command, after `--`
        #[arg(last = true, required = true, value_name = "SERVER_COMMAND")]
        command: Vec<String>,
    },
    /// Compare two runs and show the first tool call where they diverge
    Diff {
        /// Run A: session name (name~1 = the run before the newest), id, or JSON file
        a: String,
        /// Run B: session name, id, or JSON file
        b: String,
        /// Ignore this JSON key wherever it appears in answers (repeatable)
        #[arg(long = "ignore-key", value_name = "KEY")]
        ignore_keys: Vec<String>,
        /// List every difference, not just the first
        #[arg(long)]
        all: bool,
        /// Print machine-readable JSON (e.g. to group many failed runs by first divergence)
        #[arg(long)]
        json: bool,
    },
    /// Delete a recorded session
    #[command(alias = "rm")]
    Delete {
        /// Session name or id (or unique prefix)
        session: String,
    },
}

fn main() {
    let cli = Cli::parse();
    let runtime = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .expect("tokio runtime");
    let code = match runtime.block_on(run(cli)) {
        Ok(code) => code,
        Err(err) => {
            eprintln!("relayorb: {err:#}");
            2
        }
    };
    // Exit directly: a blocked read on our stdin would otherwise keep the runtime alive.
    std::process::exit(code);
}

async fn run(cli: Cli) -> Result<i32> {
    let db = cli.db.unwrap_or_else(store::default_db_path);
    match cli.command {
        Cmd::Record { name, command } => record::run(&db, name, command).await,
        Cmd::List { limit } => show::list(&db, limit).map(|_| 0),
        Cmd::Show { session, json } => {
            show::show(&store::load_session(&db, &session)?, json).map(|_| 0)
        }
        Cmd::Export { session, output } => {
            let session = store::Store::open(&db)?.load(&session)?;
            show::export(&session, output.as_deref()).map(|_| 0)
        }
        Cmd::Replay { session } => replay::run(store::load_session(&db, &session)?).await,
        Cmd::Check {
            session,
            timeout,
            ignore_keys,
            command,
        } => {
            let opts = check::Options {
                timeout: Duration::from_secs(timeout),
                ignore_keys,
            };
            check::run(store::load_session(&db, &session)?, command, opts).await
        }
        Cmd::Diff {
            a,
            b,
            ignore_keys,
            all,
            json,
        } => diff::run(
            store::load_session(&db, &a)?,
            store::load_session(&db, &b)?,
            diff::Options {
                ignore_keys,
                all,
                json,
            },
        ),
        Cmd::Delete { session } => {
            let store = store::Store::open(&db)?;
            let id = store.resolve_id(&session)?;
            store.delete(&id)?;
            println!("deleted session {}", &id[..8.min(id.len())]);
            Ok(0)
        }
    }
}
