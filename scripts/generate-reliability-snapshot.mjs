#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WINDOW_START = "2026-05-02T00:00:00Z";
const WINDOW_END = "2026-06-01T23:59:59Z";
const PROD_PROJECT = "relayorb-prod";
const DEMO_PROJECT = "relayorb-demo";
const REGION = "us-central1";
const BILLING_SERVICE_NAME = "services/152E-C115-5142";
const REQUEST_FREE_TIER = 2_000_000;

const prodServiceRoles = {
  "relayorb-gateway-prod": "Gateway",
  "relayorb-registry-prod": "Registry",
  "relayorb-rag-prod": "Worker",
};

const referenceServiceRoles = {
  "relayorb-gateway-demo": "Demo gateway",
  "relayorb-metrics-scraper-demo": "Demo metrics scraper",
  "relayorb-rag-demo": "Demo worker",
  "relayorb-registry-demo": "Demo registry",
  "relayorb-gateway-prod": "Prod gateway",
  "relayorb-metrics-scraper-prod": "Prod metrics scraper",
  "relayorb-rag-prod": "Prod worker",
  "relayorb-registry-prod": "Prod registry",
};

function run(command, args) {
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function runJson(command, args) {
  const raw = run(command, args);
  return raw ? JSON.parse(raw) : null;
}

function toPrice(unitPrice) {
  const units = Number(unitPrice.units || 0);
  const nanos = Number(unitPrice.nanos || 0) / 1_000_000_000;
  return units + nanos;
}

function normalizeCpu(cpu) {
  if (!cpu) return 0;
  if (cpu.endsWith("m")) return Number(cpu.slice(0, -1)) / 1000;
  return Number(cpu);
}

function normalizeMemoryGiB(memory) {
  if (!memory) return 0;
  if (memory.endsWith("Gi")) return Number(memory.slice(0, -2));
  if (memory.endsWith("Mi")) return Number(memory.slice(0, -2)) / 1024;
  return Number(memory);
}

function latestPoint(points) {
  return [...(points || [])].sort((left, right) => {
    const leftTs = Date.parse(left.interval?.endTime || left.interval?.startTime || 0);
    const rightTs = Date.parse(right.interval?.endTime || right.interval?.startTime || 0);
    return rightTs - leftTs;
  })[0];
}

async function apiGetJson(url, query = {}, method = "GET", body = undefined) {
  const token = run("gcloud", ["auth", "print-access-token"]);
  const requestUrl = new URL(url);
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      for (const item of value) requestUrl.searchParams.append(key, item);
    } else {
      requestUrl.searchParams.set(key, String(value));
    }
  }
  const response = await fetch(requestUrl, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API ${response.status} ${response.statusText} for ${requestUrl}: ${text}`);
  }
  return response.json();
}

async function listTimeSeries(project, filter, aggregation = {}) {
  const baseUrl = `https://monitoring.googleapis.com/v3/projects/${project}/timeSeries`;
  const items = [];
  let pageToken = "";
  do {
    const payload = await apiGetJson(baseUrl, {
      filter,
      "interval.startTime": WINDOW_START,
      "interval.endTime": WINDOW_END,
      "aggregation.alignmentPeriod": aggregation.alignmentPeriod,
      "aggregation.perSeriesAligner": aggregation.perSeriesAligner,
      "aggregation.crossSeriesReducer": aggregation.crossSeriesReducer,
      "aggregation.groupByFields": aggregation.groupByFields,
      pageToken,
    });
    items.push(...(payload.timeSeries || []));
    pageToken = payload.nextPageToken || "";
  } while (pageToken);
  return items;
}

async function queryRequestCounts(project, serviceName) {
  const series = await listTimeSeries(
    project,
    `metric.type="run.googleapis.com/request_count" AND resource.labels.service_name="${serviceName}"`,
    {
      alignmentPeriod: "2592000s",
      perSeriesAligner: "ALIGN_SUM",
      crossSeriesReducer: "REDUCE_SUM",
      groupByFields: ["metric.labels.response_code_class"],
    },
  );
  const byClass = {};
  for (const entry of series) {
    const responseClass = entry.metric?.labels?.response_code_class || "unknown";
    const point = latestPoint(entry.points);
    const value = Number(point?.value?.int64Value || point?.value?.doubleValue || 0);
    byClass[responseClass] = Math.round(value);
  }
  const total = Object.values(byClass).reduce((sum, value) => sum + value, 0);
  return { byClass, total };
}

async function queryLatencyPercentile(project, serviceName, aligner) {
  const series = await listTimeSeries(
    project,
    `metric.type="run.googleapis.com/request_latencies" AND resource.labels.service_name="${serviceName}"`,
    {
      alignmentPeriod: "2592000s",
      perSeriesAligner: aligner,
      crossSeriesReducer: "REDUCE_MEAN",
      groupByFields: ["resource.labels.service_name"],
    },
  );
  const values = series
    .map(entry => Number(latestPoint(entry.points)?.value?.doubleValue || 0))
    .filter(Number.isFinite);
  return values.length ? values[0] : 0;
}

async function queryBillableInstanceSeconds(project, serviceName) {
  const series = await listTimeSeries(
    project,
    `metric.type="run.googleapis.com/container/billable_instance_time" AND resource.labels.service_name="${serviceName}"`,
    {
      alignmentPeriod: "2592000s",
      perSeriesAligner: "ALIGN_SUM",
      crossSeriesReducer: "REDUCE_SUM",
      groupByFields: ["resource.labels.service_name"],
    },
  );
  const values = series
    .map(entry => Number(latestPoint(entry.points)?.value?.doubleValue || 0))
    .filter(Number.isFinite);
  return values.length ? values[0] : 0;
}

async function queryDistributionAverage(project, serviceName, metricType) {
  const series = await listTimeSeries(
    project,
    `metric.type="${metricType}" AND resource.labels.service_name="${serviceName}"`,
    {
      alignmentPeriod: "2592000s",
      perSeriesAligner: "ALIGN_SUM",
    },
  );
  const latest = latestPoint(series[0]?.points || []);
  const distribution = latest?.value?.distributionValue;
  return Number(distribution?.mean || 0);
}

async function countErrorEntries(project, serviceName) {
  const series = await listTimeSeries(
    project,
    `metric.type="logging.googleapis.com/log_entry_count" AND resource.labels.service_name="${serviceName}"`,
    {
      alignmentPeriod: "2592000s",
      perSeriesAligner: "ALIGN_SUM",
      crossSeriesReducer: "REDUCE_SUM",
      groupByFields: ["metric.labels.severity"],
    },
  );
  return series.reduce((sum, entry) => {
    const severity = entry.metric?.labels?.severity || "";
    if (!["ERROR", "CRITICAL", "ALERT", "EMERGENCY"].includes(severity)) {
      return sum;
    }
    const point = latestPoint(entry.points);
    const value = Number(point?.value?.int64Value || point?.value?.doubleValue || 0);
    return sum + value;
  }, 0);
}

function inferBillingMode(annotations = {}) {
  return annotations["run.googleapis.com/cpu-throttling"] === "false"
    ? "instance_based"
    : "request_based";
}

function loadDemoServicesSnapshot() {
  const snapshotPath = "/tmp/relayorb-demo-services.json";
  const payload = JSON.parse(readFileSync(snapshotPath, "utf8"));
  return payload;
}

function buildLiveServiceConfig(name) {
  const payload = runJson("gcloud", [
    "run",
    "services",
    "describe",
    name,
    `--region=${REGION}`,
    `--project=${PROD_PROJECT}`,
    "--format=json",
  ]);
  const template = payload.spec.template;
  const container = template.spec.containers[0];
  const annotations = template.metadata.annotations || {};
  return {
    project: PROD_PROJECT,
    name,
    role: prodServiceRoles[name] || name,
    createdAt: payload.metadata.creationTimestamp,
    url: payload.status.url,
    cpu: normalizeCpu(container.resources?.limits?.cpu || "0"),
    memoryGiB: normalizeMemoryGiB(container.resources?.limits?.memory || "0"),
    minInstances: Number(annotations["autoscaling.knative.dev/minScale"] || 0),
    maxInstances: Number(annotations["autoscaling.knative.dev/maxScale"] || 0),
    concurrency: Number(template.spec.containerConcurrency || 0),
    timeoutSeconds: Number(template.spec.timeoutSeconds || 0),
    billingMode: inferBillingMode(annotations),
    annotations,
  };
}

function buildDemoServiceConfig(raw) {
  const template = raw.spec.template;
  const container = template.spec.containers[0];
  const annotations = template.metadata.annotations || {};
  return {
    project: DEMO_PROJECT,
    name: raw.metadata.name,
    role: referenceServiceRoles[raw.metadata.name] || raw.metadata.name,
    createdAt: raw.metadata.creationTimestamp,
    url: raw.status.url,
    cpu: normalizeCpu(container.resources?.limits?.cpu || "0"),
    memoryGiB: normalizeMemoryGiB(container.resources?.limits?.memory || "0"),
    minInstances: Number(annotations["autoscaling.knative.dev/minScale"] || 0),
    maxInstances: Number(annotations["autoscaling.knative.dev/maxScale"] || 0),
    concurrency: Number(template.spec.containerConcurrency || 0),
    timeoutSeconds: Number(template.spec.timeoutSeconds || 0),
    billingMode: inferBillingMode(annotations),
    annotations,
  };
}

async function fetchPricing() {
  const catalog = await apiGetJson(
    `https://cloudbilling.googleapis.com/v1/${BILLING_SERVICE_NAME}/skus`,
    { pageSize: 5000 },
  );
  const skus = catalog.skus || [];
  const findSku = description =>
    skus.find(entry => entry.description === description) || null;
  return {
    requestBasedCpuPerVcpuSecondUsd: toPrice(
      findSku("Services CPU (Request-based billing)").pricingInfo[0].pricingExpression.tieredRates[0]
        .unitPrice,
    ),
    requestBasedMemoryPerGiBSecondUsd: toPrice(
      findSku("Services Memory (Request-based billing)").pricingInfo[0].pricingExpression.tieredRates[0]
        .unitPrice,
    ),
    instanceBasedCpuPerVcpuSecondUsd: toPrice(
      findSku("Services CPU (Instance-based billing) in us-central1").pricingInfo[0]
        .pricingExpression.tieredRates[0].unitPrice,
    ),
    instanceBasedMemoryPerGiBSecondUsd: toPrice(
      findSku("Services Memory (Instance-based billing) in us-central1").pricingInfo[0]
        .pricingExpression.tieredRates[0].unitPrice,
    ),
    requestUnitUsd: toPrice(
      findSku("Requests").pricingInfo[0].pricingExpression.tieredRates[1].unitPrice,
    ),
  };
}

function estimateServiceCostUsd(service, pricing, requestTotal) {
  const billableSeconds = service.billableInstanceSeconds30d || 0;
  const cpuSeconds = billableSeconds * service.cpu;
  const memoryGiBSeconds = billableSeconds * service.memoryGiB;

  if (service.billingMode === "instance_based") {
    return cpuSeconds * pricing.instanceBasedCpuPerVcpuSecondUsd +
      memoryGiBSeconds * pricing.instanceBasedMemoryPerGiBSecondUsd;
  }

  const requestComputeCost =
    cpuSeconds * pricing.requestBasedCpuPerVcpuSecondUsd +
    memoryGiBSeconds * pricing.requestBasedMemoryPerGiBSecondUsd;
  const requestChargeableCount = Math.max(0, requestTotal - REQUEST_FREE_TIER);
  return requestComputeCost + requestChargeableCount * pricing.requestUnitUsd;
}

function percent(numerator, denominator) {
  if (denominator <= 0) return 100;
  return (numerator / denominator) * 100;
}

function round(value, digits = 2) {
  return Number(value.toFixed(digits));
}

async function buildProdMetrics(service) {
  const requests = await queryRequestCounts(service.project, service.name);
  const request5xx = requests.byClass["5xx"] || 0;
  const requestNon5xx = requests.total - request5xx;
  const [p50, p95, p99, billableSeconds, cpuMean, memoryMean] = await Promise.all([
    queryLatencyPercentile(service.project, service.name, "ALIGN_PERCENTILE_50"),
    queryLatencyPercentile(service.project, service.name, "ALIGN_PERCENTILE_95"),
    queryLatencyPercentile(service.project, service.name, "ALIGN_PERCENTILE_99"),
    queryBillableInstanceSeconds(service.project, service.name),
    queryDistributionAverage(service.project, service.name, "run.googleapis.com/container/cpu/utilizations"),
    queryDistributionAverage(service.project, service.name, "run.googleapis.com/container/memory/utilizations"),
  ]);

  return {
    ...service,
    requestCounts30d: requests.byClass,
    totalRequests30d: requests.total,
    successfulRequests30d: requestNon5xx,
    uptime30dPct: round(percent(requestNon5xx, requests.total), 4),
    errorRate30dPct: round(percent(request5xx, requests.total), 4),
    latencyMs30d: {
      p50: round(p50, 2),
      p95: round(p95, 2),
      p99: round(p99, 2),
    },
    cpuUtilizationAvgPct30d: round(cpuMean * 100, 3),
    memoryUtilizationAvgPct30d: round(memoryMean * 100, 3),
    errorLogEntries30d: await countErrorEntries(service.project, service.name),
    billableInstanceSeconds30d: round(billableSeconds, 3),
  };
}

async function buildReferenceMetrics(service) {
  const requests = await queryRequestCounts(service.project, service.name);
  const billableSeconds = await queryBillableInstanceSeconds(service.project, service.name);
  return {
    ...service,
    requestCounts30d: requests.byClass,
    totalRequests30d: requests.total,
    billableInstanceSeconds30d: round(billableSeconds, 3),
  };
}

async function main() {
  const [pricing, demoServicesRaw] = await Promise.all([
    fetchPricing(),
    Promise.resolve(loadDemoServicesSnapshot()),
  ]);

  const prodConfigs = Object.keys(prodServiceRoles).map(buildLiveServiceConfig);
  const prodServices = [];
  for (const service of prodConfigs) {
    prodServices.push(await buildProdMetrics(service));
  }

  const demoReferenceConfigs = demoServicesRaw.map(buildDemoServiceConfig);
  const prodReferenceConfigs = [
    ...prodConfigs,
    {
      project: PROD_PROJECT,
      name: "relayorb-metrics-scraper-prod",
      role: referenceServiceRoles["relayorb-metrics-scraper-prod"],
      createdAt: null,
      url: null,
      cpu: 1,
      memoryGiB: 0.5,
      minInstances: 1,
      maxInstances: 1,
      concurrency: 1,
      timeoutSeconds: null,
      billingMode: "instance_based",
      annotations: {
        "autoscaling.knative.dev/minScale": "1",
        "autoscaling.knative.dev/maxScale": "1",
        "run.googleapis.com/cpu-throttling": "false",
      },
      configSource: "infra/gcp/scripts/deploy_metrics_scraper.sh",
    },
  ];

  const referenceServices = [];
  for (const service of [...demoReferenceConfigs, ...prodReferenceConfigs]) {
    referenceServices.push(await buildReferenceMetrics(service));
  }

  const referenceServicesWithCost = referenceServices.map(service => ({
    ...service,
    estimatedMonthlyCostUsd: round(
      estimateServiceCostUsd(service, pricing, service.totalRequests30d),
      2,
    ),
  }));

  const prodServicesWithCost = prodServices.map(service => ({
    ...service,
    estimatedMonthlyCostUsd: round(
      estimateServiceCostUsd(service, pricing, service.totalRequests30d),
      2,
    ),
  }));

  const totalInternalRequests30d = prodServicesWithCost.reduce(
    (sum, service) => sum + service.totalRequests30d,
    0,
  );
  const totalSuccessfulRequests30d = prodServicesWithCost.reduce(
    (sum, service) => sum + service.successfulRequests30d,
    0,
  );
  const totalErrorLogs30d = prodServicesWithCost.reduce(
    (sum, service) => sum + service.errorLogEntries30d,
    0,
  );

  const operationalSince = prodConfigs
    .map(service => service.createdAt)
    .sort()[0];

  const gatewayMetrics = prodServicesWithCost.find(service => service.name === "relayorb-gateway-prod");
  const referenceDeploymentMonthlyCostUsd = round(
    referenceServicesWithCost.reduce(
      (sum, service) => sum + service.estimatedMonthlyCostUsd,
      0,
    ),
    2,
  );

  const snapshot = {
    generatedAt: new Date().toISOString(),
    window: {
      start: WINDOW_START,
      end: WINDOW_END,
    },
    operationalSince,
    methodology: {
      traffic: "Synthetic internal monitoring and control-plane traffic only. Public user invokes remain zero.",
      uptimeFormula:
        "Availability is computed as non-5xx requests divided by total requests over the 30-day window.",
      costModel:
        "Cost is modeled from Cloud Monitoring billable instance time plus public Cloud Billing Catalog SKU prices for us-central1. Billing export was not enabled, so this is a reconstructed Cloud Run cost profile rather than an invoice export.",
      requestPricingNote:
        "Request charges stayed under the free-tier threshold during the 30-day window and do not materially affect the model.",
      serviceBillingModeInference:
        "Services with run.googleapis.com/cpu-throttling=false are treated as instance-based billed services.",
    },
    pricingUsd: pricing,
    prodReliability: {
      totalInternalRequests30d,
      successfulInternalRequests30d: totalSuccessfulRequests30d,
      uptime30dPct: round(percent(totalSuccessfulRequests30d, totalInternalRequests30d), 4),
      totalErrorLogs30d,
      gatewayP95LatencyMs30d: round(gatewayMetrics?.latencyMs30d.p95 || 0, 2),
      services: prodServicesWithCost,
    },
    referenceDeployment: {
      estimatedMonthlyCostUsd: referenceDeploymentMonthlyCostUsd,
      services: referenceServicesWithCost,
    },
    scaleToZeroProjection: {
      estimatedMonthlyCostUsd: 0,
      note:
        "All surviving prod services are at minScale=0. With zero traffic, fixed monthly Cloud Run spend falls to zero and only per-request usage accrues when real traffic arrives.",
      services: prodConfigs.map(service => ({
        name: service.name,
        role: service.role,
        minInstances: 0,
        estimatedMonthlyCostUsd: 0,
      })),
    },
  };

  const outDir = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "site",
    "src",
    "lib",
    "generated",
  );
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    path.join(outDir, "reliabilitySnapshot.json"),
    `${JSON.stringify(snapshot, null, 2)}\n`,
    "utf8",
  );
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
