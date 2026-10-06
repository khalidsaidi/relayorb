"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { track } from "@/lib/analytics";

type Props = {
  title: string;
  code: string;
  snippetId: string;
};

export function CodeBlock({ title, code, snippetId }: Props) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      track("code_copy", { snippet: snippetId, copy_method: "button" });
      if (/install/.test(snippetId)) {
        // Key event: the strongest signal someone is about to use RelayOrb.
        track("install_copy", { snippet: snippetId, copy_method: "button" });
      }
      setTimeout(() => setCopied(false), 1400);
    } catch {
      track("code_copy_failed", { snippet: snippetId, copy_method: "button" });
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-950/75">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2">
        <p className="text-xs uppercase tracking-[0.12em] text-slate-400">{title}</p>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-1 rounded-md border border-slate-600/80 px-2 py-1 text-xs text-slate-200 transition hover:border-slate-300"
          aria-label={`Copy ${title}`}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <pre className="overflow-x-auto p-4 text-xs leading-6 text-cyan-100 sm:text-sm">
        <code>{code}</code>
      </pre>
    </div>
  );
}
