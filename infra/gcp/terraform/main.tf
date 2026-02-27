terraform {
  required_version = ">= 1.6.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

resource "google_project_service" "apis" {
  for_each = toset([
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "secretmanager.googleapis.com",
    "cloudbuild.googleapis.com",
    "iam.googleapis.com",
  ])
  project = var.project_id
  service = each.value
}

resource "google_artifact_registry_repository" "relayorb" {
  location      = var.region
  repository_id = var.artifact_repo
  description   = "RelayOrb container images"
  format        = "DOCKER"

  depends_on = [google_project_service.apis]
}

resource "google_service_account" "gateway" {
  account_id   = "relayorb-gateway-sa"
  display_name = "RelayOrb Gateway SA"
}

resource "google_service_account" "registry" {
  account_id   = "relayorb-registry-sa"
  display_name = "RelayOrb Registry SA"
}

resource "google_project_iam_member" "gateway_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.gateway.email}"
}

resource "google_project_iam_member" "registry_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.registry.email}"
}
