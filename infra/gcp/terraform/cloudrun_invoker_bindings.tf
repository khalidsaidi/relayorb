# Authoritative run.invoker bindings for private services.
# Using *_iam_binding ensures unmanaged principals (for example allUsers)
# are removed for this role.

resource "google_cloud_run_v2_service_iam_binding" "registry_invoker" {
  project  = var.project_id
  location = var.region
  name     = var.registry_service_name
  role     = "roles/run.invoker"
  members = [
    "serviceAccount:${local.gateway_runtime_sa_email}",
    "serviceAccount:${local.worker_runtime_sa_email}",
    "serviceAccount:${local.metrics_scraper_sa_email}",
  ]
}

resource "google_cloud_run_v2_service_iam_binding" "worker_invoker" {
  project  = var.project_id
  location = var.region
  name     = var.worker_service_name
  role     = "roles/run.invoker"
  members = [
    "serviceAccount:${local.gateway_runtime_sa_email}",
    "serviceAccount:${local.metrics_scraper_sa_email}",
  ]
}
