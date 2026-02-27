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
