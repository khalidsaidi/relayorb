output "gateway_service_account" {
  value = google_service_account.gateway.email
}

output "registry_service_account" {
  value = google_service_account.registry.email
}

output "metrics_scraper_service_account" {
  value = google_service_account.metrics_scraper.email
}

output "artifact_repo" {
  value = google_artifact_registry_repository.relayorb.id
}

output "monitoring_alert_policies" {
  value = {
    gateway_error_rate           = google_monitoring_alert_policy.gateway_error_rate.name
    registry_healthy_providers_0 = google_monitoring_alert_policy.registry_healthy_providers_zero.name
    gateway_jobs_queued_high     = google_monitoring_alert_policy.gateway_jobs_queued_high.name
  }
}
