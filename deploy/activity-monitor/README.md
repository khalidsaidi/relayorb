# Activity Monitor (Cloud Function)

Monitors user activity and automatically boosts market-intel refresh frequency when users are actively using the site. This saves costs by only running faster updates when needed.

## How It Works

1. **Frontend** automatically tracks user presence when viewing the site (via `usePresence` hook)
2. **Cloud Function** runs every minute to check for active users
3. If active users detected AND last run was > 90 seconds ago, it triggers market-intel
4. **Base scheduler** continues to run every 5 minutes as fallback

## Benefits

- **Cost-effective**: Only boosts frequency when users are active
- **Better for trading**: Faster updates (1-2 min) when you're actively trading
- **Automatic**: No manual intervention needed - just use the site
- **Fallback**: Base 5-minute schedule ensures data stays fresh even when inactive

## Deployment

### Option 1: Firebase Functions (Recommended)

```bash
cd deploy/activity-monitor
firebase deploy --only functions:activityMonitor
```

### Option 2: Cloud Scheduler + Cloud Run

```bash
# Build and deploy as Cloud Run function
gcloud functions deploy activityMonitor \
  --gen2 \
  --runtime=nodejs18 \
  --region=us-west1 \
  --source=. \
  --entry-point=activityMonitor \
  --trigger-schedule="every 1 minutes" \
  --memory=256MiB \
  --timeout=60s \
  --service-account=relayorb-functions@relayorb.iam.gserviceaccount.com
```

## Configuration

The function checks for:
- Active users: `lastSeen` within last 90 seconds AND `active: true`
- Minimum boost interval: 90 seconds (prevents too many runs)
- Base scheduler: Continues at 5 minutes regardless

## Monitoring

Check activity status:
```bash
# View activity metadata
firebase firestore:get market/activity

# View presence collection
firebase firestore:get presence/{userId}
```

## Cost Analysis

**Without activity monitor:**
- Market-intel: 288 runs/day × cost/run

**With activity monitor:**
- Market-intel base: 288 runs/day (5 min schedule)
- Market-intel boosts: ~100-200 runs/day (when active users)
- Cloud Function: 1,440 invocations/day (1 min schedule) - very cheap
- **Savings**: Only pay for fast updates when actually needed

## Troubleshooting

If boosts aren't working:
1. Check presence collection: `firestore.collection('presence')`
2. Verify Cloud Function is deployed and running
3. Check Cloud Function logs: `gcloud functions logs read activityMonitor`
4. Verify user is logged in and active on the site
