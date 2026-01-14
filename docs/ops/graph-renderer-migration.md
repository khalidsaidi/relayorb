OPS Graph Renderer Migration (React Flow -> Cytoscape)

Why Cytoscape
- React Flow re-rendered on every event, which caused flicker and layout churn.
- Cytoscape renders the graph on canvas/WebGL and lets us update styles without re-creating elements.
- The topology model + event schema stay the source of truth; only the renderer changed.

Topology Mapping
- graph_topology.json remains the source of truth.
- Node element:
  - data.id = node.id
  - data.label = node.label (plus optional meta lines)
  - position = fixed layout position (x,y)
- Edge element:
  - data.id = edge.id (must equal edgeKey from events)
  - data.source = edge.from
  - data.target = edge.to
  - data.kind = edge.kind (read/write/call/event/trigger)
- Dynamic providers/bot engines are appended by OpsGraphPage using discovery (no schema changes).

Pulsing + Intensity
- CytoscapeGraph keeps intensity maps in refs (edgeIntensity/nodeIntensity).
- applyEvents(...) boosts intensity for edges/nodes referenced in pipeline_events.
- requestAnimationFrame loop decays intensity and updates styles:
  - edge width + opacity
  - node border/glow
  - dash offset for flow effect

Trace Mode + Dimming
- Focus Flow uses active batch edges/nodes.
- Filters (batchId/symbolKey/providerId/botEngineId) build trace sets from the indexed event buffer.
- CytoscapeGraph dims non-trace elements and highlights trace/hover/selection.
  - Indexes: byBatchId, bySymbolKey, byProviderId, byBotEngineId (built from renderEvents).

Feature Flag
- VITE_OPS_GRAPH_RENDERER=cyto | reactflow
- Default is "cyto" for production; "reactflow" remains for fallback.

Debugging EdgeKey Mismatches
- If an edge never pulses, confirm event.edgeKey matches graph_topology.json edge id.
- Use normalizeEdgeKey(...) + parseEdgeKey(...) in OpsGraphPage for mapping.
- Unknown edges discovered from events are added to stableExtraEdges; verify they are in edgeSpecs.

Notes
- Layout is fixed by positions from topology or the flow layout helper.
- Cytoscape never re-runs layout on events (no flicker).
