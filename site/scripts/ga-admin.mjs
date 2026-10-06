// Configure the RelayOrb GA4 property so everything the site sends shows up in reports.
// Idempotent: safe to re-run after adding events or parameters.
//
//   GA_ACCESS_TOKEN=$(gcloud auth print-access-token \
//     --impersonate-service-account=ga-admin@ai-status-dashboard.iam.gserviceaccount.com \
//     --scopes=https://www.googleapis.com/auth/analytics.edit) node scripts/ga-admin.mjs
//
// GA4 keeps custom event parameters but hides them from every report until a matching
// custom dimension exists, and registration is not retroactive. Register every parameter
// that src/lib/analytics.ts and the components send.

const PROPERTY = "properties/518390148"; // relayorb
const STREAM = `${PROPERTY}/dataStreams/13245111896`; // RelayOrb Web, G-BPSWSX3X3B
const API = "https://analyticsadmin.googleapis.com";

const DIMENSIONS = [
  ["page_type", "Page type", "home, guide, guides_index, docs, legal, not_found, other"],
  ["content_slug", "Guide slug", "Guide page slug, or (none)"],
  ["cta", "CTA or link label", "Button or link text (or cta id) that was clicked"],
  ["ui_location", "UI location", "Where the click happened: hero, header, footer, content, banner..."],
  ["link_url", "Link URL", "Destination of the clicked link (host + path)"],
  ["link_domain", "Link domain", "Host of an outbound link"],
  ["snippet", "Code snippet", "Which code block was copied (snippet id)"],
  ["copy_method", "Copy method", "button or selection"],
  ["scroll_depth", "Scroll depth percent", "Scroll milestone reached: 25, 50, 75, 100"],
  ["seconds_on_page", "Seconds on page", "Seconds on the page at read_complete / page_exit"],
  ["max_scroll", "Max scroll percent", "Deepest scroll on the page at read_complete / page_exit"],
  ["section", "Page section", "data-analytics-section that came into view"],
  ["choice", "Consent choice", "accepted or rejected"],
  ["metric_name", "Web Vital", "LCP, INP, CLS, FCP, TTFB"],
  ["metric_rating", "Web Vital rating", "good, needs-improvement, poor"],
];

const METRICS = [
  ["metric_value", "Web Vital value", "Milliseconds (CLS x1000)", "STANDARD"],
];

const KEY_EVENTS = ["install_copy", "github_click", "read_complete"];

const token = process.env.GA_ACCESS_TOKEN;
if (!token) {
  console.error("Set GA_ACCESS_TOKEN (see the header of this file).");
  process.exit(1);
}

async function call(method, path, body) {
  const res = await fetch(`${API}/${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status}: ${json.error?.message ?? res.statusText}`);
  }
  return json;
}

// 1. Keep event data 14 months (the default, 2 months, silently deletes history).
const retention = await call(
  "PATCH",
  `v1beta/${PROPERTY}/dataRetentionSettings?updateMask=eventDataRetention,resetUserDataOnNewActivity`,
  { eventDataRetention: "FOURTEEN_MONTHS", resetUserDataOnNewActivity: true },
);
console.log(`retention: ${retention.eventDataRetention}`);

// 2. Enhanced Measurement: everything on except page changes. The site sends its own
//    page_view on client-side navigation (with content group and page type); GA's
//    history-based page view would double count it without those labels.
const em = await call(
  "PATCH",
  `v1alpha/${STREAM}/enhancedMeasurementSettings?updateMask=streamEnabled,scrollsEnabled,outboundClicksEnabled,siteSearchEnabled,videoEngagementEnabled,fileDownloadsEnabled,pageChangesEnabled,formInteractionsEnabled`,
  {
    streamEnabled: true,
    scrollsEnabled: true,
    outboundClicksEnabled: true,
    siteSearchEnabled: true,
    videoEngagementEnabled: true,
    fileDownloadsEnabled: true,
    pageChangesEnabled: false,
    formInteractionsEnabled: true,
  },
);
console.log(`enhanced measurement: page changes ${em.pageChangesEnabled ? "on" : "off"}, others on`);

// 3. Custom dimensions and metrics.
const existingDims = new Set(
  ((await call("GET", `v1beta/${PROPERTY}/customDimensions?pageSize=200`)).customDimensions ?? []).map(
    d => d.parameterName,
  ),
);
for (const [parameterName, displayName, description] of DIMENSIONS) {
  if (existingDims.has(parameterName)) {
    console.log(`dimension exists: ${parameterName}`);
    continue;
  }
  await call("POST", `v1beta/${PROPERTY}/customDimensions`, {
    parameterName,
    displayName,
    description,
    scope: "EVENT",
  });
  console.log(`dimension created: ${parameterName}`);
}

const existingMetrics = new Set(
  ((await call("GET", `v1beta/${PROPERTY}/customMetrics?pageSize=200`)).customMetrics ?? []).map(
    m => m.parameterName,
  ),
);
for (const [parameterName, displayName, description, measurementUnit] of METRICS) {
  if (existingMetrics.has(parameterName)) {
    console.log(`metric exists: ${parameterName}`);
    continue;
  }
  await call("POST", `v1beta/${PROPERTY}/customMetrics`, {
    parameterName,
    displayName,
    description,
    measurementUnit,
    scope: "EVENT",
  });
  console.log(`metric created: ${parameterName}`);
}

// 4. Key events: the signals that someone is about to use RelayOrb or read a page fully.
const existingKeys = new Set(
  ((await call("GET", `v1beta/${PROPERTY}/keyEvents?pageSize=200`)).keyEvents ?? []).map(k => k.eventName),
);
for (const eventName of KEY_EVENTS) {
  if (existingKeys.has(eventName)) {
    console.log(`key event exists: ${eventName}`);
    continue;
  }
  await call("POST", `v1beta/${PROPERTY}/keyEvents`, { eventName, countingMethod: "ONCE_PER_EVENT" });
  console.log(`key event created: ${eventName}`);
}
