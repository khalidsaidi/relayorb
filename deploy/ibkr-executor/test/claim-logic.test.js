/**
 * Unit tests for claim logic (can run without Firebase/IBKR)
 */

// Mock the safety checks
function checkClaimConditions(request, brokerAccount, tradingControls, replayControls, brokerAccountKey) {
  const errors = []

  // Check 1: status == "approved"
  if (request.status !== "approved") {
    errors.push(`invalid_status:${request.status}`)
  }

  // Check 2: expiresAt > now
  const now = Date.now()
  const expiresAtMs = request.expiresAt || 0
  if (expiresAtMs <= now) {
    errors.push("expired")
  }

  // Check 3: brokerAccountKey matches
  if (request.brokerAccountKey !== brokerAccountKey) {
    errors.push("account_mismatch")
  }

  // Check 4: approvedByUid in allowedUids
  if (!brokerAccount?.allowedUids?.includes(request.approvedByUid)) {
    errors.push("uid_not_allowed")
  }

  // Check 5: trading/controls.ibkrEnabled == true
  if (!tradingControls?.ibkrEnabled) {
    errors.push("ibkr_disabled")
  }

  // Check 6: trading/controls.killSwitch == false
  if (tradingControls?.killSwitch) {
    errors.push("kill_switch_active")
  }

  // Check 7: brokerAccounts.enabled == true
  if (!brokerAccount?.enabled) {
    errors.push("account_disabled")
  }

  // Check 8: mode live requires liveEnabled; mode paper requires paperEnabled
  const mode = request.mode || "paper"
  if (mode === "live" && !brokerAccount?.liveEnabled) {
    errors.push("live_not_enabled")
  }
  if (mode === "paper" && !brokerAccount?.paperEnabled) {
    errors.push("paper_not_enabled")
  }

  // Check 9: Replay guard
  if (replayControls?.desiredMode === "replay") {
    errors.push("replay_mode_active")
  }

  return errors
}

// Test cases
const tests = [
  {
    name: "Valid request passes all checks",
    request: {
      status: "approved",
      expiresAt: Date.now() + 60000,
      brokerAccountKey: "acct1",
      approvedByUid: "user123",
      mode: "paper",
    },
    brokerAccount: {
      enabled: true,
      paperEnabled: true,
      liveEnabled: false,
      allowedUids: ["user123"],
    },
    tradingControls: {
      ibkrEnabled: true,
      killSwitch: false,
    },
    replayControls: { desiredMode: "live" },
    brokerAccountKey: "acct1",
    expectedErrors: [],
  },
  {
    name: "Kill switch blocks claim",
    request: {
      status: "approved",
      expiresAt: Date.now() + 60000,
      brokerAccountKey: "acct1",
      approvedByUid: "user123",
      mode: "paper",
    },
    brokerAccount: {
      enabled: true,
      paperEnabled: true,
      allowedUids: ["user123"],
    },
    tradingControls: {
      ibkrEnabled: true,
      killSwitch: true, // BLOCKED
    },
    replayControls: { desiredMode: "live" },
    brokerAccountKey: "acct1",
    expectedErrors: ["kill_switch_active"],
  },
  {
    name: "Replay mode blocks claim",
    request: {
      status: "approved",
      expiresAt: Date.now() + 60000,
      brokerAccountKey: "acct1",
      approvedByUid: "user123",
      mode: "paper",
    },
    brokerAccount: {
      enabled: true,
      paperEnabled: true,
      allowedUids: ["user123"],
    },
    tradingControls: {
      ibkrEnabled: true,
      killSwitch: false,
    },
    replayControls: { desiredMode: "replay" }, // BLOCKED
    brokerAccountKey: "acct1",
    expectedErrors: ["replay_mode_active"],
  },
  {
    name: "Cross-account execution blocked",
    request: {
      status: "approved",
      expiresAt: Date.now() + 60000,
      brokerAccountKey: "acct2", // Wrong account
      approvedByUid: "user123",
      mode: "paper",
    },
    brokerAccount: {
      enabled: true,
      paperEnabled: true,
      allowedUids: ["user123"],
    },
    tradingControls: {
      ibkrEnabled: true,
      killSwitch: false,
    },
    replayControls: { desiredMode: "live" },
    brokerAccountKey: "acct1",
    expectedErrors: ["account_mismatch"],
  },
  {
    name: "UID not in allowlist blocked",
    request: {
      status: "approved",
      expiresAt: Date.now() + 60000,
      brokerAccountKey: "acct1",
      approvedByUid: "hacker", // Not allowed
      mode: "paper",
    },
    brokerAccount: {
      enabled: true,
      paperEnabled: true,
      allowedUids: ["user123"],
    },
    tradingControls: {
      ibkrEnabled: true,
      killSwitch: false,
    },
    replayControls: { desiredMode: "live" },
    brokerAccountKey: "acct1",
    expectedErrors: ["uid_not_allowed"],
  },
  {
    name: "Expired request blocked",
    request: {
      status: "approved",
      expiresAt: Date.now() - 1000, // Expired
      brokerAccountKey: "acct1",
      approvedByUid: "user123",
      mode: "paper",
    },
    brokerAccount: {
      enabled: true,
      paperEnabled: true,
      allowedUids: ["user123"],
    },
    tradingControls: {
      ibkrEnabled: true,
      killSwitch: false,
    },
    replayControls: { desiredMode: "live" },
    brokerAccountKey: "acct1",
    expectedErrors: ["expired"],
  },
  {
    name: "Live mode requires liveEnabled",
    request: {
      status: "approved",
      expiresAt: Date.now() + 60000,
      brokerAccountKey: "acct1",
      approvedByUid: "user123",
      mode: "live",
    },
    brokerAccount: {
      enabled: true,
      paperEnabled: true,
      liveEnabled: false, // Not enabled
      allowedUids: ["user123"],
    },
    tradingControls: {
      ibkrEnabled: true,
      killSwitch: false,
    },
    replayControls: { desiredMode: "live" },
    brokerAccountKey: "acct1",
    expectedErrors: ["live_not_enabled"],
  },
]

// Run tests
let passed = 0
let failed = 0

console.log("Running claim logic tests...\n")

for (const test of tests) {
  const errors = checkClaimConditions(
    test.request,
    test.brokerAccount,
    test.tradingControls,
    test.replayControls,
    test.brokerAccountKey
  )

  const errorsMatch =
    errors.length === test.expectedErrors.length &&
    errors.every((e) => test.expectedErrors.includes(e))

  if (errorsMatch) {
    console.log(`✓ ${test.name}`)
    passed++
  } else {
    console.log(`✗ ${test.name}`)
    console.log(`  Expected: ${JSON.stringify(test.expectedErrors)}`)
    console.log(`  Got: ${JSON.stringify(errors)}`)
    failed++
  }
}

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
