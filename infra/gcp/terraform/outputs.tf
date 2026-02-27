output "gateway_service_account" {
  value = google_service_account.gateway.email
}

output "registry_service_account" {
  value = google_service_account.registry.email
}

output "artifact_repo" {
  value = google_artifact_registry_repository.relayorb.id
}
