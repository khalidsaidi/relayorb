terraform {
  required_version = ">= 1.6.0"
  backend "gcs" {}

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

locals {
  env = "demo"

  gateway_allowed_capabilities = join(",", var.demo_allowed_capabilities)

  gateway_sa_email  = google_service_account.gateway.email
  registry_sa_email = google_service_account.registry.email
  worker_sa_email   = google_service_account.worker.email
  scraper_sa_email  = google_service_account.scraper.email

  lb_name_prefix = "relayorb-demo"
}

resource "google_project_service" "apis" {
  for_each = toset([
    "run.googleapis.com",
    "compute.googleapis.com",
    "artifactregistry.googleapis.com",
    "secretmanager.googleapis.com",
    "cloudbuild.googleapis.com",
    "monitoring.googleapis.com",
    "iam.googleapis.com",
  ])

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

resource "google_service_account" "gateway" {
  project      = var.project_id
  account_id   = var.gateway_service_account_id
  display_name = "RelayOrb Demo Gateway Runtime SA"
}

resource "google_service_account" "registry" {
  project      = var.project_id
  account_id   = var.registry_service_account_id
  display_name = "RelayOrb Demo Registry Runtime SA"
}

resource "google_service_account" "worker" {
  project      = var.project_id
  account_id   = var.worker_service_account_id
  display_name = "RelayOrb Demo Worker Runtime SA"
}

resource "google_service_account" "scraper" {
  project      = var.project_id
  account_id   = var.scraper_service_account_id
  display_name = "RelayOrb Demo Metrics Scraper Runtime SA"
}

resource "google_secret_manager_secret_iam_member" "gateway_metrics_token" {
  project   = var.project_id
  secret_id = "projects/${var.project_id}/secrets/${var.gateway_metrics_secret_name}"
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${local.gateway_sa_email}"
}

resource "google_secret_manager_secret_iam_member" "registry_metrics_token" {
  project   = var.project_id
  secret_id = "projects/${var.project_id}/secrets/${var.registry_metrics_secret_name}"
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${local.registry_sa_email}"
}

resource "google_secret_manager_secret_iam_member" "worker_metrics_token" {
  project   = var.project_id
  secret_id = "projects/${var.project_id}/secrets/${var.worker_metrics_secret_name}"
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${local.worker_sa_email}"
}

resource "google_secret_manager_secret_iam_member" "scraper_gateway_metrics_token" {
  project   = var.project_id
  secret_id = "projects/${var.project_id}/secrets/${var.gateway_metrics_secret_name}"
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${local.scraper_sa_email}"
}

resource "google_secret_manager_secret_iam_member" "scraper_registry_metrics_token" {
  project   = var.project_id
  secret_id = "projects/${var.project_id}/secrets/${var.registry_metrics_secret_name}"
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${local.scraper_sa_email}"
}

resource "google_secret_manager_secret_iam_member" "scraper_worker_metrics_token" {
  project   = var.project_id
  secret_id = "projects/${var.project_id}/secrets/${var.worker_metrics_secret_name}"
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${local.scraper_sa_email}"
}

resource "google_project_iam_member" "scraper_metric_writer" {
  project = var.project_id
  role    = "roles/monitoring.metricWriter"
  member  = "serviceAccount:${local.scraper_sa_email}"
}

resource "google_cloud_run_v2_service" "registry" {
  name     = var.registry_service_name
  location = var.region
  project  = var.project_id
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account                  = local.registry_sa_email
    timeout                          = "${var.registry_timeout_seconds}s"
    max_instance_request_concurrency = var.registry_concurrency

    scaling {
      min_instance_count = 0
      max_instance_count = var.registry_max_instances
    }

    containers {
      image = var.registry_image

      resources {
        limits = {
          cpu    = tostring(var.registry_cpu)
          memory = var.registry_memory
        }
      }

      env {
        name  = "RELAYORB_ENV"
        value = local.env
      }
      env {
        name  = "RELAYORB_REGION"
        value = var.region
      }
      env {
        name  = "RELAYORB_SERVICE_NAME"
        value = var.registry_service_name
      }
      env {
        name  = "RELAYORB_VERSION"
        value = var.release_version
      }
      env {
        name  = "DATABASE_URL"
        value = "sqlite:///tmp/relayorb-registry-demo.db?mode=rwc"
      }
      env {
        name  = "REGISTRY_BIND_ADDR"
        value = "0.0.0.0:8080"
      }
      env {
        name  = "REGISTRY_OWNERSHIP_POLICY_PATH"
        value = "config/registry-ownership.toml"
      }
      env {
        name  = "REGISTRY_WORKER_AUTH_MODE"
        value = "disabled"
      }
      env {
        name  = "METRICS_AUTH_MODE"
        value = "bearer"
      }
      env {
        name = "METRICS_BEARER_TOKEN"
        value_source {
          secret_key_ref {
            secret  = var.registry_metrics_secret_name
            version = "latest"
          }
        }
      }
    }
  }

  depends_on = [
    google_project_service.apis,
    google_secret_manager_secret_iam_member.registry_metrics_token,
  ]
}

resource "google_cloud_run_v2_service" "worker" {
  name     = var.worker_service_name
  location = var.region
  project  = var.project_id
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account                  = local.worker_sa_email
    timeout                          = "${var.worker_timeout_seconds}s"
    max_instance_request_concurrency = var.worker_concurrency

    scaling {
      min_instance_count = 0
      max_instance_count = var.worker_max_instances
    }

    containers {
      image = var.worker_image

      resources {
        limits = {
          cpu    = tostring(var.worker_cpu)
          memory = var.worker_memory
        }
      }

      env {
        name  = "RELAYORB_ENV"
        value = local.env
      }
      env {
        name  = "RELAYORB_REGION"
        value = var.region
      }
      env {
        name  = "RELAYORB_SERVICE_NAME"
        value = var.worker_service_name
      }
      env {
        name  = "RELAYORB_VERSION"
        value = var.release_version
      }
      env {
        name  = "WORKER_BIND_ADDR"
        value = "0.0.0.0:8080"
      }
      env {
        name  = "REGISTRY_URL"
        value = google_cloud_run_v2_service.registry.uri
      }
      env {
        name  = "REGISTRY_IDENTITY_AUDIENCE"
        value = google_cloud_run_v2_service.registry.uri
      }
      env {
        name = "RELAYORB_PUBLIC_BASE_URL"
        value = replace(
          google_cloud_run_v2_service.registry.uri,
          var.registry_service_name,
          var.worker_service_name,
        )
      }
      env {
        name  = "METRICS_AUTH_MODE"
        value = "bearer"
      }
      env {
        name = "METRICS_BEARER_TOKEN"
        value_source {
          secret_key_ref {
            secret  = var.worker_metrics_secret_name
            version = "latest"
          }
        }
      }
    }
  }

  depends_on = [
    google_project_service.apis,
    google_cloud_run_v2_service.registry,
    google_secret_manager_secret_iam_member.worker_metrics_token,
  ]
}

resource "google_cloud_run_v2_service" "gateway" {
  name     = var.gateway_service_name
  location = var.region
  project  = var.project_id
  ingress  = "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"

  template {
    service_account                  = local.gateway_sa_email
    timeout                          = "${var.gateway_timeout_seconds}s"
    max_instance_request_concurrency = var.gateway_concurrency

    scaling {
      min_instance_count = 0
      max_instance_count = var.gateway_max_instances
    }

    containers {
      image = var.gateway_image

      resources {
        limits = {
          cpu    = tostring(var.gateway_cpu)
          memory = var.gateway_memory
        }
      }

      env {
        name  = "RELAYORB_ENV"
        value = local.env
      }
      env {
        name  = "RELAYORB_REGION"
        value = var.region
      }
      env {
        name  = "RELAYORB_SERVICE_NAME"
        value = var.gateway_service_name
      }
      env {
        name  = "RELAYORB_VERSION"
        value = var.release_version
      }
      env {
        name  = "REGISTRY_URL"
        value = google_cloud_run_v2_service.registry.uri
      }
      env {
        name  = "POLICY_PATH"
        value = "config/policy.toml"
      }
      env {
        name  = "DATABASE_URL"
        value = "sqlite:///tmp/relayorb-gateway-demo.db?mode=rwc"
      }
      env {
        name  = "AUTH_MODE"
        value = "none"
      }
      env {
        name  = "PUBLIC_DEMO_MODE"
        value = "true"
      }
      env {
        name  = "DEMO_ALLOWED_CAPABILITIES"
        value = local.gateway_allowed_capabilities
      }
      env {
        name  = "DEMO_MAX_REQUEST_BYTES"
        value = tostring(var.demo_max_request_bytes)
      }
      env {
        name  = "DEMO_RATE_LIMIT_PER_MINUTE"
        value = tostring(var.demo_rate_limit_per_minute)
      }
      env {
        name  = "DEMO_RATE_LIMIT_BURST"
        value = tostring(var.demo_rate_limit_burst)
      }
      env {
        name  = "DEMO_CACHE_TTL_SECONDS"
        value = tostring(var.demo_cache_ttl_seconds)
      }
      env {
        name  = "INTERNAL_IAM_AUTH"
        value = "on"
      }
      env {
        name  = "METRICS_AUTH_MODE"
        value = "bearer"
      }
      env {
        name = "METRICS_BEARER_TOKEN"
        value_source {
          secret_key_ref {
            secret  = var.gateway_metrics_secret_name
            version = "latest"
          }
        }
      }
    }
  }

  depends_on = [
    google_project_service.apis,
    google_cloud_run_v2_service.registry,
    google_secret_manager_secret_iam_member.gateway_metrics_token,
  ]
}

resource "google_cloud_run_v2_service" "scraper" {
  name     = var.scraper_service_name
  location = var.region
  project  = var.project_id
  ingress  = "INGRESS_TRAFFIC_INTERNAL_ONLY"

  template {
    service_account                  = local.scraper_sa_email
    timeout                          = "${var.scraper_timeout_seconds}s"
    max_instance_request_concurrency = var.scraper_concurrency

    scaling {
      min_instance_count = 1
      max_instance_count = var.scraper_max_instances
    }

    containers {
      image = var.scraper_image

      resources {
        limits = {
          cpu    = tostring(var.scraper_cpu)
          memory = var.scraper_memory
        }
      }

      env {
        name  = "GCP_PROJECT"
        value = var.project_id
      }
      env {
        name  = "GCP_REGION"
        value = var.region
      }
      env {
        name  = "GATEWAY_BASE_URL"
        value = google_cloud_run_v2_service.gateway.uri
      }
      env {
        name  = "REGISTRY_BASE_URL"
        value = google_cloud_run_v2_service.registry.uri
      }
      env {
        name  = "WORKER_BASE_URL"
        value = google_cloud_run_v2_service.worker.uri
      }
      env {
        name = "GATEWAY_METRICS_TOKEN"
        value_source {
          secret_key_ref {
            secret  = var.gateway_metrics_secret_name
            version = "latest"
          }
        }
      }
      env {
        name = "REGISTRY_METRICS_TOKEN"
        value_source {
          secret_key_ref {
            secret  = var.registry_metrics_secret_name
            version = "latest"
          }
        }
      }
      env {
        name = "WORKER_METRICS_TOKEN"
        value_source {
          secret_key_ref {
            secret  = var.worker_metrics_secret_name
            version = "latest"
          }
        }
      }
    }
  }

  depends_on = [
    google_project_service.apis,
    google_cloud_run_v2_service.gateway,
    google_cloud_run_v2_service.registry,
    google_cloud_run_v2_service.worker,
    google_secret_manager_secret_iam_member.scraper_gateway_metrics_token,
    google_secret_manager_secret_iam_member.scraper_registry_metrics_token,
    google_secret_manager_secret_iam_member.scraper_worker_metrics_token,
  ]
}

resource "google_cloud_run_v2_service_iam_member" "gateway_public_invoker" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.gateway.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_binding" "registry_invokers" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.registry.name
  role     = "roles/run.invoker"
  members = [
    "serviceAccount:${local.gateway_sa_email}",
    "serviceAccount:${local.worker_sa_email}",
    "serviceAccount:${local.scraper_sa_email}",
  ]
}

resource "google_cloud_run_v2_service_iam_binding" "worker_invokers" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.worker.name
  role     = "roles/run.invoker"
  members = [
    "serviceAccount:${local.gateway_sa_email}",
    "serviceAccount:${local.scraper_sa_email}",
  ]
}

resource "google_cloud_run_v2_service_iam_binding" "scraper_invokers" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.scraper.name
  role     = "roles/run.invoker"
  members = [
    "serviceAccount:${local.scraper_sa_email}",
  ]
}

resource "google_compute_security_policy" "demo" {
  name        = "${local.lb_name_prefix}-armor"
  description = "RelayOrb anonymous demo Cloud Armor policy"
  project     = var.project_id

  rule {
    priority = 100
    action   = "allow"
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = [
          "35.191.0.0/16",
          "130.211.0.0/22",
        ]
      }
    }
    description = "Allow Google Cloud load balancer health checks"
  }

  rule {
    priority = 1000
    action   = "throttle"
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    rate_limit_options {
      conform_action = "allow"
      exceed_action  = "deny(429)"
      enforce_on_key = "IP"
      rate_limit_threshold {
        count        = var.cloud_armor_rate_limit_per_minute
        interval_sec = 60
      }
    }
    description = "Anonymous demo rate limit by source IP"
  }

  rule {
    priority = 2147483647
    action   = "allow"
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    description = "Default allow"
  }
}

resource "google_compute_region_network_endpoint_group" "gateway" {
  project               = var.project_id
  name                  = "${local.lb_name_prefix}-neg"
  region                = var.region
  network_endpoint_type = "SERVERLESS"

  cloud_run {
    service = google_cloud_run_v2_service.gateway.name
  }
}

resource "google_compute_backend_service" "gateway" {
  project               = var.project_id
  name                  = "${local.lb_name_prefix}-backend"
  protocol              = "HTTP"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  security_policy       = google_compute_security_policy.demo.id

  backend {
    group = google_compute_region_network_endpoint_group.gateway.id
  }
}

resource "google_compute_url_map" "gateway" {
  project         = var.project_id
  name            = "${local.lb_name_prefix}-url-map"
  default_service = google_compute_backend_service.gateway.id
}

resource "google_compute_target_http_proxy" "gateway" {
  project = var.project_id
  name    = "${local.lb_name_prefix}-http-proxy"
  url_map = google_compute_url_map.gateway.id
}

resource "google_compute_global_address" "demo" {
  project = var.project_id
  name    = "${local.lb_name_prefix}-ip"
}

resource "google_compute_global_forwarding_rule" "http" {
  project               = var.project_id
  name                  = "${local.lb_name_prefix}-http-fr"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  ip_protocol           = "TCP"
  ip_address            = google_compute_global_address.demo.address
  port_range            = "80"
  target                = google_compute_target_http_proxy.gateway.id
}

resource "google_compute_managed_ssl_certificate" "demo" {
  count   = var.demo_domain_name == "" ? 0 : 1
  project = var.project_id
  name    = "${local.lb_name_prefix}-cert"

  managed {
    domains = [var.demo_domain_name]
  }
}

resource "google_compute_target_https_proxy" "gateway" {
  count            = var.demo_domain_name == "" ? 0 : 1
  project          = var.project_id
  name             = "${local.lb_name_prefix}-https-proxy"
  url_map          = google_compute_url_map.gateway.id
  ssl_certificates = [google_compute_managed_ssl_certificate.demo[0].id]
}

resource "google_compute_global_forwarding_rule" "https" {
  count                 = var.demo_domain_name == "" ? 0 : 1
  project               = var.project_id
  name                  = "${local.lb_name_prefix}-https-fr"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  ip_protocol           = "TCP"
  ip_address            = google_compute_global_address.demo.address
  port_range            = "443"
  target                = google_compute_target_https_proxy.gateway[0].id
}

resource "google_monitoring_alert_policy" "gateway_5xx" {
  project      = var.project_id
  display_name = "relayorb-demo-gateway-5xx-rate"
  combiner     = "OR"
  enabled      = true

  conditions {
    display_name = "Gateway 5xx ratio too high"

    condition_threshold {
      filter             = "metric.type=\"run.googleapis.com/request_count\" resource.type=\"cloud_run_revision\" resource.label.\"service_name\"=\"${var.gateway_service_name}\" metric.label.\"response_code_class\"=\"5xx\""
      denominator_filter = "metric.type=\"run.googleapis.com/request_count\" resource.type=\"cloud_run_revision\" resource.label.\"service_name\"=\"${var.gateway_service_name}\""
      duration           = "300s"
      comparison         = "COMPARISON_GT"
      threshold_value    = var.alert_gateway_5xx_ratio

      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_RATE"
        cross_series_reducer = "REDUCE_SUM"
      }

      denominator_aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_RATE"
        cross_series_reducer = "REDUCE_SUM"
      }
    }
  }
}

resource "google_monitoring_alert_policy" "gateway_429" {
  project      = var.project_id
  display_name = "relayorb-demo-gateway-429-spike"
  combiner     = "OR"
  enabled      = true

  conditions {
    display_name = "Gateway 429 rate spike"

    condition_threshold {
      filter          = "metric.type=\"run.googleapis.com/request_count\" resource.type=\"cloud_run_revision\" resource.label.\"service_name\"=\"${var.gateway_service_name}\" metric.label.\"response_code\"=\"429\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = var.alert_gateway_429_per_second

      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_RATE"
        cross_series_reducer = "REDUCE_SUM"
      }
    }
  }
}

resource "google_monitoring_alert_policy" "gateway_latency" {
  project      = var.project_id
  display_name = "relayorb-demo-gateway-latency-p95"
  combiner     = "OR"
  enabled      = true

  conditions {
    display_name = "Gateway p95 latency high"

    condition_threshold {
      filter          = "metric.type=\"run.googleapis.com/request_latencies\" resource.type=\"cloud_run_revision\" resource.label.\"service_name\"=\"${var.gateway_service_name}\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = var.alert_gateway_p95_latency_ms

      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_PERCENTILE_95"
        cross_series_reducer = "REDUCE_MAX"
      }
    }
  }
}
