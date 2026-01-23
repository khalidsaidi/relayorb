#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-relayorb}"
ZONE="${ZONE:-us-west1-b}"
VM_NAME="${VM_NAME:-relayorb-bot-host}"
MACHINE_TYPE="${MACHINE_TYPE:-e2-standard-4}"
DISK_SIZE="${DISK_SIZE:-100GB}"
DISK_TYPE="${DISK_TYPE:-pd-balanced}"

if [[ "$ZONE" != us-west1-* ]]; then
  echo "Refusing to create VM outside us-west1-* (got: $ZONE)." >&2
  exit 1
fi

# Use Ubuntu 22.04 LTS
IMAGE_FAMILY="ubuntu-2204-lts"
IMAGE_PROJECT="ubuntu-os-cloud"

# Create VM

gcloud config set project "$PROJECT_ID"

gcloud compute instances create "$VM_NAME" \
  --zone "$ZONE" \
  --machine-type "$MACHINE_TYPE" \
  --boot-disk-size "$DISK_SIZE" \
  --boot-disk-type "$DISK_TYPE" \
  --image-family "$IMAGE_FAMILY" \
  --image-project "$IMAGE_PROJECT" \
  --tags "relayorb-bot-host"

echo "VM created: $VM_NAME in $ZONE"
