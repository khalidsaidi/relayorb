# Replay System: Current State and Refactor Plan

## 1) Current Behavior (Reverse Engineered)

### Data model
- `replay/controls`
  - `desiredMode`: "live" | "replay"
  - `phase`: "running" | "paused" | "ready" | "idle"
  - `activeRunId`, `datasetId`, `sessionId`, `version`
  - `asOf` (Timestamp), `speedScript`, `requiredServices`, `botsReplayEnabled`
- `replay/controls/consumers/*`
  - Service heartbeats and ACKs (mdg, price-streamer, market-intel, signal-evaluator, ui)
- `replay/controls/runs/{runId}`
  - Used for replay outputs and config snapshots, but no registry metadata is written today.
- GCS replay tape artifacts
  - `replay/tapes/stocks/{datasetId}/manifest.json` + bars, profiles, news, etc.

### Services (key replay dependencies)
- Market data gateway
  - Reads `replay/controls` to determine mode and `asOf`.
  - `/clock` returns `replay.datasetId` from controls (no run lookup today).
  - Loads replay manifest by `datasetId`; optionally reads `replay/controls/runs/{runId}` for `manifestPath`.
- Price streamer
  - Ticks `asOf` while `phase=running`, writes it to `replay/controls`.
  - If `phase=running`, manual `asOf` changes are overwritten by the next tick.
- Market intel
  - Uses `datasetId` from controls to fetch tape symbols in replay.
  - Writes outputs under `replay/controls/runs/{runId}/...`.
- Signal evaluator
  - Uses `runId` + `sessionId` to scope redis keys and output docs.
  - Requires `activeRunId`, `sessionId`, and `version` for replay mode.
- ORB runner
  - Reads `/clock` and expects `replay.datasetId` to build the replay universe.
  - Uses `/replay/tapeSymbols?datasetId=...` during replay.

### UI (Replay controls)
- `AppShell` toggles replay mode by writing to `replay/controls`.
- `ReplayControlsPanel` lets users set replay name (runId), tape name (datasetId), time, and phase.
- Defaults are hardcoded to the microcap tape, which can be misleading.
- "Jump" writes `asOf` and pauses replay, but replay time can appear unchanged if `phase=running`.

### Observed pain points
- Run name / tape name must be typed manually; defaults are fixed to microcap.
- No registry of available runs; users cannot safely select from known datasets.
- Changing time while running is overwritten by price-streamer.
- `/clock` only includes datasetId from controls, so missing dataset blocks ORB replay.

## 2) Goals
- Make replay setup obvious and safe for non-technical users.
- Stop relying on hardcoded run/tape defaults.
- Use a real registry of replay runs and datasets.
- Make time controls deterministic (Jump always pauses and applies).
- Preserve backwards compatibility with existing run IDs and datasets.

## 3) Proposed Architecture

### ReplayRun (registry)
Stored at `replay/controls/runs/{runId}` (doc root), with fields:
- `runId` (doc id)
- `label` (human friendly name)
- `datasetId` (tape name)
- `tapeDate` (YYYY-MM-DD)
- `symbolCount` (optional)
- `manifestPath` (optional override)
- `createdAt`, `updatedAt`
- `notes`, `tags` (optional)

### ReplaySession (controls)
Keep `replay/controls` as the session state:
- `desiredMode`, `phase`, `sessionId`, `version`
- `activeRunId`, `datasetId` (keep for compatibility)
- `asOf`, `speedScript`, `requiredServices`, `botsReplayEnabled`

### Flow
1. Build tape -> register run metadata.
2. UI selects a run (label), sets `activeRunId` + `datasetId`.
3. Enable replay: `desiredMode=replay`, `phase=running`.
4. Jump always pauses + sets `asOf`.
5. Services read runId from controls and datasetId from controls or run doc fallback.

## 4) Refactor Plan (Implementation)
- Backend
  - Add replay run registry endpoints (list + register): `GET /replay/runs`, `POST /replay/runs`.
  - Extend `/replay/buildTape` to optionally register a run.
  - `/clock` should include datasetId from run doc if missing in controls.
- Frontend
  - Add run selector with labels (no more microcap defaults).
  - Make time controls apply pending run + time changes before playback.
  - Keep raw runId/dataset fields in Advanced only.
- Docs
  - Document the new registry and the replay flow for operators.
