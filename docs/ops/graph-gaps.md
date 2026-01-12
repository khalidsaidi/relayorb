# Ops Graph Gaps (Pre-Fix Review)

Evidence used:
- docs/ops-graph/ops-graph-20260111-131637.png
- docs/ops-graph/ops-graph-20260111-143801.png
- docs/ops-graph/ops-graph-20260111-182150.png

Key gaps observed:
1) Provider lane looks disconnected from the core pipeline; upstream data sources do not visually explain where prices originate.
2) Critical writes are unclear or missing as edges (PS->Redis, MI->Firestore, AG->Firestore, SE->Firestore), so storage flow is not obvious.
3) Trigger path REF->SE is not visually clear; new_batch publish/consume and lag are not self-explanatory.
4) Provider + Bot nodes are too generic ("Provider" and "Bot Engine"), hiding which provider/bot actually ran.
5) Scoring naming is ambiguous ("Candidate Scoring" vs "Signal Evaluator") and can be read as two scorers.
6) Layout feels crowded and jammed: three stacked lanes with short, squashed edges; the diagram reads like stripes, not a flow chart.
7) Edge contrast is too low and pulse indicators are subtle; real-time flow is hard to see at a glance.
8) Console warnings appear repeatedly (React Flow nodeTypes/edgeTypes + handle id errors), adding noise and suggesting wiring issues.
