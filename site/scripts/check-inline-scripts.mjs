// Build guard: every inline <script> in the built pages must parse, and the GA bootstrap
// must be present when a GA ID is configured. A broken inline analytics script fails
// silently in the browser (the page looks fine, nothing is collected), so fail the build.
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

const OUT = path.join(process.cwd(), ".next", "server", "app");
const PAGES = ["index.html", "docs.html", "guides.html", "guides/claude-code-mcp.html", "privacy.html"];
const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();

let checked = 0;
for (const page of PAGES) {
  const file = path.join(OUT, page);
  const html = await fs.readFile(file, "utf8").catch(() => {
    throw new Error(`check-inline-scripts: ${page} was not generated (${file})`);
  });
  for (const [, attrs, body] of html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)) {
    // JSON-LD and other data blocks are not code.
    if (/type="application\/(ld\+)?json"/.test(attrs) || !body.trim()) continue;
    try {
      new vm.Script(body);
      checked++;
    } catch (err) {
      throw new Error(`check-inline-scripts: an inline script in ${page} does not parse: ${err.message}\n${body.slice(0, 300)}`);
    }
  }
  if (gaId) {
    for (const needle of ['id="ga-bootstrap"', "content_group", "consent", gaId]) {
      if (!html.includes(needle)) {
        throw new Error(`check-inline-scripts: ${page} is missing "${needle}" (GA bootstrap not rendered)`);
      }
    }
  }
}
console.log(`check-inline-scripts: ${checked} inline scripts parse across ${PAGES.length} pages${gaId ? `, GA bootstrap present (${gaId})` : " (no GA ID set)"}`);
