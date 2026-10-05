#!/usr/bin/env node
// Launcher for the prebuilt relayorb binary bundled in vendor/<target>/.
"use strict";

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const TARGETS = {
  "darwin-arm64": "aarch64-apple-darwin",
  "darwin-x64": "x86_64-apple-darwin",
  "linux-arm64": "aarch64-unknown-linux-gnu",
  "linux-x64": "x86_64-unknown-linux-gnu",
  "win32-x64": "x86_64-pc-windows-msvc",
};

const key = `${process.platform}-${process.arch}`;
const target = TARGETS[key];
if (!target) {
  console.error(
    `relayorb: no prebuilt binary for ${key}. Build from source: ` +
      "cargo install --git https://github.com/khalidsaidi/relayorb relayorb",
  );
  process.exit(1);
}

const exe = process.platform === "win32" ? "relayorb.exe" : "relayorb";
const binary = path.join(__dirname, "..", "vendor", target, exe);
if (!fs.existsSync(binary)) {
  console.error(`relayorb: missing binary ${binary}. Try reinstalling @khalidsaidi/relayorb.`);
  process.exit(1);
}
if (process.platform !== "win32") {
  try {
    fs.accessSync(binary, fs.constants.X_OK);
  } catch {
    try {
      fs.chmodSync(binary, 0o755);
    } catch {
      // Read-only install location; spawn will report the error.
    }
  }
}

// stdio is inherited, so `relayorb record` / `replay` work as MCP stdio servers through npx.
const child = spawn(binary, process.argv.slice(2), { stdio: "inherit", windowsHide: true });

const forwarded = ["SIGINT", "SIGTERM", "SIGHUP"];
const forward = signal => {
  if (child.exitCode === null && child.signalCode === null) child.kill(signal);
};
for (const signal of forwarded) process.on(signal, forward);

child.on("error", err => {
  console.error(`relayorb: failed to start ${binary}: ${err.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    // Die the same way the binary did, without our forwarding handlers in the way.
    for (const s of forwarded) process.removeListener(s, forward);
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 1);
  }
});
