"use client";

import { useState, useSyncExternalStore } from "react";
import { readConsent, track, updateConsent } from "@/lib/analytics";

function subscribe(onChange: () => void) {
  window.addEventListener("relayorb-analytics-consent", onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("relayorb-analytics-consent", onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function ConsentBanner() {
  const [dismissed, setDismissed] = useState(false);
  // The server (and the hydration pass) render nothing; the banner appears after hydration
  // only if no choice is stored. Rendering it during hydration caused a mismatch (React #418).
  const consent = useSyncExternalStore(subscribe, () => readConsent() ?? "unset", () => "server");

  if (dismissed || consent !== "unset") {
    return null;
  }

  return (
    <div className="fixed right-4 bottom-4 left-4 z-50 mx-auto max-w-4xl rounded-2xl border border-cyan-400/30 bg-slate-950/95 p-4 shadow-2xl backdrop-blur md:left-auto">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-slate-200">
          We use Google Analytics to see how the site is used. Without your OK it
          only gets cookie-free, anonymous pings. Accept to allow analytics cookies.
        </p>

        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => {
              track("consent_choice", { choice: "rejected", ui_location: "banner" });
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
              track("consent_choice", { choice: "accepted", ui_location: "banner" });
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
