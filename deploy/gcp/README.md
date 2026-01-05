# GCP VM Deployment (Bot Host)

This provisions a production bot host on a GCP VM and runs the bot stack in Docker Compose.

## 1) Create the VM
```bash
PROJECT_ID=relayorb \
ZONE=us-west1-b \
VM_NAME=relayorb-bot-host \
MACHINE_TYPE=e2-standard-4 \
DISK_SIZE=100GB \
DISK_TYPE=pd-balanced \
./create-vm.sh
```

## 2) SSH in and bootstrap
```bash
gcloud compute ssh relayorb-bot-host --zone us-west1-b

# Copy the bootstrap script:
gcloud compute scp ./bootstrap.sh relayorb-bot-host:~/ --zone us-west1-b

# On the VM:
chmod +x ~/bootstrap.sh
~/bootstrap.sh
```

## 3) Configure the bot stack
```bash
cd /opt/relayorb/deploy/bot-host
cp agent-config/config.example.json agent-config/config.json
cp freqtrade/config.example.json freqtrade/config.json
cp hummingbot/.env.example hummingbot/.env
cp jesse/.env.example jesse/.env

# Copy the Firebase service account JSON into:
#   /opt/relayorb/deploy/bot-host/secrets/service-account.json
```

Initialize Jesse:
```bash
docker run --rm -it -v "$PWD/jesse:/workspace" salehmir/jesse jesse make-project .
```

Start the stack:
```bash
docker compose up -d
```

## Firewall
No inbound ports are required for RelayOrb control. The bot host only needs outbound access to Firestore.
If you want to debug APIs, use SSH port forwarding instead of opening ports publicly.

## Notes
- For higher availability, pin images to specific tags and enable VM monitoring.
- Consider moving Postgres to Cloud SQL once you scale Hummingbot API usage.
