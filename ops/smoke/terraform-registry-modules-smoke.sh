#!/usr/bin/env bash
set -euo pipefail

# Smoke: Terraform Registry modules install + validate (with required args).
# This intentionally does NOT run plan/apply.

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

smoke_one() {
  local name="$1"
  local source="$2"
  local version="$3"

  echo
  echo "============================================================"
  echo "SMOKE: ${source}@${version}"
  echo "============================================================"

  local dir="${tmpdir}/${name}"
  mkdir -p "$dir"

  cat > "${dir}/main.tf" <<HCL
terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 4.0.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = ">= 4.0.0"
    }
  }
}

provider "google" {}
provider "google-beta" {}

module "${name}" {
  source  = "${source}"
  version = "${version}"

  # Required module arguments:
  project_id     = "relayorb-smoke"
  gateway_image  = "us-central1-docker.pkg.dev/relayorb-smoke/relayorb/placeholder-gateway:smoke"
  registry_image = "us-central1-docker.pkg.dev/relayorb-smoke/relayorb/placeholder-registry:smoke"
  worker_image   = "us-central1-docker.pkg.dev/relayorb-smoke/relayorb/placeholder-worker:smoke"
  scraper_image  = "us-central1-docker.pkg.dev/relayorb-smoke/relayorb/placeholder-scraper:smoke"
}
HCL

  (cd "$dir" && terraform init -backend=false -no-color)
  (cd "$dir" && terraform validate -no-color)
  echo "OK: ${source}@${version} init+validate"
}

smoke_one "relayorb_demo" "khalidsaidi/relayorb-demo/google" "0.1.0"
smoke_one "relayorb_prod" "khalidsaidi/relayorb/google" "0.1.1"

echo
echo "ALL MODULE SMOKES PASSED"
