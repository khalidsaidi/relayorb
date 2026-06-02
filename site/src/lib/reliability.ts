import snapshot from "@/lib/generated/reliabilitySnapshot.json";

type Snapshot = typeof snapshot;

export type RelayOrbReliabilitySnapshot = Snapshot;
export type RelayOrbReliabilityService = Snapshot["prodReliability"]["services"][number];
export type RelayOrbReferenceService = Snapshot["referenceDeployment"]["services"][number];

export function getRelayOrbReliabilitySnapshot(): RelayOrbReliabilitySnapshot {
  return snapshot;
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
