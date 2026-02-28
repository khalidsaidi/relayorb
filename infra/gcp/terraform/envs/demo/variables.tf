variable "project_id" {
  type        = string
  description = "Demo GCP project ID"
  default     = "relayorb-demo"
}

variable "region" {
  type        = string
  description = "Demo deployment region"
  default     = "us-central1"
}

variable "release_version" {
  type        = string
  description = "Release version label"
  default     = "demo"
}

variable "gateway_service_name" {
  type    = string
  default = "relayorb-gateway-demo"
}

variable "registry_service_name" {
  type    = string
  default = "relayorb-registry-demo"
}

variable "worker_service_name" {
  type    = string
  default = "relayorb-rag-demo"
}

variable "scraper_service_name" {
  type    = string
  default = "relayorb-metrics-scraper-demo"
}

variable "gateway_service_account_id" {
  type    = string
  default = "relayorb-gateway-demo-sa"
}

variable "registry_service_account_id" {
  type    = string
  default = "relayorb-registry-demo-sa"
}

variable "worker_service_account_id" {
  type    = string
  default = "relayorb-rag-demo-sa"
}

variable "scraper_service_account_id" {
  type    = string
  default = "relayorb-otel-scraper-demo-sa"
}

variable "gateway_image" {
  type        = string
  description = "Container image for gateway demo"
}

variable "registry_image" {
  type        = string
  description = "Container image for registry demo"
}

variable "worker_image" {
  type        = string
  description = "Container image for worker demo"
}

variable "scraper_image" {
  type        = string
  description = "Container image for metrics scraper demo"
}

variable "gateway_metrics_secret_name" {
  type    = string
  default = "relayorb-demo-gateway-metrics-token"
}

variable "registry_metrics_secret_name" {
  type    = string
  default = "relayorb-demo-registry-metrics-token"
}

variable "worker_metrics_secret_name" {
  type    = string
  default = "relayorb-demo-worker-metrics-token"
}

variable "demo_allowed_capabilities" {
  type    = list(string)
  default = ["rag.search@v1", "demo.echo@v1"]
}

variable "demo_max_request_bytes" {
  type    = number
  default = 32768
}

variable "demo_rate_limit_per_minute" {
  type    = number
  default = 30
}

variable "demo_rate_limit_burst" {
  type    = number
  default = 10
}

variable "demo_cache_ttl_seconds" {
  type    = number
  default = 45
}

variable "demo_domain_name" {
  type        = string
  description = "Optional custom domain for HTTPS certificate"
  default     = ""
}

variable "cloud_armor_rate_limit_per_minute" {
  type    = number
  default = 60
}

variable "gateway_max_instances" {
  type    = number
  default = 5
}

variable "gateway_concurrency" {
  type    = number
  default = 20
}

variable "gateway_timeout_seconds" {
  type    = number
  default = 10
}

variable "gateway_cpu" {
  type    = number
  default = 1
}

variable "gateway_memory" {
  type    = string
  default = "512Mi"
}

variable "registry_max_instances" {
  type    = number
  default = 2
}

variable "registry_concurrency" {
  type    = number
  default = 20
}

variable "registry_timeout_seconds" {
  type    = number
  default = 10
}

variable "registry_cpu" {
  type    = number
  default = 1
}

variable "registry_memory" {
  type    = string
  default = "512Mi"
}

variable "worker_max_instances" {
  type    = number
  default = 3
}

variable "worker_concurrency" {
  type    = number
  default = 10
}

variable "worker_timeout_seconds" {
  type    = number
  default = 10
}

variable "worker_cpu" {
  type    = number
  default = 1
}

variable "worker_memory" {
  type    = string
  default = "512Mi"
}

variable "scraper_max_instances" {
  type    = number
  default = 1
}

variable "scraper_concurrency" {
  type    = number
  default = 1
}

variable "scraper_timeout_seconds" {
  type    = number
  default = 30
}

variable "scraper_cpu" {
  type    = number
  default = 1
}

variable "scraper_memory" {
  type    = string
  default = "512Mi"
}

variable "alert_gateway_5xx_ratio" {
  type    = number
  default = 0.1
}

variable "alert_gateway_429_per_second" {
  type    = number
  default = 1
}

variable "alert_gateway_p95_latency_ms" {
  type    = number
  default = 4000
}
