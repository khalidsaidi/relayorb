"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import CameraControls from "camera-controls";
import { Line2, LineGeometry, LineMaterial, RoundedBoxGeometry } from "three-stdlib";

CameraControls.install({ THREE });

const STAGE_SECONDS = 6;
const FAILOVER_STEP_SECONDS = 6;

type SystemId = "client" | "gateway" | "policy" | "registry" | "worker" | "telemetry";
type ProviderKey = "wikipedia" | "openlibrary" | "hackernews";
type ProviderStatus = "active" | "standby" | "down";
type LayoutSnapshot = {
  systems: Record<SystemId, [number, number, number]>;
  providers: Record<ProviderKey, [number, number, number]>;
  edges: Record<string, Array<[number, number, number]>>;
};

const FLOW_STEPS = [
  "Payload In",
  "Identity Check",
  "Permission Check",
  "Provider Selection",
  "Duplicate Protection",
  "Async Dispatch",
  "Trace Record",
  "Output Out",
] as const;

const CORE_SYSTEM_CONNECTIONS: Array<{ from: SystemId; to: SystemId }> = [
  { from: "client", to: "gateway" },
  { from: "gateway", to: "policy" },
  { from: "policy", to: "registry" },
  { from: "registry", to: "gateway" },
  { from: "gateway", to: "worker" },
  { from: "worker", to: "telemetry" },
];

function buildOpenSourceLayout() {
  const systems: Record<SystemId, THREE.Vector3> = {
    client: new THREE.Vector3(-11.6, -0.24, -0.34),
    gateway: new THREE.Vector3(-7.6, -0.16, -0.24),
    policy: new THREE.Vector3(-1.3, 1.35, 0.28),
    registry: new THREE.Vector3(4.55, 1.45, 0.18),
    worker: new THREE.Vector3(-1.2, -1.9, -0.24),
    telemetry: new THREE.Vector3(4.15, -1.05, -0.08),
  };
  const providers: Record<ProviderKey, THREE.Vector3> = {
    hackernews: new THREE.Vector3(13.25, 2.45, 0.32),
    openlibrary: new THREE.Vector3(13.2, 0.18, 0.04),
    wikipedia: new THREE.Vector3(13.3, -1.95, -0.3),
  };
  return { systems, providers };
}

const OPEN_SOURCE_LAYOUT = buildOpenSourceLayout();

const SYSTEMS: Record<
  SystemId,
  { label: string; point: THREE.Vector3; color: string; emissive: string }
> = {
  client: {
    label: "Client",
    point: OPEN_SOURCE_LAYOUT.systems.client.clone(),
    color: "#10203e",
    emissive: "#2f6ac7",
  },
  gateway: {
    label: "Gateway",
    point: OPEN_SOURCE_LAYOUT.systems.gateway.clone(),
    color: "#123162",
    emissive: "#44b5ff",
  },
  policy: {
    label: "Policy Engine",
    point: OPEN_SOURCE_LAYOUT.systems.policy.clone(),
    color: "#143647",
    emissive: "#69ecff",
  },
  registry: {
    label: "Registry",
    point: OPEN_SOURCE_LAYOUT.systems.registry.clone(),
    color: "#114850",
    emissive: "#5df0d8",
  },
  worker: {
    label: "Worker",
    point: OPEN_SOURCE_LAYOUT.systems.worker.clone(),
    color: "#173560",
    emissive: "#62b5ff",
  },
  telemetry: {
    label: "Telemetry",
    point: OPEN_SOURCE_LAYOUT.systems.telemetry.clone(),
    color: "#124e4c",
    emissive: "#63f0b9",
  },
};

const SYSTEM_CONNECTIONS: Array<{ from: SystemId; to: SystemId }> = CORE_SYSTEM_CONNECTIONS;

type StoryStage = {
  title: string;
  from: SystemId;
  to: SystemId;
  fromStep: string;
  toStep: string;
  why: string;
};

const STORY_STAGES: StoryStage[] = [
  {
    title: "Identity Check",
    from: "client",
    to: "gateway",
    fromStep: "Payload In",
    toStep: "Identity Check",
    why: "Prevents unknown callers from reaching tools.",
  },
  {
    title: "Permission Check",
    from: "gateway",
    to: "policy",
    fromStep: "Identity Check",
    toStep: "Permission Check",
    why: "Prevents unauthorized roles from executing sensitive capabilities.",
  },
  {
    title: "Provider Selection",
    from: "policy",
    to: "registry",
    fromStep: "Permission Check",
    toStep: "Provider Selection",
    why: "Routes to healthy providers and fails over automatically.",
  },
  {
    title: "Duplicate Protection",
    from: "registry",
    to: "gateway",
    fromStep: "Provider Selection",
    toStep: "Duplicate Protection",
    why: "Prevents duplicate side effects when requests are retried.",
  },
  {
    title: "Async Dispatch",
    from: "gateway",
    to: "worker",
    fromStep: "Duplicate Protection",
    toStep: "Async Dispatch",
    why: "Keeps slow work off the synchronous request path.",
  },
  {
    title: "Trace Record",
    from: "worker",
    to: "telemetry",
    fromStep: "Async Dispatch",
    toStep: "Trace Record",
    why: "Records traces and metrics for debugging and audit.",
  },
];

const PROVIDER_POINTS: Record<ProviderKey, THREE.Vector3> = {
  wikipedia: OPEN_SOURCE_LAYOUT.providers.wikipedia.clone(),
  openlibrary: OPEN_SOURCE_LAYOUT.providers.openlibrary.clone(),
  hackernews: OPEN_SOURCE_LAYOUT.providers.hackernews.clone(),
};

const PROVIDER_LABELS: Record<ProviderKey, string> = {
  wikipedia: "Wikipedia",
  openlibrary: "OpenLibrary",
  hackernews: "Hacker News",
};

type FailoverStep = {
  id: string;
  status: "ok" | "timeout";
  provider: ProviderKey;
  providerName: string;
  routedTo: string;
  latencyMs?: number;
  timeoutMs?: number;
  staleRoutedTo?: string;
  description: string;
  statuses: Record<ProviderKey, ProviderStatus>;
};

const FAILOVER_STEPS: FailoverStep[] = [
  {
    id: "stage-a-ok",
    status: "ok",
    provider: "wikipedia",
    providerName: "wikipedia-search-a",
    routedTo: "http://relayorb-fleet-wiki-a:8111",
    latencyMs: 280,
    description: "Initial call succeeds on fastest provider.",
    statuses: { wikipedia: "active", openlibrary: "standby", hackernews: "standby" },
  },
  {
    id: "stage-a-timeout",
    status: "timeout",
    provider: "wikipedia",
    providerName: "wikipedia-search-a",
    routedTo: "http://relayorb-fleet-wiki-a:8111",
    timeoutMs: 8000,
    staleRoutedTo: "http://relayorb-fleet-wiki-a:8111",
    description: "Provider killed; stale route window triggers timeout.",
    statuses: { wikipedia: "down", openlibrary: "standby", hackernews: "standby" },
  },
  {
    id: "stage-b-ok",
    status: "ok",
    provider: "openlibrary",
    providerName: "openlibrary-search-a",
    routedTo: "http://relayorb-fleet-openlibrary-a:8113",
    latencyMs: 807,
    description: "After TTL convergence, traffic reroutes to OpenLibrary.",
    statuses: { wikipedia: "down", openlibrary: "active", hackernews: "standby" },
  },
  {
    id: "stage-b-timeout",
    status: "timeout",
    provider: "openlibrary",
    providerName: "openlibrary-search-a",
    routedTo: "http://relayorb-fleet-openlibrary-a:8113",
    timeoutMs: 8000,
    staleRoutedTo: "http://relayorb-fleet-openlibrary-a:8113",
    description: "Second provider killed; another bounded timeout window.",
    statuses: { wikipedia: "down", openlibrary: "down", hackernews: "standby" },
  },
  {
    id: "stage-c-ok",
    status: "ok",
    provider: "hackernews",
    providerName: "hackernews-search-a",
    routedTo: "http://relayorb-fleet-hn-a:8112",
    latencyMs: 1155,
    description: "Final reroute lands on Hacker News provider.",
    statuses: { wikipedia: "down", openlibrary: "down", hackernews: "active" },
  },
];

type ScenarioDefinition = {
  id: string;
  title: string;
  subtitle: string;
  workload: string;
  payload: Record<string, unknown>;
  relayorbDoes: string[];
  output: Record<string, unknown>;
  stageCaptions: [string, string, string, string, string, string];
};

const SCENARIOS: ScenarioDefinition[] = [
  {
    id: "fraud-decisioning",
    title: "Fraud Decisioning",
    subtitle: "Fintech card authorization in milliseconds",
    workload: "Real-time card transaction risk scoring",
    payload: {
      requestId: "fraud-2026-03-05-00041",
      caller: { agentId: "risk-bot", role: "risk_engine" },
      capability: "fraud.score@v2",
      payload: {
        txId: "txn_8F2A91",
        amount: 842.1,
        currency: "USD",
        merchant: { mcc: "5732", country: "US" },
        cardPresent: false,
        deviceId: "dev_44ad0f",
        ip: "172.58.12.44",
      },
    },
    relayorbDoes: [
      "Authenticates risk-bot and enforces role=risk_engine policy.",
      "Routes to healthy risk providers with automatic failover.",
      "Validates response schema before returning the decision.",
      "Stores trace + replay artifact for chargeback and audit.",
    ],
    output: {
      status: "ok",
      data: {
        decision: "step_up_auth",
        score: 0.87,
        reasons: ["new_device", "high_amount", "geo_velocity"],
        nextAction: "3DS_CHALLENGE",
      },
    },
    stageCaptions: [
      "Gateway verifies signed risk request from the card authorization service.",
      "Policy permits fraud.score@v2 only for risk_engine callers.",
      "Registry selects the healthiest risk provider.",
      "Duplicate txId calls return deterministic prior decision.",
      "Escalated checks can run async while auth path stays responsive.",
      "Trace links provider choice, latency, and final decision.",
    ],
  },
  {
    id: "secops-triage",
    title: "SecOps Incident Triage",
    subtitle: "SOC alert enrichment across multiple intel providers",
    workload: "High-severity suspicious login triage",
    payload: {
      requestId: "secops-2026-03-05-1882",
      caller: { agentId: "soc-bot", role: "secops_analyst" },
      capability: "incident.triage@v1",
      payload: {
        alertId: "alert-947331",
        severity: "high",
        iocs: ["185.193.88.4", "e5f6...sha256"],
        tenant: "acme-prod",
      },
    },
    relayorbDoes: [
      "Enforces least-privilege policy for sensitive incident tooling.",
      "Routes enrichment to healthy SIEM/EDR/intel providers.",
      "Applies strict output schema for machine-actionable fields.",
      "Captures complete trace for post-incident review.",
    ],
    output: {
      status: "ok",
      data: {
        disposition: "isolate_session",
        confidence: 0.92,
        correlatedSignals: ["impossible_travel", "known_bad_ip", "new_mfa_device"],
        escalation: "page_oncall",
      },
    },
    stageCaptions: [
      "Gateway verifies SOC service identity before touching security tools.",
      "Policy blocks unauthorized roles from triage capabilities.",
      "Registry routes to healthiest intel providers under load.",
      "Replay guard prevents duplicate containment actions.",
      "Long IOC enrichment chains run asynchronously.",
      "Trace records exactly which signal led to disposition.",
    ],
  },
  {
    id: "earnings-brief",
    title: "Earnings Risk Brief",
    subtitle: "Buy-side research synthesis over live market context",
    workload: "Cross-source earnings guidance risk analysis",
    payload: {
      requestId: "earnings-2026-03-05-0917",
      caller: { agentId: "research-orchestrator", role: "researcher" },
      capability: "earnings.brief@v1",
      payload: {
        tickers: ["NVDA", "TSLA"],
        horizon: "7d",
        question: "What guidance risks could move price this week?",
      },
    },
    relayorbDoes: [
      "Authenticates research agent and enforces read-only boundaries.",
      "Routes across healthy filings/news/market providers.",
      "Validates summary contract for downstream stability.",
      "Keeps replayable artifacts for PM/IC review.",
    ],
    output: {
      status: "ok",
      data: {
        headlineRisk: "margin pressure + capex uncertainty",
        confidence: 0.81,
        supportingSignals: ["10-Q guidance shift", "supplier demand softness"],
        recommendation: "hedge_before_call",
      },
    },
    stageCaptions: [
      "Gateway verifies research-orchestrator identity.",
      "Policy enforces researcher role and read-only access.",
      "Registry chooses healthiest context providers.",
      "Replay returns deterministic prior brief for same request.",
      "Long synthesis runs async when needed.",
      "Trace links every source and latency to recommendation.",
    ],
  },
];

type ProviderVisual = {
  mesh: THREE.Mesh;
  beam: Line2;
  pulse: THREE.Mesh;
};

function makeBeam(
  from: THREE.Vector3,
  to: THREE.Vector3,
  color: string,
  lineMaterials: LineMaterial[],
  options?: { linewidth?: number; opacity?: number },
): Line2 {
  const geometry = new LineGeometry();
  geometry.setPositions([from.x, from.y, from.z, to.x, to.y, to.z]);
  const material = new LineMaterial({
    color: new THREE.Color(color).getHex(),
    linewidth: options?.linewidth ?? 1.6,
    transparent: true,
    opacity: options?.opacity ?? 0.5,
    depthWrite: false,
    depthTest: false,
  });
  lineMaterials.push(material);
  const line = new Line2(geometry, material);
  line.computeLineDistances();
  return line;
}

function statusTheme(status: ProviderStatus) {
  if (status === "active") {
    return {
      nodeColor: "#0b3f4f",
      emissive: "#58f7ff",
      emissiveIntensity: 1,
      beamColor: "#58f7ff",
      beamOpacity: 0.92,
      opacity: 0.64,
    };
  }
  if (status === "down") {
    return {
      nodeColor: "#2a1319",
      emissive: "#f25d73",
      emissiveIntensity: 0.35,
      beamColor: "#f25d73",
      beamOpacity: 0.2,
      opacity: 0.25,
    };
  }
  return {
    nodeColor: "#142945",
    emissive: "#6caed8",
    emissiveIntensity: 0.42,
    beamColor: "#5aa7d6",
    beamOpacity: 0.4,
    opacity: 0.34,
  };
}

function statusBadgeStyle(status: ProviderStatus) {
  if (status === "active") {
    return { bg: "rgba(34, 211, 238, 0.22)", border: "rgba(34, 211, 238, 0.65)", text: "#7ff7ff" };
  }
  if (status === "down") {
    return { bg: "rgba(239, 68, 68, 0.2)", border: "rgba(248, 113, 113, 0.6)", text: "#fecaca" };
  }
  return { bg: "rgba(71, 85, 105, 0.28)", border: "rgba(148, 163, 184, 0.55)", text: "#cbd5e1" };
}

function easeInOut(value: number) {
  return THREE.MathUtils.smootherstep(value, 0, 1);
}

function computeEdgeRouteMap(
  positions: Record<SystemId, THREE.Vector3>,
  edges: Array<{ from: SystemId; to: SystemId }>,
) {
  const profileByKey: Record<
    string,
    { lane: number; lift: number; depth: number; style: "straight" | "soft" | "loop" }
  > = {
    "client->gateway": { lane: 0.0, lift: 0.0, depth: 0.0, style: "straight" },
    "gateway->policy": { lane: 0.12, lift: 0.34, depth: 0.03, style: "soft" },
    "policy->registry": { lane: 0.02, lift: 0.03, depth: 0.01, style: "straight" },
    "registry->gateway": { lane: -0.42, lift: -0.96, depth: -0.08, style: "loop" },
    "gateway->worker": { lane: -0.14, lift: -0.78, depth: -0.09, style: "soft" },
    "worker->telemetry": { lane: 0.12, lift: 0.24, depth: 0.02, style: "soft" },
  };

  const routeMap = new Map<string, THREE.Vector3[]>();
  for (const edge of edges) {
    const edgeKey = `${edge.from}->${edge.to}`;
    const from = positions[edge.from].clone();
    const to = positions[edge.to].clone();
    const profile = profileByKey[edgeKey] ?? { lane: 0, lift: 0, depth: 0, style: "straight" as const };

    const direction = to.clone().sub(from);
    const tangent = new THREE.Vector3(direction.x, direction.y * 0.78, 0);
    if (tangent.lengthSq() < 1e-6) {
      tangent.set(Math.sign(direction.x) || 1, 0, 0);
    }
    tangent.normalize();

    const normal = new THREE.Vector3(-tangent.y, tangent.x, 0).normalize();
    if (profile.style === "straight") {
      routeMap.set(edgeKey, [from, to]);
      continue;
    }

    if (profile.style === "soft") {
      const mid = from
        .clone()
        .lerp(to, 0.5)
        .addScaledVector(normal, profile.lane * 0.28);
      mid.y += profile.lift;
      mid.z += profile.depth;
      routeMap.set(edgeKey, [from, mid, to]);
      continue;
    }

    const p1 = from
      .clone()
      .lerp(to, 0.26)
      .addScaledVector(normal, profile.lane * 0.24);
    p1.y += profile.lift * 0.35;
    p1.z += profile.depth * 0.5;
    const p2 = from
      .clone()
      .lerp(to, 0.52)
      .addScaledVector(normal, profile.lane * 0.42);
    p2.y += profile.lift;
    p2.z += profile.depth;
    const p3 = from
      .clone()
      .lerp(to, 0.78)
      .addScaledVector(normal, profile.lane * 0.22);
    p3.y += profile.lift * 0.3;
    p3.z += profile.depth * 0.5;
    routeMap.set(edgeKey, [from, p1, p2, p3, to]);
  }
  return routeMap;
}

function smoothRoute(route: THREE.Vector3[], segments = 24) {
  const curve = new THREE.CatmullRomCurve3(
    route.map(point => point.clone()),
    false,
    "centripetal",
    0.5,
  );
  const points = curve.getPoints(segments);
  const positions = points.flatMap(point => [point.x, point.y, point.z]);
  return { curve, positions };
}

export function Capabilities3DShowcase() {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const systemLabelRefs = useRef<Record<SystemId, HTMLDivElement | null>>({
    client: null,
    gateway: null,
    policy: null,
    registry: null,
    worker: null,
    telemetry: null,
  });
  const providerLabelRefs = useRef<Record<ProviderKey, HTMLDivElement | null>>({
    wikipedia: null,
    openlibrary: null,
    hackernews: null,
  });

  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [storyIndex, setStoryIndex] = useState(0);
  const [failoverIndex, setFailoverIndex] = useState(0);
  const [layoutEditMode, setLayoutEditMode] = useState(false);
  const [layoutCopyStatus, setLayoutCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const layoutEditModeRef = useRef(false);
  const resetLayoutRef = useRef<(() => void) | null>(null);
  const exportLayoutRef = useRef<(() => LayoutSnapshot) | null>(null);

  useEffect(() => {
    layoutEditModeRef.current = layoutEditMode;
  }, [layoutEditMode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    canvas.style.cursor = layoutEditMode ? "grab" : "default";
  }, [layoutEditMode]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    if (!wrapper || !canvas) {
      return;
    }

    const systemTargets: Record<SystemId, THREE.Vector3> = {
      client: SYSTEMS.client.point.clone(),
      gateway: SYSTEMS.gateway.point.clone(),
      policy: SYSTEMS.policy.point.clone(),
      registry: SYSTEMS.registry.point.clone(),
      worker: SYSTEMS.worker.point.clone(),
      telemetry: SYSTEMS.telemetry.point.clone(),
    };
    const providerTargets: Record<ProviderKey, THREE.Vector3> = {
      wikipedia: PROVIDER_POINTS.wikipedia.clone(),
      openlibrary: PROVIDER_POINTS.openlibrary.clone(),
      hackernews: PROVIDER_POINTS.hackernews.clone(),
    };

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2("#020712", 0.026);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x020712, 0);

    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 200);
    camera.position.set(-2.4, 6.0, 14.6);

    const controls = new CameraControls(camera, renderer.domElement);
    controls.dollySpeed = 0.3;
    controls.azimuthRotateSpeed = 0.16;
    controls.polarRotateSpeed = 0.16;
    controls.minDistance = 10;
    controls.maxDistance = 30;
    controls.minPolarAngle = 0.45;
    controls.maxPolarAngle = 1.35;
    controls.smoothTime = 0.6;

    const ambient = new THREE.AmbientLight("#9ddcff", 0.62);
    const key = new THREE.DirectionalLight("#74d7ff", 1.15);
    key.position.set(7, 8, 6);
    const rim = new THREE.DirectionalLight("#32ffc7", 0.62);
    rim.position.set(-8, 5, -10);
    scene.add(ambient, key, rim);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(16, 120),
      new THREE.MeshStandardMaterial({
        color: "#0a2242",
        transparent: true,
        opacity: 0.28,
        roughness: 0.85,
        metalness: 0.08,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -3.0;
    scene.add(floor);

    const starsGeometry = new THREE.BufferGeometry();
    const stars = new Float32Array(800 * 3);
    for (let i = 0; i < stars.length; i += 3) {
      stars[i] = (Math.random() - 0.45) * 46;
      stars[i + 1] = (Math.random() - 0.5) * 23;
      stars[i + 2] = (Math.random() - 0.5) * 30;
    }
    starsGeometry.setAttribute("position", new THREE.BufferAttribute(stars, 3));
    const starfield = new THREE.Points(
      starsGeometry,
      new THREE.PointsMaterial({
        color: "#9ad8ff",
        size: 0.04,
        transparent: true,
        opacity: 0.78,
        depthWrite: false,
      }),
    );
    scene.add(starfield);

    const lineMaterials: LineMaterial[] = [];
    const draggableMeshes: THREE.Mesh[] = [];
    const edgeManualHandles = new Map<string, THREE.Vector3[]>();
    const liveEdgeRoutes = new Map<string, THREE.Vector3[]>();

    const systemVisuals = new Map<
      SystemId,
      { mesh: THREE.Mesh; halo: THREE.Mesh }
    >();

    for (const [key, system] of Object.entries(SYSTEMS) as Array<[SystemId, (typeof SYSTEMS)[SystemId]]>) {
      const mesh = new THREE.Mesh(
        new RoundedBoxGeometry(2.3, 1.3, 1.2, 5, 0.16),
        new THREE.MeshStandardMaterial({
          color: system.color,
          emissive: system.emissive,
          emissiveIntensity: 0.58,
          metalness: 0.2,
          roughness: 0.34,
          transparent: true,
          opacity: 0.5,
        }),
      );
      mesh.position.copy(systemTargets[key]);
      mesh.userData = { kind: "system", key };
      scene.add(mesh);
      draggableMeshes.push(mesh);

      const halo = new THREE.Mesh(
        new THREE.RingGeometry(0.28, 0.42, 32),
        new THREE.MeshBasicMaterial({
          color: "#8df6ff",
          transparent: true,
          opacity: 0.82,
          side: THREE.DoubleSide,
          depthWrite: false,
          depthTest: false,
        }),
      );
      halo.rotation.x = -Math.PI / 2;
      halo.position.set(systemTargets[key].x, systemTargets[key].y + 0.8, systemTargets[key].z);
      halo.visible = false;
      scene.add(halo);

      systemVisuals.set(key, { mesh, halo });
    }

    const passiveEdgeByKey = new Map<
      string,
      { line: Line2; pulse: THREE.Mesh; index: number }
    >();
    for (const [index, edge] of SYSTEM_CONNECTIONS.entries()) {
      const line = makeBeam(systemTargets[edge.from], systemTargets[edge.to], "#8fd6ff", lineMaterials, {
        linewidth: 1.8,
        opacity: 0.64,
      });
      scene.add(line);

      const pulse = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 12, 12),
        new THREE.MeshStandardMaterial({
          color: "#8be9ff",
          emissive: "#8be9ff",
          emissiveIntensity: 0.75,
          transparent: true,
          opacity: 0.6,
          depthWrite: false,
          depthTest: false,
        }),
      );
      scene.add(pulse);

      passiveEdgeByKey.set(`${edge.from}->${edge.to}`, { line, pulse, index });
    }

    const edgeHandleVisuals = new Map<string, THREE.Mesh[]>();
    const initialRouteMap = computeEdgeRouteMap(systemTargets, SYSTEM_CONNECTIONS);
    for (const edge of SYSTEM_CONNECTIONS) {
      const edgeKey = `${edge.from}->${edge.to}`;
      const route = initialRouteMap.get(edgeKey);
      if (!route || route.length < 3) {
        continue;
      }
      const handles: THREE.Mesh[] = [];
      const interiorPoints = route.slice(1, -1);
      interiorPoints.forEach((point, handleIndex) => {
        const handle = new THREE.Mesh(
          new THREE.SphereGeometry(0.09, 14, 14),
          new THREE.MeshStandardMaterial({
            color: "#f5cc71",
            emissive: "#f5cc71",
            emissiveIntensity: 0.7,
            transparent: true,
            opacity: 0.7,
            metalness: 0.06,
            roughness: 0.24,
            depthWrite: false,
            depthTest: false,
          }),
        );
        handle.position.copy(point);
        handle.visible = false;
        handle.userData = { kind: "edgeHandle", edgeKey, handleIndex };
        scene.add(handle);
        handles.push(handle);
        draggableMeshes.push(handle);
      });
      edgeHandleVisuals.set(edgeKey, handles);
    }

    const activeBeam = makeBeam(systemTargets.client, systemTargets.gateway, "#abf9ff", lineMaterials, {
      linewidth: 2.6,
      opacity: 0.96,
    });
    scene.add(activeBeam);

    const packetArrow = new THREE.Mesh(
      new THREE.ConeGeometry(0.12, 0.34, 14),
      new THREE.MeshStandardMaterial({
        color: "#9ffcff",
        emissive: "#9ffcff",
        emissiveIntensity: 1.18,
        transparent: true,
        opacity: 0.96,
        metalness: 0.12,
        roughness: 0.08,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
      }),
    );
    scene.add(packetArrow);

    const packet = new THREE.Mesh(
      new THREE.SphereGeometry(0.125, 14, 14),
      new THREE.MeshStandardMaterial({
        color: "#b4fcff",
        emissive: "#b4fcff",
        emissiveIntensity: 1.28,
        metalness: 0.12,
        roughness: 0.1,
      }),
    );
    scene.add(packet);

    const packetTrail = [0.12, 0.24, 0.38, 0.52].map((offset, i) => {
      const trail = new THREE.Mesh(
        new THREE.SphereGeometry(Math.max(0.06, 0.11 - i * 0.015), 12, 12),
        new THREE.MeshStandardMaterial({
          color: "#7ceeff",
          emissive: "#7ceeff",
          emissiveIntensity: 0.95 - i * 0.12,
          transparent: true,
          opacity: 0.64 - i * 0.11,
          depthWrite: false,
          depthTest: false,
        }),
      );
      trail.userData = { offset };
      scene.add(trail);
      return trail;
    });

    const providerVisuals = new Map<ProviderKey, ProviderVisual>();
    for (const key of Object.keys(PROVIDER_POINTS) as ProviderKey[]) {
      const point = providerTargets[key];
      const providerMesh = new THREE.Mesh(
        new RoundedBoxGeometry(2.2, 1.2, 1.1, 5, 0.16),
        new THREE.MeshStandardMaterial({
          color: "#142945",
          emissive: "#6caed8",
          emissiveIntensity: 0.5,
          metalness: 0.2,
          roughness: 0.34,
          transparent: true,
          opacity: 0.46,
        }),
      );
      providerMesh.position.copy(point);
      providerMesh.userData = { kind: "provider", key };
      scene.add(providerMesh);
      draggableMeshes.push(providerMesh);

      const providerBeam = makeBeam(systemTargets.registry, point, "#5aa7d6", lineMaterials, {
        linewidth: 1.3,
        opacity: 0.42,
      });
      scene.add(providerBeam);

      const providerPulse = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 12, 12),
        new THREE.MeshStandardMaterial({
          color: "#7cf7ff",
          emissive: "#7cf7ff",
          emissiveIntensity: 0.9,
          transparent: true,
          opacity: 0.9,
          depthWrite: false,
          depthTest: false,
        }),
      );
      providerPulse.visible = false;
      scene.add(providerPulse);

      providerVisuals.set(key, {
        mesh: providerMesh,
        beam: providerBeam,
        pulse: providerPulse,
      });
    }

    const failoverOrb = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.2, 2),
      new THREE.MeshStandardMaterial({
        color: "#7cf7ff",
        emissive: "#7cf7ff",
        emissiveIntensity: 1,
        metalness: 0.15,
        roughness: 0.08,
      }),
    );
    failoverOrb.visible = false;
    scene.add(failoverOrb);

    const applyProviderStatuses = (step: FailoverStep) => {
      for (const key of Object.keys(PROVIDER_POINTS) as ProviderKey[]) {
        const visual = providerVisuals.get(key);
        if (!visual) {
          continue;
        }
        const status = step.statuses[key];
        const theme = statusTheme(status);
        const meshMaterial = visual.mesh.material as THREE.MeshStandardMaterial;
        meshMaterial.color.set(theme.nodeColor);
        meshMaterial.emissive.set(theme.emissive);
        meshMaterial.emissiveIntensity = theme.emissiveIntensity;
        meshMaterial.opacity = theme.opacity;

        const beamMaterial = visual.beam.material as LineMaterial;
        beamMaterial.color.set(new THREE.Color(theme.beamColor).getHex());
        beamMaterial.opacity = theme.beamOpacity;
      }
    };

    applyProviderStatuses(FAILOVER_STEPS[0]);

    const clock = new THREE.Clock();
    let frame = 0;
    const storyIndexRef = { current: 0 };
    const failoverIndexRef = { current: 0 };

    const resize = () => {
      const width = Math.max(1, wrapper.clientWidth);
      const height = Math.max(1, wrapper.clientHeight);
      renderer.setSize(width, height, false);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      for (const material of lineMaterials) {
        material.resolution.set(width, height);
      }
    };

    const systemLabelOffset = new THREE.Vector3(0, 1.04, 0.06);
    const providerLabelOffset = new THREE.Vector3(0, 1.02, 0.06);
    const projectedLabelPoint = new THREE.Vector3();

    const updateOverlayLabel = (
      element: HTMLDivElement | null,
      worldPoint: THREE.Vector3,
      options?: { opacity?: number; state?: "default" | "active" | "down" },
    ) => {
      if (!element) {
        return;
      }

      projectedLabelPoint.copy(worldPoint).project(camera);
      const inFront = projectedLabelPoint.z > -1 && projectedLabelPoint.z < 1;
      const inViewport =
        projectedLabelPoint.x > -1.15 &&
        projectedLabelPoint.x < 1.15 &&
        projectedLabelPoint.y > -1.15 &&
        projectedLabelPoint.y < 1.15;

      if (!inFront || !inViewport) {
        element.style.opacity = "0";
        return;
      }

      const width = wrapper.clientWidth;
      const height = wrapper.clientHeight;
      const x = (projectedLabelPoint.x * 0.5 + 0.5) * width;
      const y = (-projectedLabelPoint.y * 0.5 + 0.5) * height;

      element.style.transform = `translate(-50%, -50%) translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`;
      element.style.opacity = `${THREE.MathUtils.clamp(options?.opacity ?? 1, 0, 1)}`;

      if (options?.state === "active") {
        element.style.borderColor = "rgba(153, 246, 255, 0.95)";
        element.style.color = "#f0fdff";
        element.style.background = "linear-gradient(180deg, rgba(7, 28, 54, 0.94), rgba(4, 17, 36, 0.94))";
      } else if (options?.state === "down") {
        element.style.borderColor = "rgba(252, 165, 165, 0.88)";
        element.style.color = "#fee2e2";
        element.style.background = "linear-gradient(180deg, rgba(59, 18, 27, 0.88), rgba(37, 11, 19, 0.88))";
      } else {
        element.style.borderColor = "rgba(125, 211, 252, 0.78)";
        element.style.color = "#e2f5ff";
        element.style.background = "linear-gradient(180deg, rgba(6, 25, 49, 0.9), rgba(4, 17, 34, 0.9))";
      }
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(wrapper);
    resize();

    type ActiveDrag =
      | { kind: "system"; key: SystemId; mesh: THREE.Mesh }
      | { kind: "provider"; key: ProviderKey; mesh: THREE.Mesh }
      | { kind: "edgeHandle"; edgeKey: string; handleIndex: number; mesh: THREE.Mesh };

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const dragPlane = new THREE.Plane();
    const dragPoint = new THREE.Vector3();
    const dragOffset = new THREE.Vector3();
    let activeDrag: ActiveDrag | null = null;

    const clampDraggedPosition = (position: THREE.Vector3) => {
      position.x = THREE.MathUtils.clamp(position.x, -19.5, 19.5);
      position.y = THREE.MathUtils.clamp(position.y, -6.8, 6.8);
      position.z = THREE.MathUtils.clamp(position.z, -5.0, 5.0);
      return position;
    };
    const clampDraggedHandle = (position: THREE.Vector3) => {
      position.x = THREE.MathUtils.clamp(position.x, -20.5, 20.5);
      position.y = THREE.MathUtils.clamp(position.y, -7.6, 7.6);
      position.z = THREE.MathUtils.clamp(position.z, -5.8, 5.8);
      return position;
    };

    const exportLayout = (): LayoutSnapshot => ({
      systems: Object.fromEntries(
        (Object.keys(systemTargets) as SystemId[]).map(key => {
          const point = systemTargets[key];
          return [key, [Number(point.x.toFixed(3)), Number(point.y.toFixed(3)), Number(point.z.toFixed(3))]];
        }),
      ) as Record<SystemId, [number, number, number]>,
      providers: Object.fromEntries(
        (Object.keys(providerTargets) as ProviderKey[]).map(key => {
          const point = providerTargets[key];
          return [key, [Number(point.x.toFixed(3)), Number(point.y.toFixed(3)), Number(point.z.toFixed(3))]];
        }),
      ) as Record<ProviderKey, [number, number, number]>,
      edges: Object.fromEntries(
        [...edgeManualHandles.entries()].map(([edgeKey, handles]) => [
          edgeKey,
          handles.map(point => [
            Number(point.x.toFixed(3)),
            Number(point.y.toFixed(3)),
            Number(point.z.toFixed(3)),
          ] as [number, number, number]),
        ]),
      ) as Record<string, Array<[number, number, number]>>,
    });

    const resetLayout = () => {
      for (const key of Object.keys(systemTargets) as SystemId[]) {
        systemTargets[key].copy(SYSTEMS[key].point);
      }
      for (const key of Object.keys(providerTargets) as ProviderKey[]) {
        providerTargets[key].copy(PROVIDER_POINTS[key]);
      }
      edgeManualHandles.clear();
    };

    resetLayoutRef.current = resetLayout;
    exportLayoutRef.current = exportLayout;

    const setPointerFromEvent = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const updateCursorFromHover = () => {
      if (!layoutEditModeRef.current || activeDrag) {
        canvas.style.cursor = activeDrag ? "grabbing" : "default";
        return;
      }
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(draggableMeshes, false);
      canvas.style.cursor = hits.length > 0 ? "grab" : "default";
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!layoutEditModeRef.current) {
        return;
      }
      setPointerFromEvent(event);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(draggableMeshes, false);
      if (hits.length === 0) {
        return;
      }

      const hit = hits[0];
      const mesh = hit.object as THREE.Mesh;
      const kind = mesh.userData.kind as "system" | "provider" | "edgeHandle" | undefined;
      if (kind === "edgeHandle") {
        const edgeKey = mesh.userData.edgeKey as string | undefined;
        const handleIndex = Number(mesh.userData.handleIndex);
        if (!edgeKey || Number.isNaN(handleIndex)) {
          return;
        }
        activeDrag = { kind: "edgeHandle", edgeKey, handleIndex, mesh };
      } else if (kind === "system" || kind === "provider") {
        const key = mesh.userData.key as SystemId | ProviderKey | undefined;
        if (!key) {
          return;
        }
        activeDrag =
          kind === "system"
            ? { kind: "system", key: key as SystemId, mesh }
            : { kind: "provider", key: key as ProviderKey, mesh };
      } else {
        return;
      }

      controls.enabled = false;
      canvas.style.cursor = "grabbing";

      const normal = new THREE.Vector3();
      camera.getWorldDirection(normal).normalize();
      dragPlane.setFromNormalAndCoplanarPoint(normal, hit.point);
      dragOffset.copy(mesh.position).sub(hit.point);
      event.preventDefault();
    };

    const onPointerMove = (event: PointerEvent) => {
      setPointerFromEvent(event);
      if (!layoutEditModeRef.current) {
        canvas.style.cursor = "default";
        return;
      }
      if (!activeDrag) {
        updateCursorFromHover();
        return;
      }

      raycaster.setFromCamera(pointer, camera);
      if (!raycaster.ray.intersectPlane(dragPlane, dragPoint)) {
        return;
      }

      if (activeDrag.kind === "edgeHandle") {
        const next = clampDraggedHandle(dragPoint.clone().add(dragOffset));
        let handles = edgeManualHandles.get(activeDrag.edgeKey);
        if (!handles) {
          const liveRoute = liveEdgeRoutes.get(activeDrag.edgeKey);
          handles = liveRoute ? liveRoute.slice(1, -1).map(point => point.clone()) : [];
        }
        if (activeDrag.handleIndex < 0 || activeDrag.handleIndex >= handles.length) {
          return;
        }
        handles[activeDrag.handleIndex] = next.clone();
        edgeManualHandles.set(activeDrag.edgeKey, handles);
        activeDrag.mesh.position.copy(next);
        return;
      }

      const next = clampDraggedPosition(dragPoint.clone().add(dragOffset));
      if (activeDrag.kind === "system") {
        systemTargets[activeDrag.key].copy(next);
      } else {
        providerTargets[activeDrag.key].copy(next);
      }
      activeDrag.mesh.position.copy(next);
    };

    const onPointerUp = () => {
      if (!activeDrag) {
        return;
      }
      activeDrag = null;
      controls.enabled = true;
      updateCursorFromHover();
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerleave", onPointerUp);
    window.addEventListener("pointerup", onPointerUp);

    const animate = () => {
      frame = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 1 / 30);
      const time = clock.elapsedTime;

      const nextStoryIndex = Math.floor(time / STAGE_SECONDS) % STORY_STAGES.length;
      if (nextStoryIndex !== storyIndexRef.current) {
        storyIndexRef.current = nextStoryIndex;
        setStoryIndex(nextStoryIndex);
      }

      const stage = STORY_STAGES[nextStoryIndex];
      const stageProgress = easeInOut((time % STAGE_SECONDS) / STAGE_SECONDS);

      for (const [systemKey, visual] of systemVisuals) {
        const material = visual.mesh.material as THREE.MeshStandardMaterial;
        const base = SYSTEMS[systemKey];
        const targetPoint = systemTargets[systemKey];
        const draggingThisSystem = !!activeDrag && activeDrag.kind === "system" && activeDrag.key === systemKey;
        if (draggingThisSystem) {
          visual.mesh.position.copy(targetPoint);
        } else {
          visual.mesh.position.lerp(targetPoint, 0.16);
        }
        material.color.set(base.color);
        material.emissive.set(base.emissive);
        material.emissiveIntensity = 0.64;
        material.opacity = 0.58;
        visual.halo.visible = false;
      }

      const positionMap = Object.fromEntries(
        (Object.keys(SYSTEMS) as SystemId[]).map(key => [
          key,
          systemVisuals.get(key)?.mesh.position.clone() ?? systemTargets[key].clone(),
        ]),
      ) as Record<SystemId, THREE.Vector3>;
      const baseRouteMap = computeEdgeRouteMap(positionMap, SYSTEM_CONNECTIONS);
      const routeMap = new Map<string, THREE.Vector3[]>();
      for (const edge of SYSTEM_CONNECTIONS) {
        const edgeKey = `${edge.from}->${edge.to}`;
        const baseRoute = baseRouteMap.get(edgeKey);
        if (!baseRoute) {
          continue;
        }
        const manualHandles = edgeManualHandles.get(edgeKey);
        const expectedHandles = Math.max(0, baseRoute.length - 2);
        let route = baseRoute.map(point => point.clone());
        if (manualHandles && manualHandles.length === expectedHandles) {
          route = [
            baseRoute[0].clone(),
            ...manualHandles.map(point => point.clone()),
            baseRoute[baseRoute.length - 1].clone(),
          ];
        } else if (manualHandles && manualHandles.length !== expectedHandles) {
          edgeManualHandles.delete(edgeKey);
        }
        routeMap.set(edgeKey, route);
      }
      const edgeCurveMap = new Map<string, THREE.CatmullRomCurve3>();

      for (const edge of SYSTEM_CONNECTIONS) {
        const edgeKey = `${edge.from}->${edge.to}`;
        const edgeVisual = passiveEdgeByKey.get(edgeKey);
        if (!edgeVisual) {
          continue;
        }
        const route = routeMap.get(edgeKey);
        if (!route) {
          continue;
        }
        const geometry = edgeVisual.line.geometry as LineGeometry;
        const smoothed = smoothRoute(route, 26);
        geometry.setPositions(smoothed.positions);
        edgeVisual.line.computeLineDistances();
        edgeCurveMap.set(edgeKey, smoothed.curve);
        const material = edgeVisual.line.material as LineMaterial;
        const isCurrentEdge = edge.from === stage.from && edge.to === stage.to;
        material.opacity = isCurrentEdge ? 0.92 : 0.38;
        material.linewidth = isCurrentEdge ? 2.95 : 1.38;

        const pulsePeriod = 3.9 + edgeVisual.index * 0.45;
        const pulseT = ((time / pulsePeriod) + edgeVisual.index * 0.16) % 1;
        edgeVisual.pulse.position.copy(smoothed.curve.getPointAt(pulseT));
        edgeVisual.pulse.scale.setScalar(isCurrentEdge ? 1.28 : 0.9);
        const pulseMaterial = edgeVisual.pulse.material as THREE.MeshStandardMaterial;
        pulseMaterial.opacity = isCurrentEdge ? 0.95 : 0.74;
        pulseMaterial.emissiveIntensity = isCurrentEdge ? 1.2 : 0.82;
      }

      for (const edge of SYSTEM_CONNECTIONS) {
        const edgeKey = `${edge.from}->${edge.to}`;
        const route = routeMap.get(edgeKey);
        if (!route) {
          continue;
        }
        liveEdgeRoutes.set(edgeKey, route.map(point => point.clone()));
        const handleMeshes = edgeHandleVisuals.get(edgeKey) ?? [];
        const interiorPoints = route.slice(1, -1);
        for (let i = 0; i < handleMeshes.length; i += 1) {
          const handle = handleMeshes[i];
          const point = interiorPoints[i];
          if (point) {
            handle.position.copy(point);
          }
          const activeHandle =
            !!activeDrag &&
            activeDrag.kind === "edgeHandle" &&
            activeDrag.edgeKey === edgeKey &&
            activeDrag.handleIndex === i;
          handle.visible = layoutEditModeRef.current;
          const mat = handle.material as THREE.MeshStandardMaterial;
          mat.opacity = activeHandle ? 0.96 : 0.58;
          mat.emissiveIntensity = activeHandle ? 1.1 : 0.58;
        }
      }

      const fromVisual = systemVisuals.get(stage.from);
      const toVisual = systemVisuals.get(stage.to);
      const fromPoint = fromVisual ? fromVisual.mesh.position.clone() : systemTargets[stage.from].clone();
      const toPoint = toVisual ? toVisual.mesh.position.clone() : systemTargets[stage.to].clone();
      if (fromVisual) {
        const m = fromVisual.mesh.material as THREE.MeshStandardMaterial;
        m.emissiveIntensity = 1.02;
        m.opacity = 0.72;
        fromVisual.halo.visible = true;
        fromVisual.halo.position.set(fromPoint.x, fromPoint.y + 0.84, fromPoint.z);
        fromVisual.halo.scale.setScalar(1.05 + Math.sin(time * 7) * 0.08);
      }
      if (toVisual) {
        const m = toVisual.mesh.material as THREE.MeshStandardMaterial;
        m.emissiveIntensity = 1.22;
        m.opacity = 0.8;
        toVisual.halo.visible = true;
        toVisual.halo.position.set(toPoint.x, toPoint.y + 0.84, toPoint.z);
        toVisual.halo.scale.setScalar(1.2 + Math.sin(time * 10) * 0.1);
      }

      const focus = fromPoint.clone().lerp(toPoint, 0.5);
      const pointsForRadius = [
        ...Object.values(positionMap),
        ...(Object.keys(PROVIDER_POINTS) as ProviderKey[]).map(
          key => providerVisuals.get(key)?.mesh.position.clone() ?? providerTargets[key].clone(),
        ),
      ];
      const graphBounds = new THREE.Box3();
      for (const point of pointsForRadius) {
        graphBounds.expandByPoint(point);
      }
      graphBounds.expandByVector(new THREE.Vector3(1.4, 1.75, 1.0));
      const graphCenter = graphBounds.getCenter(new THREE.Vector3());
      const graphSize = graphBounds.getSize(new THREE.Vector3());
      const target = graphCenter.clone().lerp(focus, 0.22);
      target.y += 0.08;
      const fitRadius = Math.max(graphSize.x * 0.78, graphSize.y * 1.18, graphSize.z * 1.26);
      const stageShiftX = THREE.MathUtils.clamp((focus.x - graphCenter.x) * 0.06, -0.55, 0.55);
      const cameraDistance = THREE.MathUtils.clamp(13.2 + fitRadius * 0.62, 15.5, 20.5);
      const cameraHeight = THREE.MathUtils.clamp(3.2 + fitRadius * 0.16, 3.8, 5.6);
      const cameraPos = new THREE.Vector3(
        target.x + stageShiftX,
        target.y + cameraHeight,
        target.z + cameraDistance,
      );
      if (layoutEditModeRef.current) {
        const editTarget = graphCenter.clone();
        editTarget.y -= Math.max(0.28, graphSize.y * 0.18);
        const editRadius = Math.max(graphSize.x * 0.74, graphSize.y * 1.36, graphSize.z * 1.32);
        const editDistance = THREE.MathUtils.clamp(13.6 + editRadius * 0.66, 16.0, 24.0);
        const editHeight = THREE.MathUtils.clamp(3.35 + editRadius * 0.2, 4.0, 7.0);
        const editPos = new THREE.Vector3(
          editTarget.x,
          editTarget.y + editHeight,
          editTarget.z + editDistance,
        );
        controls.setLookAt(editPos.x, editPos.y, editPos.z, editTarget.x, editTarget.y, editTarget.z, false);
      } else {
        controls.setLookAt(cameraPos.x, cameraPos.y, cameraPos.z, target.x, target.y, target.z, false);
      }

      const activeBeamGeometry = activeBeam.geometry as LineGeometry;
      const activeRoute =
        routeMap.get(`${stage.from}->${stage.to}`) ??
        ([fromPoint, fromPoint.clone().lerp(toPoint, 0.5), toPoint] as [THREE.Vector3, THREE.Vector3, THREE.Vector3]);
      const activeCurve =
        edgeCurveMap.get(`${stage.from}->${stage.to}`) ?? smoothRoute(activeRoute, 34).curve;
      const activeCurvePositions = activeCurve.getPoints(44).flatMap(point => [point.x, point.y, point.z]);
      activeBeamGeometry.setPositions(activeCurvePositions);
      activeBeam.computeLineDistances();
      const activeBeamMaterial = activeBeam.material as LineMaterial;
      activeBeamMaterial.opacity = 0.98;
      activeBeamMaterial.linewidth = 2.85 + Math.sin(time * 8) * 0.22;

      const packetPos = activeCurve.getPointAt(stageProgress);
      const packetPrev = activeCurve.getPointAt(Math.max(0, stageProgress - 0.03));
      const packetNext = activeCurve.getPointAt(Math.min(1, stageProgress + 0.03));
      const beamDirection = packetNext.clone().sub(packetPrev);
      beamDirection.normalize();

      packet.position.copy(packetPos);
      packet.scale.setScalar(1.0 + Math.sin(time * 10) * 0.08);
      (packet.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.2 + Math.sin(time * 12) * 0.18;
      packetArrow.position.copy(packetPos).addScaledVector(beamDirection, 0.18);
      packetArrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), beamDirection);
      packetArrow.scale.setScalar(1 + Math.sin(time * 10) * 0.03);

      for (const trail of packetTrail) {
        const offset = trail.userData.offset as number;
        const tRaw = stageProgress - offset;
        const t = THREE.MathUtils.clamp(tRaw, 0, 1);
        trail.position.copy(activeCurve.getPointAt(easeInOut(t)));
        trail.visible = tRaw >= -0.02;
      }

      starfield.rotation.y += delta * 0.03;

      const registryPoint = systemVisuals.get("registry")
        ? systemVisuals.get("registry")!.mesh.position.clone()
        : systemTargets.registry.clone();
      const providerRouteMap = new Map<
        ProviderKey,
        { route: [THREE.Vector3, THREE.Vector3, THREE.Vector3]; curve: THREE.CatmullRomCurve3 }
      >();
      const providerKeys = Object.keys(PROVIDER_POINTS) as ProviderKey[];
      for (const key of Object.keys(PROVIDER_POINTS) as ProviderKey[]) {
        const visual = providerVisuals.get(key);
        if (!visual) {
          continue;
        }
        visual.mesh.visible = true;
        visual.beam.visible = true;
        const draggingThisProvider = !!activeDrag && activeDrag.kind === "provider" && activeDrag.key === key;
        if (draggingThisProvider) {
          visual.mesh.position.copy(providerTargets[key]);
        } else {
          visual.mesh.position.lerp(providerTargets[key], 0.16);
        }
        const providerIndex = providerKeys.indexOf(key);
        const destination = visual.mesh.position.clone();
        const yDelta = destination.y - registryPoint.y;
        const zDelta = destination.z - registryPoint.z;
        const bend = registryPoint.clone().lerp(destination, 0.58);
        bend.x += 0.22;
        bend.y += THREE.MathUtils.clamp(yDelta * 0.16 + (providerIndex - 1) * 0.08, -0.36, 0.36);
        bend.z += THREE.MathUtils.clamp(zDelta * 0.18 + (providerIndex - 1) * 0.04, -0.18, 0.18);
        const providerRoute: [THREE.Vector3, THREE.Vector3, THREE.Vector3] = [
          registryPoint.clone(),
          bend,
          destination,
        ];
        const providerSmooth = smoothRoute(providerRoute, 20);
        providerRouteMap.set(key, { route: providerRoute, curve: providerSmooth.curve });
        const beamGeometry = visual.beam.geometry as LineGeometry;
        beamGeometry.setPositions(providerSmooth.positions);
        visual.beam.computeLineDistances();
      }

      const routeStage = nextStoryIndex === 2;
      if (routeStage) {
        const policyPoint = systemVisuals.get("policy")
          ? systemVisuals.get("policy")!.mesh.position.clone()
          : systemTargets.policy.clone();

        const cycle = FAILOVER_STEP_SECONDS * FAILOVER_STEPS.length;
        const routeTime = time % cycle;
        const nextFailoverIndex = Math.floor(routeTime / FAILOVER_STEP_SECONDS) % FAILOVER_STEPS.length;
        const failProgress = easeInOut((routeTime % FAILOVER_STEP_SECONDS) / FAILOVER_STEP_SECONDS);

        if (nextFailoverIndex !== failoverIndexRef.current) {
          failoverIndexRef.current = nextFailoverIndex;
          setFailoverIndex(nextFailoverIndex);
          applyProviderStatuses(FAILOVER_STEPS[nextFailoverIndex]);
        }

        const failoverStep = FAILOVER_STEPS[nextFailoverIndex];
        const activeProviderPoint = providerVisuals.get(failoverStep.provider)
          ? providerVisuals.get(failoverStep.provider)!.mesh.position.clone()
          : registryPoint.clone();
        const activeProviderRoute = providerRouteMap.get(failoverStep.provider) ?? {
          route: [registryPoint.clone(), registryPoint.clone().lerp(activeProviderPoint, 0.5), activeProviderPoint] as [
            THREE.Vector3,
            THREE.Vector3,
            THREE.Vector3,
          ],
          curve: smoothRoute(
            [registryPoint.clone(), registryPoint.clone().lerp(activeProviderPoint, 0.5), activeProviderPoint],
            20,
          ).curve,
        };

        if (failProgress < 0.4) {
          failoverOrb.position.copy(policyPoint.clone().lerp(registryPoint, failProgress / 0.4));
        } else {
          failoverOrb.position.copy(activeProviderRoute.curve.getPointAt((failProgress - 0.4) / 0.6));
        }

        failoverOrb.visible = true;
        const fm = failoverOrb.material as THREE.MeshStandardMaterial;
        if (failoverStep.status === "timeout") {
          fm.color.set("#ff748d");
          fm.emissive.set("#ff748d");
          fm.emissiveIntensity = 1.2;
          failoverOrb.visible = Math.sin(time * 18) > -0.2;
        } else {
          fm.color.set("#7cf7ff");
          fm.emissive.set("#7cf7ff");
          fm.emissiveIntensity = 1.05;
        }

        for (const key of Object.keys(PROVIDER_POINTS) as ProviderKey[]) {
          const visual = providerVisuals.get(key);
          if (!visual) {
            continue;
          }
          const pulse = visual.pulse;
          const pulseMaterial = pulse.material as THREE.MeshStandardMaterial;
          const status = failoverStep.statuses[key];
          const providerPoint = visual.mesh.position.clone();
          const providerRoute = providerRouteMap.get(key) ?? {
            route: [registryPoint.clone(), registryPoint.clone().lerp(providerPoint, 0.5), providerPoint] as [
              THREE.Vector3,
              THREE.Vector3,
              THREE.Vector3,
            ],
            curve: smoothRoute(
              [registryPoint.clone(), registryPoint.clone().lerp(providerPoint, 0.5), providerPoint],
              20,
            ).curve,
          };

          if (status === "active") {
            const t = THREE.MathUtils.clamp((failProgress - 0.4) / 0.6, 0, 1);
            pulse.position.copy(providerRoute.curve.getPointAt(t));
            pulse.visible = true;
            pulseMaterial.color.set("#7cf7ff");
            pulseMaterial.emissive.set("#7cf7ff");
            pulseMaterial.opacity = 0.95;
            pulseMaterial.emissiveIntensity = 1.05 + Math.sin(time * 11) * 0.12;
          } else if (status === "down") {
            pulse.position.copy(providerRoute.curve.getPointAt(0.35));
            pulse.visible = Math.sin(time * 14 + key.length) > -0.15;
            pulseMaterial.color.set("#ff758e");
            pulseMaterial.emissive.set("#ff758e");
            pulseMaterial.opacity = 0.78;
            pulseMaterial.emissiveIntensity = 0.9 + Math.sin(time * 15) * 0.2;
          } else {
            pulse.position.copy(providerRoute.curve.getPointAt(0.9));
            pulse.visible = true;
            pulseMaterial.color.set("#7aa4c8");
            pulseMaterial.emissive.set("#7aa4c8");
            pulseMaterial.opacity = 0.45;
            pulseMaterial.emissiveIntensity = 0.42 + Math.sin(time * 4 + key.length) * 0.08;
          }
        }
      } else {
        failoverOrb.visible = false;
        for (const key of Object.keys(PROVIDER_POINTS) as ProviderKey[]) {
          const visual = providerVisuals.get(key);
          if (visual) {
            const meshMaterial = visual.mesh.material as THREE.MeshStandardMaterial;
            const standby = statusTheme("standby");
            meshMaterial.color.set(standby.nodeColor);
            meshMaterial.emissive.set(standby.emissive);
            meshMaterial.emissiveIntensity = standby.emissiveIntensity;
            meshMaterial.opacity = 0.4;
            const beamMaterial = visual.beam.material as LineMaterial;
            beamMaterial.color.set(new THREE.Color(standby.beamColor).getHex());
            beamMaterial.opacity = 0.22;
            visual.pulse.visible = false;
          }
        }
      }

      for (const key of Object.keys(SYSTEMS) as SystemId[]) {
        const visual = systemVisuals.get(key);
        if (!visual) {
          continue;
        }
        const state = key === stage.from || key === stage.to ? "active" : "default";
        const labelPoint = visual.mesh.position.clone().add(systemLabelOffset);
        updateOverlayLabel(systemLabelRefs.current[key], labelPoint, {
          opacity: state === "active" ? 1 : 0.92,
          state,
        });
      }

      const providerStatuses = routeStage
        ? FAILOVER_STEPS[failoverIndexRef.current].statuses
        : ({ wikipedia: "standby", openlibrary: "standby", hackernews: "standby" } as Record<
            ProviderKey,
            ProviderStatus
          >);
      for (const key of Object.keys(PROVIDER_POINTS) as ProviderKey[]) {
        const visual = providerVisuals.get(key);
        if (!visual) {
          continue;
        }
        const status = providerStatuses[key];
        const labelPoint = visual.mesh.position.clone().add(providerLabelOffset);
        updateOverlayLabel(providerLabelRefs.current[key], labelPoint, {
          opacity: status === "active" ? 1 : status === "down" ? 0.8 : 0.9,
          state: status === "active" ? "active" : status === "down" ? "down" : "default",
        });
      }

      controls.update(delta);
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerUp);
      window.removeEventListener("pointerup", onPointerUp);
      canvas.style.cursor = "default";
      resetLayoutRef.current = null;
      exportLayoutRef.current = null;
      controls.dispose();
      renderer.dispose();
      for (const material of lineMaterials) {
        material.dispose();
      }
      scene.traverse(object => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) {
          mesh.geometry.dispose();
        }
        if (Array.isArray(mesh.material)) {
          for (const material of mesh.material) {
            material.dispose();
          }
        } else if (mesh.material) {
          mesh.material.dispose();
        }
      });
    };
  }, []);

  const currentScenario = SCENARIOS[scenarioIndex];
  const currentStoryStage = STORY_STAGES[storyIndex];
  const currentFailoverStep = FAILOVER_STEPS[failoverIndex];
  const routeStageActive = storyIndex === 2;
  const activeFlowIndex = storyIndex + 1;
  const payloadRecord = currentScenario.payload as Record<string, unknown>;
  const payloadRequestId =
    typeof payloadRecord.requestId === "string" ? payloadRecord.requestId : "unknown-request";
  const payloadCapability =
    typeof payloadRecord.capability === "string" ? payloadRecord.capability : "unknown-capability";

  const payloadText = JSON.stringify(currentScenario.payload, null, 2);
  const outputText = JSON.stringify(currentScenario.output, null, 2);

  const sourceSystemLabel = SYSTEMS[currentStoryStage.from].label;
  const destinationSystemLabel = SYSTEMS[currentStoryStage.to].label;

  const hopTone =
    routeStageActive && currentFailoverStep.status === "ok"
      ? "success"
      : routeStageActive && currentFailoverStep.status === "timeout"
        ? "timeout"
        : "neutral";

  const handleResetLayout = () => {
    resetLayoutRef.current?.();
  };

  const handleCopyLayout = async () => {
    if (!exportLayoutRef.current) {
      return;
    }
    try {
      const payload = JSON.stringify(exportLayoutRef.current(), null, 2);
      await navigator.clipboard.writeText(payload);
      setLayoutCopyStatus("copied");
      window.setTimeout(() => setLayoutCopyStatus("idle"), 1800);
    } catch {
      setLayoutCopyStatus("error");
      window.setTimeout(() => setLayoutCopyStatus("idle"), 2200);
    }
  };

  return (
    <div className="rounded-3xl border border-cyan-300/20 bg-slate-950/65 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm tracking-[0.14em] text-cyan-200 uppercase">Live Control Plane Simulation</p>
        <p className="text-xs text-slate-300">Human-readable system hop view</p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setLayoutEditMode(value => !value)}
          className="rounded-md border px-2 py-1 text-xs transition"
          style={{
            borderColor: layoutEditMode ? "rgba(103,232,249,0.75)" : "rgba(148,163,184,0.35)",
            backgroundColor: layoutEditMode ? "rgba(8,57,79,0.75)" : "rgba(15,23,42,0.6)",
            color: layoutEditMode ? "#a5f3fc" : "#cbd5e1",
          }}
        >
          {layoutEditMode ? "Layout Edit: On" : "Layout Edit: Off"}
        </button>
        <button
          type="button"
          onClick={handleResetLayout}
          className="rounded-md border border-slate-500/50 bg-slate-900/70 px-2 py-1 text-xs text-slate-200 transition hover:border-cyan-300/50"
        >
          Reset Layout
        </button>
        <button
          type="button"
          onClick={() => {
            void handleCopyLayout();
          }}
          className="rounded-md border border-slate-500/50 bg-slate-900/70 px-2 py-1 text-xs text-slate-200 transition hover:border-cyan-300/50"
        >
          Copy Layout JSON
        </button>
        <span className="text-[11px] text-slate-400">
          {layoutCopyStatus === "copied"
            ? "Layout copied."
            : layoutCopyStatus === "error"
              ? "Copy failed."
              : layoutEditMode
                ? "Drag nodes or edge handles in the scene."
                : ""}
        </span>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-3">
        {SCENARIOS.map((scenario, index) => {
          const selected = index === scenarioIndex;
          return (
            <button
              key={scenario.id}
              type="button"
              onClick={() => setScenarioIndex(index)}
              className="rounded-xl border px-3 py-3 text-left transition"
              style={{
                borderColor: selected ? "rgba(103, 232, 249, 0.72)" : "rgba(148, 163, 184, 0.35)",
                backgroundColor: selected ? "rgba(8, 36, 54, 0.78)" : "rgba(2, 14, 30, 0.62)",
                boxShadow: selected ? "0 0 0 1px rgba(103,232,249,0.45) inset" : "none",
              }}
            >
              <div className="text-sm font-semibold text-cyan-100">{scenario.title}</div>
              <div className="mt-1 text-xs text-slate-300">{scenario.subtitle}</div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 rounded-xl border border-cyan-200/25 bg-slate-950/70 p-3">
        <div className="mb-2 text-[11px] tracking-[0.14em] text-cyan-300 uppercase">Flow</div>
        <div className="flex flex-wrap items-center gap-2">
          {FLOW_STEPS.map((step, index) => {
            const isActive = index === activeFlowIndex;
            const isTerminal = index === 0 || index === FLOW_STEPS.length - 1;
            return (
              <div key={step} className="flex items-center gap-2">
                <span
                  className="rounded-md border px-2 py-1 text-[11px]"
                  style={{
                    borderColor: isActive
                      ? "rgba(103, 232, 249, 0.75)"
                      : isTerminal
                        ? "rgba(74, 222, 128, 0.5)"
                        : "rgba(148, 163, 184, 0.38)",
                    backgroundColor: isActive
                      ? "rgba(8, 57, 79, 0.75)"
                      : isTerminal
                        ? "rgba(20, 83, 45, 0.35)"
                        : "rgba(15, 23, 42, 0.6)",
                    color: isActive ? "#a5f3fc" : isTerminal ? "#86efac" : "#cbd5e1",
                  }}
                >
                  {step}
                </span>
                {index < FLOW_STEPS.length - 1 ? <span className="text-slate-500">→</span> : null}
              </div>
            );
          })}
        </div>
      </div>

      <div
        ref={wrapperRef}
        className="relative mt-4 h-[450px] w-full overflow-hidden rounded-2xl border border-cyan-200/20 bg-[radial-gradient(circle_at_18%_20%,rgba(86,201,255,0.24),transparent_58%),radial-gradient(circle_at_84%_78%,rgba(110,255,219,0.18),transparent_48%),linear-gradient(160deg,#041026,#07183a_65%,#0a2248)] sm:h-[560px]"
      >
        <canvas ref={canvasRef} className="h-full w-full touch-none" />
        <div className="pointer-events-none absolute inset-0 z-20">
          {(Object.keys(SYSTEMS) as SystemId[]).map(key => (
            <div
              key={`system-label-${key}`}
              ref={element => {
                systemLabelRefs.current[key] = element;
              }}
              className="absolute min-w-[88px] -translate-x-1/2 -translate-y-1/2 rounded-md border px-2 py-1 text-center text-[13px] font-semibold tracking-[0.01em] whitespace-nowrap text-cyan-50 opacity-0 shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur-[1px]"
              style={{
                borderColor: "rgba(125, 211, 252, 0.78)",
                background: "linear-gradient(180deg, rgba(6, 25, 49, 0.9), rgba(4, 17, 34, 0.9))",
                textShadow: "0 1px 2px rgba(0,0,0,0.75)",
                willChange: "transform, opacity",
              }}
            >
              {SYSTEMS[key].label}
            </div>
          ))}
          {(Object.keys(PROVIDER_LABELS) as ProviderKey[]).map(key => (
            <div
              key={`provider-label-${key}`}
              ref={element => {
                providerLabelRefs.current[key] = element;
              }}
              className="absolute min-w-[92px] -translate-x-1/2 -translate-y-1/2 rounded-md border px-2 py-1 text-center text-[13px] font-semibold tracking-[0.01em] whitespace-nowrap text-cyan-50 opacity-0 shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur-[1px]"
              style={{
                borderColor: "rgba(125, 211, 252, 0.78)",
                background: "linear-gradient(180deg, rgba(6, 25, 49, 0.9), rgba(4, 17, 34, 0.9))",
                textShadow: "0 1px 2px rgba(0,0,0,0.75)",
                willChange: "transform, opacity",
              }}
            >
              {PROVIDER_LABELS[key]}
            </div>
          ))}
        </div>
      </div>

      <div
        className="mt-3 rounded-lg border px-3 py-2 text-xs"
        style={{
          borderColor:
            hopTone === "success"
              ? "rgba(52, 211, 153, 0.58)"
              : hopTone === "timeout"
                ? "rgba(248, 113, 113, 0.58)"
                : "rgba(56, 189, 248, 0.48)",
          backgroundColor:
            hopTone === "success"
              ? "rgba(6, 36, 24, 0.93)"
              : hopTone === "timeout"
                ? "rgba(47, 15, 22, 0.93)"
                : "rgba(2, 18, 34, 0.9)",
        }}
      >
        <div className="text-[11px] tracking-[0.14em] text-cyan-300 uppercase">Live Data Hop</div>
        <div className="mt-1 text-[11px] text-slate-100">
          {currentScenario.title} • Stage {storyIndex + 1}/{STORY_STAGES.length}: {currentStoryStage.title}
        </div>

        <div className="mt-2 mx-auto grid w-full max-w-[860px] grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="rounded-md border border-cyan-200/55 bg-slate-900/85 px-2 py-1">
            <div className="text-[10px] tracking-[0.1em] text-slate-300 uppercase">Source System</div>
            <div className="text-base font-semibold text-cyan-100">{sourceSystemLabel}</div>
            <div className="text-[11px] text-slate-300">{currentStoryStage.fromStep}</div>
          </div>
          <div className="px-1 text-lg font-bold text-cyan-100">→</div>
          <div className="rounded-md border border-emerald-200/55 bg-slate-900/85 px-2 py-1 text-right">
            <div className="text-[10px] tracking-[0.1em] text-slate-300 uppercase">Destination System</div>
            <div className="text-base font-semibold text-emerald-100">{destinationSystemLabel}</div>
            <div className="text-[11px] text-slate-300">Action: {currentStoryStage.toStep}</div>
          </div>
        </div>

        <div className="mt-2 mx-auto w-full max-w-[860px]">
          <div className="relative h-4 overflow-hidden rounded-full border border-cyan-300/55 bg-slate-900/90">
            <div
              className="h-full w-full"
              style={{
                background:
                  hopTone === "success"
                    ? "linear-gradient(90deg, rgba(20,184,166,0.2), rgba(52,211,153,0.7), rgba(20,184,166,0.2))"
                    : hopTone === "timeout"
                      ? "linear-gradient(90deg, rgba(244,63,94,0.2), rgba(248,113,113,0.7), rgba(244,63,94,0.2))"
                      : "linear-gradient(90deg, rgba(59,130,246,0.2), rgba(34,211,238,0.7), rgba(59,130,246,0.2))",
                animation: "relayorbBeamSweep 1.3s linear infinite",
                backgroundSize: "180% 100%",
              }}
            />
          </div>
        </div>

        <div className="mt-1 text-[11px] text-slate-200">
          requestId={payloadRequestId} · capability={payloadCapability}
        </div>
        <div className="mt-1 text-[11px] text-slate-200">Why this matters: {currentStoryStage.why}</div>
        <div className="mt-1 text-[11px] text-slate-200">{currentScenario.stageCaptions[storyIndex]}</div>
        <div
          className="mt-1 text-[11px]"
          style={{
            color:
              hopTone === "success"
                ? "#86efac"
                : hopTone === "timeout"
                  ? "#fca5a5"
                  : "#bae6fd",
          }}
        >
          {routeStageActive
            ? currentFailoverStep.status === "ok"
              ? `Success path: ${PROVIDER_LABELS[currentFailoverStep.provider]} responded in ${currentFailoverStep.latencyMs}ms`
              : `Timeout path: stale route ${currentFailoverStep.staleRoutedTo} exceeded ${currentFailoverStep.timeoutMs}ms`
            : ""}
        </div>
      </div>

      {routeStageActive ? (
        <div className="mt-4 grid gap-2 md:grid-cols-3">
          {(Object.keys(PROVIDER_LABELS) as ProviderKey[]).map(providerKey => {
            const status = currentFailoverStep.statuses[providerKey];
            const badge = statusBadgeStyle(status);
            return (
              <div
                key={providerKey}
                className="rounded-xl border px-3 py-2 text-sm"
                style={{ backgroundColor: badge.bg, borderColor: badge.border, color: badge.text }}
              >
                <span className="font-medium">{PROVIDER_LABELS[providerKey]}</span>
                <span className="ml-2 text-xs uppercase tracking-[0.1em]">{status}</span>
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <section className="rounded-xl border border-cyan-200/25 bg-slate-950/75 p-3">
          <h3 className="text-xs tracking-[0.14em] text-cyan-300 uppercase">Payload In</h3>
          <pre className="mt-2 max-h-52 overflow-auto rounded-md border border-slate-700/70 bg-slate-950/80 p-2 text-[11px] leading-5 text-cyan-100">
            {payloadText}
          </pre>
        </section>

        <section className="rounded-xl border border-cyan-200/25 bg-slate-950/75 p-3">
          <h3 className="text-xs tracking-[0.14em] text-cyan-300 uppercase">What RelayOrb Does</h3>
          <div className="mt-2 space-y-2 text-xs text-slate-200">
            {currentScenario.relayorbDoes.map(item => (
              <p key={item} className="rounded-md border border-slate-700/70 bg-slate-950/80 px-2 py-2">
                {item}
              </p>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-cyan-200/25 bg-slate-950/75 p-3">
          <h3 className="text-xs tracking-[0.14em] text-cyan-300 uppercase">Output Out</h3>
          <pre className="mt-2 max-h-52 overflow-auto rounded-md border border-slate-700/70 bg-slate-950/80 p-2 text-[11px] leading-5 text-emerald-100">
            {outputText}
          </pre>
        </section>
      </div>

      <style jsx global>{`
        @keyframes relayorbBeamSweep {
          0% {
            background-position: 0% 0%;
          }
          100% {
            background-position: 180% 0%;
          }
        }
      `}</style>
    </div>
  );
}
