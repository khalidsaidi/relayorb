variable "project_id" {
  type        = string
  description = "GCP project ID"
  default     = "relayorb-prod"
}

variable "region" {
  type        = string
  description = "Deployment region"
  default     = "us-central1"
}

variable "artifact_repo" {
  type        = string
  description = "Artifact Registry repository ID"
  default     = "relayorb"
}

variable "metrics_scraper_service_account_id" {
  type        = string
  description = "Service account ID used by the metrics scraper runtime"
  default     = "relayorb-otel-scraper-sa"
}

variable "registry_deployer_service_account_id" {
  type        = string
  description = "Service account ID used by deploy workflows (OIDC impersonation)"
  default     = "relayorb-registry-deployer-sa"
}

variable "worker_runtime_service_account_email" {
  type        = string
  description = "Worker runtime service account email; defaults to the project default compute SA when empty"
  default     = ""
}

variable "gateway_metrics_secret_name" {
  type        = string
  description = "Secret name containing the gateway metrics bearer token"
  default     = "relayorb-prod-gateway-metrics-token"
}

variable "registry_metrics_secret_name" {
  type        = string
  description = "Secret name containing the registry metrics bearer token"
  default     = "relayorb-prod-registry-metrics-token"
}

variable "worker_metrics_secret_name" {
  type        = string
  description = "Secret name containing the worker metrics bearer token"
  default     = "relayorb-prod-worker-metrics-token"
}

variable "relayorb_env" {
  type        = string
  description = "RelayOrb environment label used in metrics filters"
  default     = "prod"
}

variable "gateway_service_name" {
  type        = string
  description = "Cloud Run gateway service name"
  default     = "relayorb-gateway-prod"
}

variable "registry_service_name" {
  type        = string
  description = "Registry service name used in metrics labels"
  default     = "relayorb-registry-prod"
}

variable "key_capability_id" {
  type        = string
  description = "Critical capability ID to monitor provider health for"
  default     = "rag.search@v1"
}

variable "gateway_error_rate_threshold" {
  type        = number
  description = "Alert threshold for gateway server error ratio"
  default     = 0.05
}

variable "gateway_jobs_queued_threshold" {
  type        = number
  description = "Alert threshold for sustained queued async jobs"
  default     = 25
}

variable "notification_channels" {
  type        = list(string)
  description = "Notification channel IDs for alert policies"
  default     = []
}
