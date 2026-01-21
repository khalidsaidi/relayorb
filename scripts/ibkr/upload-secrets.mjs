import fs from "fs"
import { spawnSync } from "child_process"

const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "relayorb"
const ENV_PATH = process.env.IBKR_ENV_PATH || ".secrets/ibkr.env"

function run(cmd, args, input) {
  const result = spawnSync(cmd, args, {
    input,
    stdio: ["pipe", "inherit", "inherit"],
    env: process.env,
  })
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed`)
  }
}

function hasSecret(name) {
  const result = spawnSync("gcloud", ["secrets", "describe", name, "--project", PROJECT_ID], {
    stdio: ["ignore", "ignore", "ignore"],
    env: process.env,
  })
  return result.status === 0
}

function createSecret(name) {
  run("gcloud", ["secrets", "create", name, "--project", PROJECT_ID, "--replication-policy", "automatic"])
}

function addVersion(name, value) {
  run("gcloud", ["secrets", "versions", "add", name, "--project", PROJECT_ID, "--data-file=-"], value)
}

function parseEnvFile(path) {
  if (!fs.existsSync(path)) {
    throw new Error(`Missing env file: ${path}`)
  }
  const content = fs.readFileSync(path, "utf8")
  const vars = {}
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) return
    const idx = trimmed.indexOf("=")
    if (idx === -1) return
    const key = trimmed.slice(0, idx).trim()
    const value = trimmed.slice(idx + 1)
    vars[key] = value
  })
  return vars
}

const vars = parseEnvFile(ENV_PATH)

const mapping = [
  ["IBKR_ACCT1_USERNAME", "ibkr-acct1-username", true],
  ["IBKR_ACCT1_PASSWORD", "ibkr-acct1-password", true],
  ["IBKR_ACCT2_USERNAME", "ibkr-acct2-username", false],
  ["IBKR_ACCT2_PASSWORD", "ibkr-acct2-password", false],
  ["IBKR_ACCT3_USERNAME", "ibkr-acct3-username", false],
  ["IBKR_ACCT3_PASSWORD", "ibkr-acct3-password", false],
]

const missingRequired = []
mapping.forEach(([envKey, , required]) => {
  if (required && !vars[envKey]) missingRequired.push(envKey)
})

if (missingRequired.length > 0) {
  throw new Error(`Missing required values in ${ENV_PATH}: ${missingRequired.join(", ")}`)
}

mapping.forEach(([envKey, secretName]) => {
  const value = vars[envKey]
  if (!value) {
    console.log(`Skipping ${secretName} (no value set)`)
    return
  }
  if (!hasSecret(secretName)) {
    console.log(`Creating secret: ${secretName}`)
    createSecret(secretName)
  } else {
    console.log(`Updating secret: ${secretName}`)
  }
  addVersion(secretName, `${value}\n`)
})

console.log("IBKR secrets updated.")
