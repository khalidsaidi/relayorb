# Pipeline Alerts Service

Email alerts for RelayOrb pipeline failures.

## Overview

This service:
1. Runs the pipeline verification checks
2. Sends email alerts to all registered users when issues are detected
3. Has a 30-minute cooldown per issue to avoid spam

## Deployment

### 1. Build and Push

```bash
cd deploy/pipeline-alerts

# Build
docker build -t gcr.io/relayorb/pipeline-alerts .

# Push
docker push gcr.io/relayorb/pipeline-alerts
```

### 2. Create SMTP Secret

You need an SMTP service. For Gmail, create an "App Password":
1. Go to Google Account → Security → 2-Step Verification → App passwords
2. Create a new app password for "Mail"

```bash
echo -n "your-app-password" | gcloud secrets create relayorb-smtp-pass \
  --data-file=- \
  --replication-policy="automatic"

# Grant access to the Cloud Run service account
gcloud secrets add-iam-policy-binding relayorb-smtp-pass \
  --member="serviceAccount:1071103469376-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### 3. Deploy as Cloud Run Job

```bash
gcloud run jobs create pipeline-alerts \
  --image=gcr.io/relayorb/pipeline-alerts \
  --region=us-east1 \
  --memory=512Mi \
  --set-env-vars="FIREBASE_PROJECT_ID=relayorb" \
  --set-env-vars="SMTP_HOST=smtp.gmail.com" \
  --set-env-vars="SMTP_PORT=587" \
  --set-env-vars="SMTP_USER=your-email@gmail.com" \
  --set-env-vars="ALERT_FROM_EMAIL=alerts@relayorb.app" \
  --set-secrets="SMTP_PASS=relayorb-smtp-pass:latest"
```

### 4. Schedule the Job

Run every 5 minutes:

```bash
gcloud scheduler jobs create http pipeline-alerts-scheduler \
  --location=us-east1 \
  --schedule="*/5 * * * *" \
  --uri="https://us-east1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/relayorb/jobs/pipeline-alerts:run" \
  --http-method=POST \
  --oauth-service-account-email=1071103469376-compute@developer.gserviceaccount.com
```

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `FIREBASE_PROJECT_ID` | Firebase project ID | `relayorb` |
| `SMTP_HOST` | SMTP server | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | SMTP username | Required |
| `SMTP_PASS` | SMTP password | Required |
| `ALERT_FROM_EMAIL` | From address | `alerts@relayorb.app` |

## Alert Cooldown

To prevent spam, each unique set of errors triggers at most one alert every 30 minutes.

## Testing Locally

```bash
# Set environment variables
export FIREBASE_PROJECT_ID=relayorb
export SMTP_HOST=smtp.gmail.com
export SMTP_PORT=587
export SMTP_USER=your-email@gmail.com
export SMTP_PASS=your-app-password
export ALERT_FROM_EMAIL=alerts@relayorb.app

# Run
npm install
node index.js
```
