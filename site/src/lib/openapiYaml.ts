import { readFile } from "node:fs/promises";
import path from "node:path";

type JsYaml = {
  dump: (input: unknown, options?: Record<string, unknown>) => string;
};

export async function renderOpenApiYaml() {
  const openapiPath = path.join(process.cwd(), "public", "openapi.json");
  const jsonRaw = await readFile(openapiPath, "utf8");
  const payload = JSON.parse(jsonRaw) as unknown;
  const yamlLib = require("js-yaml") as JsYaml;
  return yamlLib.dump(payload, { lineWidth: 120, noRefs: true });
}

export function yamlResponse(body: string) {
  return new Response(body, {
    headers: {
      "Content-Type": "text/yaml; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=60",
    },
  });
}
