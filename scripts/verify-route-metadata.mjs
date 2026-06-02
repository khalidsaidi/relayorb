const baseUrl = process.env.RELAYORB_VERIFY_BASE_URL || "https://relayorb.com";

const routes = [
  {
    route: "/",
    title: "RelayOrb — Tool Control Plane for AI Agents",
    ogTitle: "RelayOrb — Tool Control Plane for AI Agents",
    description:
      "Route agent calls to versioned capabilities with contracts, governance, and observability.",
  },
  {
    route: "/reliability",
    title: "Reliability | RelayOrb",
    ogTitle: "Reliability | RelayOrb",
    description:
      "Thirty-day RelayOrb production reliability and cost data from internal monitoring traffic.",
  },
  {
    route: "/stats",
    title: "Public stats | RelayOrb",
    ogTitle: "Public stats | RelayOrb",
    description: "Real-time control-plane counters: invokes, callers, latency, capabilities.",
  },
  {
    route: "/demo",
    title: "Demo module guide | RelayOrb",
    ogTitle: "Demo module guide | RelayOrb",
    description: "Self-host the RelayOrb demo. The hosted anonymous demo has been retired.",
  },
  {
    route: "/terraform",
    title: "Deploy with Terraform | RelayOrb",
    ogTitle: "Deploy with Terraform | RelayOrb",
    description:
      "Deploy RelayOrb to your own GCP project with the published Terraform modules.",
  },
  {
    route: "/privacy",
    title: "Privacy | RelayOrb",
    ogTitle: "Privacy | RelayOrb",
    description: "RelayOrb privacy policy and data handling practices.",
  },
];

function extractTitle(html) {
  const match = html.match(/<title>([^<]+)<\/title>/i);
  return match ? match[1].trim() : null;
}

function extractMeta(html, attr, value) {
  const pattern = new RegExp(
    `<meta[^>]+${attr}=["']${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    "i",
  );
  const reversePattern = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+${attr}=["']${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*>`,
    "i",
  );
  const match = html.match(pattern) || html.match(reversePattern);
  return match ? match[1].trim() : null;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function verifyRoute(routeConfig) {
  const url = `${baseUrl}${routeConfig.route}?cb=${Date.now()}`;
  const response = await fetch(url, {
    headers: {
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
  });
  assert(response.ok, `${routeConfig.route}: fetch failed with ${response.status}`);
  const html = await response.text();

  const title = extractTitle(html);
  const ogTitle = extractMeta(html, "property", "og:title");
  const ogDescription = extractMeta(html, "property", "og:description");
  const twitterTitle = extractMeta(html, "name", "twitter:title");
  const twitterDescription = extractMeta(html, "name", "twitter:description");
  const twitterCard = extractMeta(html, "name", "twitter:card");
  const twitterImage = extractMeta(html, "name", "twitter:image");

  assert(title === routeConfig.title, `${routeConfig.route}: title mismatch: ${title}`);
  assert(!title.includes("RelayOrb | RelayOrb"), `${routeConfig.route}: doubled brand in title`);
  assert(ogTitle === routeConfig.ogTitle, `${routeConfig.route}: og:title mismatch: ${ogTitle}`);
  assert(
    twitterTitle === routeConfig.ogTitle,
    `${routeConfig.route}: twitter:title mismatch: ${twitterTitle}`,
  );
  assert(
    ogDescription === routeConfig.description,
    `${routeConfig.route}: og:description mismatch: ${ogDescription}`,
  );
  assert(
    twitterDescription === routeConfig.description,
    `${routeConfig.route}: twitter:description mismatch: ${twitterDescription}`,
  );
  assert(
    twitterCard === "summary_large_image",
    `${routeConfig.route}: twitter:card mismatch: ${twitterCard}`,
  );
  assert(
    twitterImage === "https://relayorb.com/og-image.png",
    `${routeConfig.route}: twitter:image mismatch: ${twitterImage}`,
  );
  assert(!/twitter:creator/i.test(html), `${routeConfig.route}: unexpected twitter:creator`);
  assert(!/twitter:site/i.test(html), `${routeConfig.route}: unexpected twitter:site`);
  assert(!/@relayorb\b/i.test(html), `${routeConfig.route}: unexpected @relayorb handle`);
  assert(
    !/twitter\.com\/relayorb\b/i.test(html),
    `${routeConfig.route}: unexpected twitter.com/relayorb`,
  );
  assert(!/x\.com\/relayorb\b/i.test(html), `${routeConfig.route}: unexpected x.com/relayorb`);

  return {
    route: routeConfig.route,
    title,
    ogTitle,
    twitterTitle,
  };
}

async function main() {
  const results = [];
  for (const route of routes) {
    results.push(await verifyRoute(route));
  }
  for (const result of results) {
    console.log(
      `${result.route} OK title="${result.title}" og:title="${result.ogTitle}" twitter:title="${result.twitterTitle}"`,
    );
  }
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
