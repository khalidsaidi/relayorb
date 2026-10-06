"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { track } from "@/lib/analytics";

const SCROLL_MILESTONES = [25, 50, 75, 100] as const;
// "Read" = scrolled at least 75% and stayed 30 seconds.
const READ_DEPTH = 75;
const READ_SECONDS = 30;

function currentScrollDepth() {
  const root = document.documentElement;
  const max = root.scrollHeight - root.clientHeight;
  if (max <= 0) {
    return 100;
  }
  return Math.max(0, Math.min(100, Math.round(((window.scrollY || root.scrollTop) / max) * 100)));
}

/**
 * Per-page engagement: scroll_depth milestones, section_view, read_complete, code_copy for
 * manual selections inside code, clicks on untracked links, and page_exit with time on page and max scroll.
 * Everything resets on client-side navigation.
 */
export function EngagementAnalytics() {
  const pathname = usePathname();
  const seenDepth = useRef<Set<number>>(new Set());
  const seenSections = useRef<Set<string>>(new Set());
  const maxDepth = useRef(0);
  const startedAt = useRef(0);
  const readSent = useRef(false);
  const exitSent = useRef(false);

  useEffect(() => {
    if (!pathname) {
      return;
    }
    seenDepth.current = new Set();
    seenSections.current = new Set();
    maxDepth.current = 0;
    startedAt.current = Date.now();
    readSent.current = false;
    exitSent.current = false;

    const secondsOnPage = () => Math.round((Date.now() - startedAt.current) / 1000);

    const maybeRead = () => {
      if (!readSent.current && maxDepth.current >= READ_DEPTH && secondsOnPage() >= READ_SECONDS) {
        readSent.current = true;
        track("read_complete", { seconds_on_page: secondsOnPage(), max_scroll: maxDepth.current });
      }
    };

    const onScroll = () => {
      const depth = currentScrollDepth();
      maxDepth.current = Math.max(maxDepth.current, depth);
      for (const milestone of SCROLL_MILESTONES) {
        if (depth >= milestone && !seenDepth.current.has(milestone)) {
          seenDepth.current.add(milestone);
          track("scroll_depth", { scroll_depth: milestone });
        }
      }
      maybeRead();
    };

    const readTimer = window.setTimeout(maybeRead, READ_SECONDS * 1000 + 50);

    const onCopy = () => {
      const node = document.getSelection()?.anchorNode;
      const element = node instanceof Element ? node : node?.parentElement;
      if (element?.closest("pre, code")) {
        track("code_copy", { snippet: "selection", copy_method: "selection" });
      }
    };

    // Links rendered without TrackedLink (guide cards, breadcrumbs, related guides, inline
    // links in content). TrackedLink marks its anchors with data-tracked to avoid doubles.
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.hasAttribute("data-tracked")) {
        return;
      }
      const label = (anchor.textContent || "").trim().slice(0, 100) || anchor.pathname;
      const uiLocation = anchor.closest("header")
        ? "header"
        : anchor.closest("footer")
          ? "footer"
          : anchor.closest("nav")
            ? "nav"
            : "content";
      const params = { cta: label, ui_location: uiLocation, link_url: anchor.href };
      if (anchor.host && anchor.host !== window.location.host) {
        track("outbound_click", { ...params, link_domain: anchor.hostname });
        if (anchor.hostname === "github.com") {
          track("github_click", params);
        }
      } else {
        track("nav_click", params);
      }
    };

    const sendExit = () => {
      if (exitSent.current) {
        return;
      }
      exitSent.current = true;
      track("page_exit", { seconds_on_page: secondsOnPage(), max_scroll: maxDepth.current });
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        sendExit();
      }
    };

    let observer: IntersectionObserver | undefined;
    if (typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(
        entries => {
          for (const entry of entries) {
            if (!entry.isIntersecting || entry.intersectionRatio < 0.35) {
              continue;
            }
            const section = entry.target.getAttribute("data-analytics-section");
            if (section && !seenSections.current.has(section)) {
              seenSections.current.add(section);
              track("section_view", { section });
            }
          }
        },
        { threshold: [0.35, 0.6] },
      );
      document
        .querySelectorAll<HTMLElement>("[data-analytics-section]")
        .forEach(section => observer?.observe(section));
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    document.addEventListener("copy", onCopy);
    document.addEventListener("click", onClick, true);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", sendExit);
    onScroll();

    return () => {
      // Client-side navigation away from this page counts as an exit too.
      sendExit();
      window.clearTimeout(readTimer);
      observer?.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", sendExit);
    };
  }, [pathname]);

  return null;
}
