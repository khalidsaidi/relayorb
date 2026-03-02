"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { trackEvent } from "@/lib/analytics";

const SCROLL_MILESTONES = [25, 50, 75, 100] as const;

function currentScrollDepth() {
  const documentHeight = document.documentElement.scrollHeight - window.innerHeight;
  if (documentHeight <= 0) {
    return 100;
  }

  const raw = (window.scrollY / documentHeight) * 100;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

export function EngagementAnalytics() {
  const pathname = usePathname();
  const seenSectionsRef = useRef<Set<string>>(new Set());
  const seenDepthRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    seenSectionsRef.current.clear();
    seenDepthRef.current.clear();
  }, [pathname]);

  useEffect(() => {
    if (!pathname) {
      return;
    }

    const onScroll = () => {
      const depth = currentScrollDepth();
      for (const milestone of SCROLL_MILESTONES) {
        if (depth >= milestone && !seenDepthRef.current.has(milestone)) {
          seenDepthRef.current.add(milestone);
          trackEvent("scroll_depth", {
            percent: milestone,
            path: pathname,
          });
        }
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [pathname]);

  useEffect(() => {
    if (!pathname || typeof IntersectionObserver === "undefined") {
      return;
    }

    const sections = Array.from(
      document.querySelectorAll<HTMLElement>("[data-analytics-section]"),
    );

    if (!sections.length) {
      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting || entry.intersectionRatio < 0.35) {
            continue;
          }

          const section = entry.target.getAttribute("data-analytics-section");
          if (!section || seenSectionsRef.current.has(section)) {
            continue;
          }

          seenSectionsRef.current.add(section);
          trackEvent("section_view", {
            section,
            path: pathname,
          });
        }
      },
      {
        threshold: [0.35, 0.6],
      },
    );

    sections.forEach(section => observer.observe(section));
    return () => observer.disconnect();
  }, [pathname]);

  return null;
}
