# Activity-Based Refresh System

## Overview

The activity-based refresh system automatically boosts market-intel frequency from 5 minutes to 1-2 minutes when users are actively using the site. This provides better trading opportunities while saving costs when no one is viewing.

## How It Works

### 1. Frontend Presence Tracking (`src/features/presence/use-presence.ts`)
- **Automatic**: Tracks user activity when logged in
- **Events**: Monitors mouse, keyboard, scroll, touch events
- **Heartbeat**: Updates every 45 seconds while tab is visible
- **Disconnect**: Automatically marks user as inactive when tab closes
- **Rate-limited**: Max once per 30 seconds to avoid excessive writes

### 2. Activity Monitor Cloud Function (`deploy/activity-monitor/`)
- **Schedule**: Runs every 1 minute
- **Checks**: Presence collection for active users (lastSeen < 90 seconds)
- **Action**: Triggers market-intel if:
  - Active users detected
  - Last run was > 90 seconds ago (prevents spam)
- **Fallback**: Base scheduler continues at 5 minutes regardless

### 3. Integration Points
- **AppShell**: Automatically tracks presence on all pages
- **Firestore**: Stores presence in `presence/{userId}` collection
- **Activity Meta**: Tracks boost status in `market/activity` document

## Refresh Frequencies

### Normal Mode (No Active Users)
- **Market-Intel**: Every 5 minutes (base scheduler)
- **Cost**: Minimal - only runs when scheduled

### Boost Mode (Active Users Detected)
- **Market-Intel**: Every 1-2 minutes (when active users present)
- **Minimum Interval**: 90 seconds between boosted runs
- **Cost**: Slightly higher, but only when needed

### Manual Refresh
- **Dashboard**: "Refresh Now" button triggers immediate run
- **Trade Now**: "Refresh Now" button triggers immediate run
- **No Frequency Change**: Manual triggers don't affect scheduled runs

## Cost Optimization

### Before Activity-Based System
```
Market-intel: 288 runs/day (every 5 min) = Base cost
```

### With Activity-Based System
```
Market-intel base: 288 runs/day (every 5 min) = Base cost
Market-intel boosts: ~100-200 runs/day (when active) = Additional cost
Activity monitor: 1,440 invocations/day (every 1 min) = Very cheap (check only)
Cloud Function cost: ~$0.01/month

Savings: Only pay for fast updates when actually needed
```

## User Experience

### Automatic (No Action Required)
- ✅ Just use the site - presence tracking happens automatically
- ✅ Faster updates (1-2 min) when you're actively viewing
- ✅ Normal updates (5 min) when you're not on the site

### What Triggers Boost Mode
1. User is logged in and viewing any page
2. User interacts with the site (mouse, keyboard, scroll)
3. Tab is visible (not minimized/hidden)
4. Last activity within 90 seconds

### What Doesn't Trigger Boost Mode
- User not logged in
- Tab minimized or hidden
- No activity for > 90 seconds
- Multiple tabs open but inactive

## Deployment

### 1. Deploy Activity Monitor Cloud Function

```bash
cd deploy/activity-monitor
npm install

# Deploy using Firebase Functions
firebase deploy --only functions:activityMonitor

# OR deploy using Cloud Functions
gcloud functions deploy activityMonitor \
  --gen2 \
  --runtime=nodejs18 \
  --region=us-west1 \
  --source=. \
  --entry-point=activityMonitor \
  --trigger-schedule="every 1 minutes" \
  --memory=256MiB \
  --timeout=60s
```

### 2. Verify Presence Tracking

Check that presence is being tracked:
```bash
# View presence collection
firebase firestore:get presence/{userId}

# Or via code
const presence = await db.collection('presence').doc(userId).get()
console.log(presence.data())
```

### 3. Monitor Activity

Check boost status:
```bash
# View activity metadata
firebase firestore:get market/activity

# Check Cloud Function logs
gcloud functions logs read activityMonitor --limit=50
```

## Troubleshooting

### Boost Mode Not Working?

1. **Check Presence Collection**
   ```javascript
   const presence = await db.collection('presence').where('active', '==', true).get()
   console.log('Active users:', presence.size)
   ```

2. **Verify Cloud Function**
   - Check deployment: `gcloud functions describe activityMonitor`
   - Check logs: `gcloud functions logs read activityMonitor`
   - Verify schedule: Should run every 1 minute

3. **Check User Activity**
   - Ensure user is logged in
   - Check browser console for presence errors
   - Verify Firestore rules allow presence writes

4. **Check Last Boost**
   ```javascript
   const activity = await db.doc('market/activity').get()
   console.log('Last boosted:', activity.data()?.lastBoostedAt)
   ```

## Future Enhancements

### Potential Additions
- **Manual Boost Toggle**: Allow users to manually enable boost mode
- **Boost Duration**: Set how long to stay boosted after activity
- **Per-User Settings**: Customize refresh frequency per user
- **Notifications**: Alert when boost mode activates/deactivates

### Performance Optimizations
- **Batch Presence Updates**: Reduce Firestore writes
- **Smart Detection**: Only boost when on trading pages
- **Rate Limiting**: Adjust based on actual trading activity

## Summary

✅ **Automatic**: No configuration needed - just use the site  
✅ **Cost-Effective**: Only pays for fast updates when needed  
✅ **Better Trading**: Faster updates (1-2 min) when actively trading  
✅ **Fallback**: Always maintains 5-minute minimum refresh  
✅ **Zero Maintenance**: Once deployed, works automatically  

The system ensures you get fast updates when trading, while saving costs when not actively using the site.
