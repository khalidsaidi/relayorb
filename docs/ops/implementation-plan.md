Implementation Plan (No Ops Graph)

Scope
- Complete FMP WebSocket integration and charting path, ensure polling skips when stream is healthy.
- Clean up gateway URL consistency and refresh endpoint audit.
- Make Pre-Breakout compute all day; manual entry and auto-paper allowed all day; no entry-window badge.
- Make Replay mode intuitive with a simple Live/Replay toggle and real tape coverage for microcaps.
- Implement IBKR Option A (3 accounts, 3 executors, manual-confirm only) exactly as specified.

Out of scope
- Ops Graph changes (explicitly removed from plan).

Non-negotiables (global)
- Additive-only data changes (no destructive mutations of existing prod docs).
- No autonomous trading. Execution only for approved requests.
- Replay safety: no live execution in replay.
- No secrets in logs/events.

Workstream A — FMP WebSocket Live Data (Price Streamer + UI)
Goal: FMP WebSocket is the primary real-time source; polling only as fallback.

Tasks
1) Price Streamer
   - Stream enabled with the approved FMP stream list.
   - WebSocket login required and verified.
   - Subscriptions sent after login ACK.
   - Health payload shows connected/authenticated/quoteCount/lastQuoteAt.
   - Polling skipped when stream healthy per asset class.
2) UI (1m charts)
   - 1m charts pull FMP candles via MDG, not TradingView.
   - Confirm 1m and 5m tabs render with live FMP data.
3) Validation
   - Health payload shows non-zero quoteCount and fresh lastQuoteAt.
   - Polling skip verified for crypto/forex; stocks skip when equities stream is active.

Workstream B — Gateway URL Consistency + Endpoint Audit
Goal: all services call the same gateway URL; endpoint usage list is accurate.

Tasks
1) Standardize MARKED_DATA_GATEWAY_URL across:
   - price-streamer, market-intel, signal-evaluator, refresh.
2) Audit endpoint usage (no new docs)
   - Mark each endpoint: Active / Dormant / Deprecated.
   - Replace deprecated endpoints with stable equivalents.

Workstream C — Pre-Breakout Watch (All-Day Compute)
Goal: Pre-Breakout list is visible and computed all day; manual entry and auto-paper allowed all day; no entry-window badge.

Tasks
1) Market Intel compute rule
   - Pre-Breakout compute runs all day.
   - Manual entry allowed all day.
   - Auto-paper allowed all day.
   - No entry-window badge.
2) Verification
   - Pre-Breakout list appears in Dashboard + Trade Now.
   - Rule explanation shows why an item passed/failed.

Workstream D — Replay Usability + Tape Coverage
Goal: replay is easy to use for testing when markets are closed; no confusion.

Tasks
1) UI
   - Simple Live/Replay toggle for non-technical users.
   - Hide advanced controls by default.
   - Banner always visible in Replay.
2) Tape coverage
   - Expand replay symbol set with microcaps that pass Pre-Breakout thresholds.
   - Pick a tape date where microcaps satisfy RVOL/turnover/close-near-high.
3) Validation
   - Replay produces non-empty Swing + Pre-Breakout lists.
   - Clear indication of dataset + asOf time.

Workstream E — IBKR Option A (3 Accounts, 3 Executors)
Goal: strict one-IBKR-per-app-account with manual confirmation only.

Definitions (standardize)
- brokerAccountKey: one of {"acct1","acct2","acct3"}.
- Hardcoded allowlist:
  acct1 -> UID_ACCT1
  acct2 -> UID_ACCT2
  acct3 -> UID_ACCT3

Firestore (additive)
1) brokerAccounts/{brokerAccountKey}
   - One doc each for acct1/acct2/acct3
   - Fields:
     brokerAccountKey, ibAccountCode
     gatewayHost, gatewayPortPaper, gatewayPortLive
     clientIdPaper, clientIdLive
     enabled, paperEnabled, liveEnabled
     allowedUids
     notes
2) trading/controls (additive fields)
   - ibkrEnabled, killSwitch, requireManualConfirm
   - requireBracket, limitOnly
   - caps: maxNotionalPerTrade, maxDailyNotional, maxOrdersPerMinute, maxOpenOrders
3) Existing docs (additive fields)
   - tradeProposals/{proposalId} add brokerAccountKey, computedAt, expiresAt
   - executionRequests/{requestId} add brokerAccountKey, requestedByUid, approvedByUid, mode, status lifecycle, expiresAt, orderSnapshot
   - brokerOrders/{requestId} add brokerAccountKey, ibAccountCode, conId, orderIds, timestamps, lastError

UI flow (manual confirm only)
1) On login
   - Map UID -> brokerAccountKey (hardcoded).
   - Display brokerAccountKey prominently.
2) Execute click
   - Fetch proposal, verify brokerAccountKey match.
   - Disable execute in replay mode.
   - Create executionRequests with status "approved" only after user confirms.
   - Include approvedByUid, approvedAt, expiresAt, orderSnapshot.
3) UI subscribes to executionRequests + brokerOrders for status transitions.

Executors (Option A: 3 services)
- ibkr-executor-acct1 with BROKER_ACCOUNT_KEY=acct1
- ibkr-executor-acct2 with BROKER_ACCOUNT_KEY=acct2
- ibkr-executor-acct3 with BROKER_ACCOUNT_KEY=acct3

Executor listener query (per account)
- executionRequests where status=="approved"
- brokerAccountKey==BROKER_ACCOUNT_KEY
- expiresAt > now

Claim transaction (atomic)
Checks (all required)
1) status=="approved"
2) expiresAt > now
3) brokerAccountKey matches
4) approvedByUid in allowedUids
5) trading/controls.ibkrEnabled==true
6) trading/controls.killSwitch==false
7) brokerAccounts.enabled==true
8) mode live requires liveEnabled; mode paper requires paperEnabled
9) Replay guard: reject if replay desiredMode or effectiveMode is replay
If pass: status="claimed", claimedAt, claimedBy, claimSessionId.
If fail: status="rejected" or "error" with reason.

Risk checks (at claim time)
- caps.maxNotionalPerTrade, caps.maxOrdersPerMinute, caps.maxOpenOrders
- requireBracket=true, limitOnly=true
- Reject on any failure (no broker submit).

Contract resolution
- brokerInstruments/{assetKey} cache for conId and contract details.
- Resolve missing via IBKR contractDetails, then upsert.

Bracket submission
- Parent transmit=false; TP transmit=false; SL transmit=true.
- Explicit account on each order.
- Track order IDs and store in brokerOrders.

Order status streaming
- Subscribe orderStatus + execDetails.
- Update brokerOrders + executionRequests status transitions.

Security rules (hardcoded 3 users)
- Only allow UIDs in allowlist to read.
- Users can only write requests for their brokerAccountKey.
- Users cannot set claimed/submitted/working/filled.
- Executors (service accounts) allowed to claim and update status.

Acceptance tests (must pass)
- Cross-account execution blocked.
- Kill switch blocks claims.
- Replay mode blocks all execution.
- Bracket submits as 3 orders with correct transmit flags.
- UI always shows the active brokerAccountKey.

Implementation order (must follow)
1) Create brokerAccounts/{acct1|acct2|acct3} (enabled=false, liveEnabled=false).
2) Create trading/controls with safe defaults (ibkrEnabled=false, killSwitch=true).
3) Add brokerAccountKey fields to proposals/requests/orders writers.
4) Update UI for brokerAccountKey mapping + replay guard.
5) Implement executor template.
6) Deploy 3 executors (acct1/acct2/acct3).
7) Paper-mode tests only (ibkrEnabled=true, killSwitch=false, paperEnabled=true).
8) Enable live per account only after paper tests pass.

Validation & Evidence (required)
- Stream health (connected/authenticated/quoteCount fresh).
- UI 1m charts show FMP candles.
- Pre-Breakout list computed all day; manual entry + auto-paper allowed all day.
- Replay produces non-empty swing + pre-breakout lists with selected tape.
- IBKR paper flow passes all acceptance tests above.
