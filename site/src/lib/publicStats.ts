import { siblingsForManifest } from "@/lib/crossProject";

type Sample = {
  metric: string;
  labels: Record<string, string>;
  value: number;
  timestampMs?: number;
};

export type RelayOrbPublicStats = {
  invokes_total: number;
  invokes_7d: number;
  invokes_30d: number;
  unique_callers_7d: number;
  unique_callers_30d: number;
  median_invoke_latency_ms: number;
  p95_invoke_latency_ms: number;
  idempotency_replays_total: number;
  jobs_queued_current: number;
  capabilities_registered: number;
  workers_healthy: number;
  policy_denials_7d: number;
  tool_call_success_pct: number;
  last_invoke_ts: string;
  generated_at: string;
  terraform_downloads: {
    prod_module: number;
    demo_module: number;
  };
  siblings: ReturnType<typeof siblingsForManifest>;
};

function parseLabels(raw: string) {
  const labels: Record<string, string> = {};
  if (!raw) return labels;
  const pairs = raw.split(",");
  for (const pair of pairs) {
    const idx = pair.indexOf("=");
    if (idx <= 0) continue;
    const key = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim().replace(/^"|"$/g, "");
    labels[key] = value;
  }
  return labels;
}

function parsePrometheus(text: string) {
  const samples: Sample[] = [];
  for (const lineRaw of text.split(/\r?\n/)) {
    const line = lineRaw.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(
      /^([a-zA-Z_:][a-zA-Z0-9_:]*)(\{([^}]*)\})?\s+([^\s]+)(?:\s+([0-9]+))?$/,
    );
    if (!match) continue;
    const metric = match[1];
    const labels = parseLabels(match[3] || "");
    const value = Number(match[4]);
    const timestampMs = match[5] ? Number(match[5]) : undefined;
    if (!Number.isFinite(value)) continue;
    samples.push({ metric, labels, value, timestampMs });
  }
  return samples;
}

function sumMetric(samples: Sample[], metric: string) {
  return samples
    .filter(sample => sample.metric === metric)
    .reduce((acc, sample) => acc + sample.value, 0);
}

function maxMetric(samples: Sample[], metric: string) {
  let found = false;
  let current = 0;
  for (const sample of samples) {
    if (sample.metric !== metric) continue;
    current = found ? Math.max(current, sample.value) : sample.value;
    found = true;
  }
  return found ? current : 0;
}

function quantileMetric(samples: Sample[], metric: string, quantile: string) {
  const found = samples.find(
    sample =>
      sample.metric === metric && (sample.labels.quantile || "") === quantile,
  );
  return found ? found.value : 0;
}

async function fetchTerraformDownloads() {
  const urls = {
    prod_module:
      "https://registry.terraform.io/v1/modules/khalidsaidi/relayorb/google",
    demo_module:
      "https://registry.terraform.io/v1/modules/khalidsaidi/relayorb-demo/google",
  } as const;
  const out = { prod_module: 0, demo_module: 0 };
  await Promise.all(
    Object.entries(urls).map(async ([key, url]) => {
      try {
        const response = await fetch(url, { next: { revalidate: 60 } });
        if (!response.ok) return;
        const payload = (await response.json()) as { downloads?: number };
        if (typeof payload.downloads === "number" && Number.isFinite(payload.downloads)) {
          out[key as keyof typeof out] = Math.max(0, Math.round(payload.downloads));
        }
      } catch {
        // Keep zero fallback for unavailable registry metadata.
      }
    }),
  );
  return out;
}

async function fetchMetricsSamples() {
  const metricsUrl = process.env.RELAYORB_METRICS_URL || "http://34.8.48.11/metrics";
  const token = process.env.RELAYORB_METRICS_BEARER_TOKEN || "";
  try {
    const response = await fetch(metricsUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      next: { revalidate: 60 },
    });
    if (!response.ok) return [] as Sample[];
    const text = await response.text();
    return parsePrometheus(text);
  } catch {
    return [] as Sample[];
  }
}

function lastInvokeTimestamp(samples: Sample[]) {
  let latest = 0;
  for (const sample of samples) {
    if (!sample.metric.startsWith("relayorb_gateway_invoke")) continue;
    if (!sample.timestampMs) continue;
    latest = Math.max(latest, sample.timestampMs);
  }
  return latest > 0 ? new Date(latest).toISOString() : new Date().toISOString();
}

export async function getRelayOrbPublicStats(): Promise<RelayOrbPublicStats> {
  const [downloads, samples] = await Promise.all([
    fetchTerraformDownloads(),
    fetchMetricsSamples(),
  ]);

  const invokesTotal =
    sumMetric(samples, "relayorb_gateway_invoke_requests_total") ||
    sumMetric(samples, "relayorb_gateway_invoke_total");
  const invokeSuccess =
    sumMetric(samples, "relayorb_gateway_invoke_success_total") ||
    sumMetric(samples, "relayorb_gateway_invoke_ok_total");
  const invokeErrors =
    sumMetric(samples, "relayorb_gateway_invoke_error_total") ||
    sumMetric(samples, "relayorb_gateway_invoke_fail_total");
  const invokeBase = Math.max(invokesTotal, invokeSuccess + invokeErrors);

  const successPct =
    invokeBase > 0
      ? Number(((Math.max(0, invokeBase - invokeErrors) / invokeBase) * 100).toFixed(2))
      : 100;

  const latencyMedian =
    quantileMetric(samples, "relayorb_gateway_invoke_latency_ms", "0.5") ||
    quantileMetric(samples, "relayorb_gateway_invoke_latency_ms_summary", "0.5");
  const latencyP95 =
    quantileMetric(samples, "relayorb_gateway_invoke_latency_ms", "0.95") ||
    quantileMetric(samples, "relayorb_gateway_invoke_latency_ms_summary", "0.95");

  const generatedAt = new Date().toISOString();

  return {
    invokes_total: Math.round(Math.max(0, invokeBase)),
    invokes_7d: Math.round(
      Math.max(
        0,
        sumMetric(samples, "relayorb_gateway_invoke_requests_7d") || invokeBase,
      ),
    ),
    invokes_30d: Math.round(
      Math.max(
        0,
        sumMetric(samples, "relayorb_gateway_invoke_requests_30d") || invokeBase,
      ),
    ),
    unique_callers_7d: Math.round(
      Math.max(0, maxMetric(samples, "relayorb_gateway_unique_callers_7d")),
    ),
    unique_callers_30d: Math.round(
      Math.max(0, maxMetric(samples, "relayorb_gateway_unique_callers_30d")),
    ),
    median_invoke_latency_ms: Number(Math.max(0, latencyMedian).toFixed(2)),
    p95_invoke_latency_ms: Number(Math.max(0, latencyP95).toFixed(2)),
    idempotency_replays_total: Math.round(
      Math.max(0, sumMetric(samples, "relayorb_gateway_idempotency_replays_total")),
    ),
    jobs_queued_current: Math.round(
      Math.max(
        0,
        maxMetric(samples, "relayorb_gateway_jobs_queued") ||
          maxMetric(samples, "relayorb_gateway_jobs_queued_current"),
      ),
    ),
    capabilities_registered: Math.round(
      Math.max(
        0,
        maxMetric(samples, "relayorb_registry_capabilities_registered") ||
          sumMetric(samples, "relayorb_registry_register_requests_total"),
      ),
    ),
    workers_healthy: Math.round(
      Math.max(
        0,
        maxMetric(samples, "relayorb_registry_workers_healthy") ||
          maxMetric(samples, "relayorb_registry_healthy_workers"),
      ),
    ),
    policy_denials_7d: Math.round(
      Math.max(0, sumMetric(samples, "relayorb_gateway_policy_denials_7d")),
    ),
    tool_call_success_pct: successPct,
    last_invoke_ts: lastInvokeTimestamp(samples),
    generated_at: generatedAt,
    terraform_downloads: downloads,
    siblings: siblingsForManifest(),
  };
}
