# RelayOrb API

## Gateway

### POST `/v1/invoke`

Request:
```json
{
  "requestId": "8f5b5b6a-8d10-4a45-89b6-89fb67235d50",
  "caller": {
    "agentId": "agent-123",
    "role": "researcher",
    "budgetKey": "team-a"
  },
  "capability": "rag.search@v1",
  "payload": { "query": "market risk", "topK": 3 },
  "trace": { "parentSpanId": "optional" }
}
```

Success response:
```json
{
  "requestId": "8f5b5b6a-8d10-4a45-89b6-89fb67235d50",
  "traceId": "2c3fcf67-2fa1-44f1-9ff9-d7ba88ab8dc2",
  "status": "ok",
  "data": {
    "results": [{ "id": "doc-1", "text": "...", "score": 0.95 }],
    "provider": "worker-mock-rag"
  },
  "meta": {
    "routedTo": "http://worker:8090",
    "latencyMs": 42,
    "retries": 0,
    "traceId": "2c3fcf67-2fa1-44f1-9ff9-d7ba88ab8dc2"
  }
}
```

### POST `/v1/batchInvoke`

Request: array of `/v1/invoke` payloads.
Each item is processed independently.

### GET `/v1/replay/:requestId`

Returns canonical request artifact and stored response for replay/audit.

## Registry

### POST `/v1/register`
Worker self-registers instance + manifests with TTL.

### POST `/v1/heartbeat`
Worker refreshes TTL and uploads load stats.

### GET `/v1/capabilities/:capabilityId`
Returns manifest and provider list.

### GET `/v1/discover?prefix=rag.`
Returns matching capability IDs.

## Error shape

All services return:
```json
{
  "requestId": "...",
  "traceId": "...",
  "status": "error",
  "error": {
    "code": "SCHEMA_VALIDATION_FAILED",
    "message": "human readable",
    "details": {}
  }
}
```
