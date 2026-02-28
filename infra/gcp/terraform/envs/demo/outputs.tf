output "gateway_service_url" {
  value = google_cloud_run_v2_service.gateway.uri
}

output "registry_service_url" {
  value = google_cloud_run_v2_service.registry.uri
}

output "worker_service_url" {
  value = google_cloud_run_v2_service.worker.uri
}

output "scraper_service_url" {
  value = google_cloud_run_v2_service.scraper.uri
}

output "demo_lb_ip" {
  value = google_compute_global_address.demo.address
}

output "demo_http_url" {
  value = "http://${google_compute_global_address.demo.address}"
}

output "demo_https_url" {
  value = var.demo_domain_name == "" ? "" : "https://${var.demo_domain_name}"
}

output "cloud_armor_policy" {
  value = google_compute_security_policy.demo.name
}
