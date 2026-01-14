Ops Graph (X6)

Why X6
- X6 is a diagramming engine with Manhattan/Metro routers that avoid node obstacles.
- We need diagram-grade orthogonal routing; X6 handles that without relying on layout bendpoints.

Layout modes
- Ops Layout (Manual): deterministic lane columns using `lane` + barycenter ordering. Stable, no flicker.
- Auto Layout (ELK): layered left-to-right positions computed on demand. Positions only; routing remains X6.

Live events mapping
- Stream source: `${VITE_REFRESH_URL}/ops/events?tail=300` via `usePipelineEvents`.
- For each event:
  - Resolve edge(s): `edgeKey` -> `from->to` or `stationId` fallbacks.
  - Resolve node(s): `nodeIds` or station fallbacks.
  - Update node stats: lastSeen, rate/min, p95, error rate.
  - Pulse edges by edge id (no new edges created).
- Freeze Live stops both pulses and metric updates.

Adding nodes/edges safely
1) Add node to `src/ops/graph_topology.json` with `id`, `label`, `category`, `lane`, `orderHint`.
2) Add edge to `src/ops/graph_topology.json` with `id`, `from`, `to`, `kind`.
3) If new stationIds appear in events, update `STATION_NODE_FALLBACK` / `STATION_EDGE_FALLBACK`.
4) If new edge kinds appear, update `EDGE_COLORS`.
