"use client";

import { useState } from "react";
import { readConsent, trackEvent, updateConsent } from "@/lib/analytics";

export function ConsentBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (typeof window === "undefined") {
    return null;
  }

  if (dismissed || readConsent()) {
    return null;
  }

  return (
    <div className="fixed right-4 bottom-4 left-4 z-50 mx-auto max-w-4xl rounded-2xl border border-cyan-400/30 bg-slate-950/95 p-4 shadow-2xl backdrop-blur md:left-auto">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-slate-200">
          We use privacy-aware GA4 analytics for page views and CTA interactions.
          No personal data is sent. You can accept or reject analytics now.
        </p>

        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => {
              updateConsent("denied");
              setDismissed(true);
            }}
            className="rounded-lg border border-slate-500/60 px-3 py-2 text-sm text-slate-200 transition hover:border-slate-300"
          >
            Reject
          </button>
          <button
            type="button"
            onClick={() => {
              updateConsent("granted");
              trackEvent("consent_choice", {
                choice: "accepted",
                location: "banner",
              });
              setDismissed(true);
            }}
            className="rounded-lg border border-cyan-300/60 bg-cyan-400/20 px-3 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/30"
          >
            Accept analytics
          </button>
        </div>
      </div>
    </div>
  );
}
