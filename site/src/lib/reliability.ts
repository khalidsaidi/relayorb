import snapshot from "@/lib/generated/reliabilitySnapshot.json";

type Snapshot = typeof snapshot;

export type RelayOrbReliabilitySnapshot = Snapshot;
export type RelayOrbReliabilityService = Snapshot["prodReliability"]["services"][number];
export type RelayOrbReferenceService = Snapshot["referenceDeployment"]["services"][number];

export function getRelayOrbReliabilitySnapshot(): RelayOrbReliabilitySnapshot {
  return snapshot;
}

export function getRelayOrbReliabilityService(name: string) {
  return snapshot.prodReliability.services.find(service => service.name === name) ?? null;
}

export function getRelayOrbCoreReliability() {
  const services = snapshot.prodReliability.services.filter(
    service =>
      service.name === "relayorb-gateway-prod" || service.name === "relayorb-registry-prod",
  );
  const totalRequests30d = services.reduce((sum, service) => sum + service.totalRequests30d, 0);
  const successfulRequests30d = services.reduce(
    (sum, service) => sum + service.successfulRequests30d,
    0,
  );
  const uptime30dPct =
    totalRequests30d > 0 ? (successfulRequests30d / totalRequests30d) * 100 : 100;

  return {
    services,
    totalRequests30d,
    successfulRequests30d,
    uptime30dPct: Number(uptime30dPct.toFixed(4)),
  };
}

export function getRelayOrbWorkerDiagnosis() {
  return {
    status: "Resolved configuration regression",
    summary:
      "Most relayorb-rag-prod 5xx responses came from internal GET /metrics scrapes, not public invoke traffic.",
    rootCause:
      "The worker repeatedly failed startup because capability registration returned 403 Forbidden for the default compute identity instead of the allowed relayorb-rag-sa service account.",
    evidence:
      "Cloud Run startup logs show failed readiness probes and worker registration errors for capability rag.search@v1 before later scrape retries succeeded.",
    resolution:
      "Resolved 2026-06-02: relayorb-rag-prod now runs as relayorb-rag-sa@relayorb-prod.iam.gserviceaccount.com. The 30-day window on this page still reflects the pre-fix synthetic-monitoring period.",
  };
}

export function getRelayOrbCostProfile() {
  const data = getRelayOrbReliabilitySnapshot();
  return {
    operational_since: data.operationalSince,
    window: data.window,
    reference_deployment_monthly_cost_usd: data.referenceDeployment.estimatedMonthlyCostUsd,
    scale_to_zero_monthly_cost_usd: data.scaleToZeroProjection.estimatedMonthlyCostUsd,
    currency_note: data.methodology.costModel,
    service_breakdown: {
      reference_deployment: data.referenceDeployment.services.map(service => ({
        name: service.name,
        role: service.role,
        project: service.project,
        billing_mode: service.billingMode,
        min_instances: service.minInstances,
        total_requests_30d: service.totalRequests30d,
        billable_instance_seconds_30d: service.billableInstanceSeconds30d,
        estimated_monthly_cost_usd: service.estimatedMonthlyCostUsd,
      })),
      scale_to_zero: data.scaleToZeroProjection.services,
    },
    configuration_recommendation:
      "Use minScale=0 for development and demo deployments. Only pin warm instances when sustained production traffic justifies the fixed cost.",
  };
}
