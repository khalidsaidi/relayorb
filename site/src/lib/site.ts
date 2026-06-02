export const prodGatewayBaseUrl =
  "https://relayorb-gateway-prod-q7rroe2exa-uc.a.run.app";

export const links = {
  github: "https://github.com/khalidsaidi/relayorb",
  demoDocs: "https://github.com/khalidsaidi/relayorb/blob/main/docs/DEMO.md",
  prodModule:
    "https://registry.terraform.io/modules/khalidsaidi/relayorb/google/latest",
  demoModule:
    "https://registry.terraform.io/modules/khalidsaidi/relayorb-demo/google/latest",
  securityDoc:
    "https://github.com/khalidsaidi/relayorb/blob/main/SECURITY.md",
  runbookDoc:
    "https://github.com/khalidsaidi/relayorb/blob/main/docs/RUNBOOK.md",
  release: "https://github.com/khalidsaidi/relayorb/releases/tag/v0.1.2",
};

export const demoCurl = `curl -sS -X POST "https://YOUR-DEMO-URL/v1/invoke" \\
  -H "Content-Type: application/json" \\
  -d '{
    "requestId": "demo-001",
    "caller": { "agentId": "anon", "role": "demo" },
    "capability": "rag.search@v1",
    "payload": { "query": "What is RelayOrb?" }
  }'`;

export const terraformProdSnippet = `module "relayorb" {
  source  = "khalidsaidi/relayorb/google"
  version = "0.1.1"

  project_id     = "relayorb-prod"
  gateway_image  = "ghcr.io/khalidsaidi/relayorb-gateway:v0.1.1"
  registry_image = "ghcr.io/khalidsaidi/relayorb-registry:v0.1.1"
  worker_image   = "ghcr.io/khalidsaidi/relayorb-rag:v0.1.1"
  scraper_image  = "ghcr.io/khalidsaidi/relayorb-metrics-scraper:v0.1.1"
}`;

export const terraformDemoSnippet = `module "relayorb_demo" {
  source  = "khalidsaidi/relayorb-demo/google"
  version = "0.1.0"

  project_id     = "relayorb-demo"
  gateway_image  = "ghcr.io/khalidsaidi/relayorb-gateway:v0.1.1"
  registry_image = "ghcr.io/khalidsaidi/relayorb-registry:v0.1.1"
  worker_image   = "ghcr.io/khalidsaidi/relayorb-rag:v0.1.1"
  scraper_image  = "ghcr.io/khalidsaidi/relayorb-metrics-scraper:v0.1.1"
}`;
