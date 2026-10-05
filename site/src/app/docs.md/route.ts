import { docsMarkdown } from "@/lib/docsMarkdown";
import { markdownResponse } from "@/lib/markdownMirror";

export const dynamic = "force-static";

export function GET() {
  return markdownResponse(docsMarkdown);
}
