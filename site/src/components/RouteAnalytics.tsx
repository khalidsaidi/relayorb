"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackPageView } from "@/lib/analytics";

function pathWithSearch(pathname: string, searchParams: URLSearchParams) {
  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function RouteAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) {
      return;
    }

    trackPageView(pathWithSearch(pathname, searchParams));
  }, [pathname, searchParams]);

  useEffect(() => {
    const onConsent = () => {
      if (!pathname) {
        return;
      }
      trackPageView(pathWithSearch(pathname, searchParams));
    };

    window.addEventListener("relayorb-analytics-consent", onConsent);
    return () => {
      window.removeEventListener("relayorb-analytics-consent", onConsent);
    };
  }, [pathname, searchParams]);

  return null;
}
