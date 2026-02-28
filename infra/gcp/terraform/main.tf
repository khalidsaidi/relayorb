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

resource "google_monitoring_alert_policy" "gateway_error_rate" {
  display_name          = "relayorb-prod-gateway-error-rate"
  combiner              = "OR"
  enabled               = true
  notification_channels = var.notification_channels

  documentation {
    mime_type = "text/markdown"
    content   = "Gateway server error ratio exceeded threshold for 10 minutes."
  }

  conditions {
    display_name = "Gateway 5xx ratio > threshold"

    condition_threshold {
      filter             = "metric.type=\"run.googleapis.com/request_count\" resource.type=\"cloud_run_revision\" resource.label.\"service_name\"=\"${var.gateway_service_name}\" metric.label.\"response_code_class\"=\"5xx\""
      denominator_filter = "metric.type=\"run.googleapis.com/request_count\" resource.type=\"cloud_run_revision\" resource.label.\"service_name\"=\"${var.gateway_service_name}\""
      comparison         = "COMPARISON_GT"
      threshold_value    = var.gateway_error_rate_threshold
      duration           = "600s"

      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_RATE"
        cross_series_reducer = "REDUCE_SUM"
        group_by_fields      = ["resource.label.service_name"]
      }

      denominator_aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_RATE"
        cross_series_reducer = "REDUCE_SUM"
        group_by_fields      = ["resource.label.service_name"]
      }

      trigger {
        count = 1
      }
    }
  }
}

resource "google_monitoring_alert_policy" "registry_healthy_providers_zero" {
  display_name          = "relayorb-prod-registry-healthy-providers-zero"
  combiner              = "OR"
  enabled               = true
  notification_channels = var.notification_channels

  documentation {
    mime_type = "text/markdown"
    content   = "No healthy providers are available for the critical capability."
  }

  conditions {
    display_name = "Healthy providers for key capability < 1"

    condition_threshold {
      filter          = "metric.type=\"prometheus.googleapis.com/relayorb_registry_providers_healthy/gauge\" resource.type=\"prometheus_target\" metric.label.\"env\"=\"${var.relayorb_env}\" metric.label.\"service_name\"=\"${var.registry_service_name}\" metric.label.\"capability_id\"=\"${var.key_capability_id}\""
      comparison      = "COMPARISON_LT"
      threshold_value = 1
      duration        = "300s"

      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_MIN"
        cross_series_reducer = "REDUCE_MIN"
      }

      trigger {
        count = 1
      }
    }
  }
}

resource "google_monitoring_alert_policy" "gateway_jobs_queued_high" {
  display_name          = "relayorb-prod-gateway-jobs-queued-high"
  combiner              = "OR"
  enabled               = true
  notification_channels = var.notification_channels

  documentation {
    mime_type = "text/markdown"
    content   = "Queued async jobs remained above threshold for 10 minutes."
  }

  conditions {
    display_name = "Gateway queued jobs above threshold"

    condition_threshold {
      filter          = "metric.type=\"prometheus.googleapis.com/relayorb_gateway_jobs_queued/gauge\" resource.type=\"prometheus_target\" metric.label.\"env\"=\"${var.relayorb_env}\" metric.label.\"service_name\"=\"${var.gateway_service_name}\""
      comparison      = "COMPARISON_GT"
      threshold_value = var.gateway_jobs_queued_threshold
      duration        = "600s"

      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_MAX"
        cross_series_reducer = "REDUCE_MAX"
      }

      trigger {
        count = 1
      }
    }
  }
}
