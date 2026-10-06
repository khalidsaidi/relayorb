"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useReportWebVitals } from "next/web-vitals";
import { track, trackPageView } from "@/lib/analytics";

/** Page views for client-side navigations, plus Core Web Vitals for every page. */
export function RouteAnalytics() {
  const pathname = usePathname();
  const firstRender = useRef(true);

  useEffect(() => {
    if (!pathname) {
      return;
    }
    // The first page view is sent by the inline bootstrap (AnalyticsScripts).
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    trackPageView(pathname);
  }, [pathname]);

  useReportWebVitals(metric => {
    track("web_vital", {
      metric_name: metric.name,
      // CLS is unitless and tiny; scale it so it survives integer rounding.
      metric_value: Math.round(metric.name === "CLS" ? metric.value * 1000 : metric.value),
      metric_rating: metric.rating,
    });
  });

  return null;
}
