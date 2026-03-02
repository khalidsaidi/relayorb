"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackPageView } from "@/lib/analytics";

export function RouteAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) {
      return;
    }

    trackPageView(pathname);
  }, [pathname]);

  useEffect(() => {
    const onConsent = () => {
      if (!pathname) {
        return;
      }
      trackPageView(pathname);
    };

    window.addEventListener("relayorb-analytics-consent", onConsent);
    return () => {
      window.removeEventListener("relayorb-analytics-consent", onConsent);
    };
  }, [pathname]);

  return null;
}
