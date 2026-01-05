#!/usr/bin/env bash
set -euo pipefail

# Basic host prep for RelayOrb bot host
sudo apt-get update
sudo apt-get install -y git ca-certificates curl

# Install Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"

# Create app directory
sudo mkdir -p /opt/relayorb
sudo chown "$USER":"$USER" /opt/relayorb

cat <<'MSG'
Bootstrap complete. Log out/in so Docker group applies, then:
  git clone https://github.com/khalidsaidi/relayorb.git /opt/relayorb
  cd /opt/relayorb/deploy/bot-host
  # follow README.md
MSG
