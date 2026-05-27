import { renderOpenApiYaml, yamlResponse } from "@/lib/openapiYaml";

export async function GET() {
  const yaml = await renderOpenApiYaml();
  return yamlResponse(yaml);
}
