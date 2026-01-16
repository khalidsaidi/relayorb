#!/bin/bash
# Setup Google Cloud Ops Agent for centralized logging
# Run this on the GCP VM

set -e

echo "Installing Google Cloud Ops Agent..."

# Download and install the Ops Agent
curl -sSO https://dl.google.com/cloudagents/add-google-cloud-ops-agent-repo.sh
sudo bash add-google-cloud-ops-agent-repo.sh --also-install
rm add-google-cloud-ops-agent-repo.sh

echo "Configuring Ops Agent for Docker logs..."

# Create Ops Agent config for Docker container logs
sudo tee /etc/google-cloud-ops-agent/config.yaml > /dev/null <<EOF
logging:
  receivers:
    docker_logs:
      type: files
      include_paths:
        - /var/lib/docker/containers/*/*.log
      
    # Specific container logs (JSON format)
    relayorb_agent:
      type: files
      include_paths:
        - /opt/relayorb/logs/agent.log
      
    backtrader:
      type: files
      include_paths:
        - /opt/relayorb/logs/backtrader.log

  processors:
    parse_json:
      type: parse_json
      field: message
      
    add_labels:
      type: modify_fields
      fields:
        labels."service":
          copy_from: jsonPayload.service
        labels."level":
          copy_from: jsonPayload.level
        labels."bot_id":
          copy_from: jsonPayload.botId

  service:
    pipelines:
      docker_pipeline:
        receivers:
          - docker_logs
        processors:
          - parse_json
          - add_labels
      
      agent_pipeline:
        receivers:
          - relayorb_agent
        processors:
          - parse_json
          - add_labels
      
      backtrader_pipeline:
        receivers:
          - backtrader
        processors:
          - parse_json

metrics:
  receivers:
    hostmetrics:
      type: hostmetrics
      collection_interval: 60s
      
  service:
    pipelines:
      default_pipeline:
        receivers:
          - hostmetrics
EOF

# Create log directories
sudo mkdir -p /opt/relayorb/logs
sudo chown -R $USER:$USER /opt/relayorb/logs

# Restart the Ops Agent
sudo systemctl restart google-cloud-ops-agent

echo "Ops Agent installed and configured!"
echo ""
echo "To view logs in Cloud Console:"
echo "  1. Go to https://console.cloud.google.com/logs"
echo "  2. Filter by: resource.labels.instance_id=\"$(hostname)\""
echo "  3. Or search for specific services: jsonPayload.service=\"relayorb-agent\""
echo ""
echo "To verify agent is running:"
echo "  sudo systemctl status google-cloud-ops-agent"
