locals {
  registry_deployer_sa_email = "${var.registry_deployer_service_account_id}@${var.project_id}.iam.gserviceaccount.com"
  metrics_scraper_sa_email   = google_service_account.metrics_scraper.email
  worker_runtime_sa_email    = google_service_account.worker_runtime.email
  gateway_runtime_sa_email   = google_service_account.gateway.email

  metrics_token_secret_ids = toset([
    "projects/${var.project_id}/secrets/${var.gateway_metrics_secret_name}",
    "projects/${var.project_id}/secrets/${var.registry_metrics_secret_name}",
    "projects/${var.project_id}/secrets/${var.worker_metrics_secret_name}",
  ])
}

resource "google_service_account_iam_member" "metrics_scraper_runtime_sa_user" {
  service_account_id = google_service_account.metrics_scraper.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${local.registry_deployer_sa_email}"
}

resource "google_service_account_iam_member" "registry_runtime_sa_user" {
  service_account_id = google_service_account.registry.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${local.registry_deployer_sa_email}"
}

resource "google_service_account_iam_member" "worker_runtime_sa_user" {
  service_account_id = google_service_account.worker_runtime.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${local.registry_deployer_sa_email}"
}

resource "google_project_iam_member" "registry_deployer_monitoring_viewer" {
  project = var.project_id
  role    = "roles/monitoring.viewer"
  member  = "serviceAccount:${local.registry_deployer_sa_email}"
}

resource "google_project_iam_member" "registry_deployer_logging_viewer" {
  project = var.project_id
  role    = "roles/logging.viewer"
  member  = "serviceAccount:${local.registry_deployer_sa_email}"
}

resource "google_project_iam_member" "registry_deployer_iam_security_reviewer" {
  project = var.project_id
  role    = "roles/iam.securityReviewer"
  member  = "serviceAccount:${local.registry_deployer_sa_email}"
}

resource "google_project_iam_member" "registry_deployer_service_account_viewer" {
  project = var.project_id
  role    = "roles/iam.serviceAccountViewer"
  member  = "serviceAccount:${local.registry_deployer_sa_email}"
}

resource "google_project_iam_member" "registry_deployer_service_usage_viewer" {
  project = var.project_id
  role    = "roles/serviceusage.serviceUsageViewer"
  member  = "serviceAccount:${local.registry_deployer_sa_email}"
}

resource "google_secret_manager_secret_iam_member" "metrics_scraper_metrics_tokens" {
  for_each  = local.metrics_token_secret_ids
  project   = var.project_id
  secret_id = each.value
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${local.metrics_scraper_sa_email}"
}

resource "google_secret_manager_secret_iam_member" "worker_runtime_worker_metrics_token" {
  project   = var.project_id
  secret_id = "projects/${var.project_id}/secrets/${var.worker_metrics_secret_name}"
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${local.worker_runtime_sa_email}"
}
