"use client";

import { sendGAEvent } from "@next/third-parties/google";

export const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() ?? "";

export const CONSENT_STORAGE_KEY = "relayorb_analytics_consent";

export type AnalyticsConsent = "granted" | "denied";

const CONSENT_DENIED_PAYLOAD = {
  analytics_storage: "denied",
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
} as const;

const CONSENT_GRANTED_PAYLOAD = {
  analytics_storage: "granted",
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
} as const;

function canUseBrowser() {
  return typeof window !== "undefined";
}

export function readConsent(): AnalyticsConsent | null {
  if (!canUseBrowser()) {
    return null;
  }
  try {
    const value = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}

export function updateConsent(consent: AnalyticsConsent) {
  if (!canUseBrowser()) {
    return;
  }
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, consent);
  } catch {
    // Storage blocked: the choice still applies for this page view.
  }
  if (GA_MEASUREMENT_ID) {
    sendGAEvent(
      "consent",
      "update",
      consent === "granted" ? CONSENT_GRANTED_PAYLOAD : CONSENT_DENIED_PAYLOAD,
    );
  }
  window.dispatchEvent(new CustomEvent("relayorb-analytics-consent"));
}

export function sanitizePath(path: string) {
  const [withoutHash] = path.split("#");
  const [withoutQuery] = withoutHash.split("?");
  return withoutQuery || "/";
}

export type PageType = "home" | "guide" | "guides_index" | "docs" | "legal" | "not_found" | "other";

/**
 * Page classification used for GA4 content groups and the page_type dimension.
 * Keep in sync with the inline bootstrap in AnalyticsBootstrap.tsx, which runs before React.
 */
export function pageMeta(pathname: string): { pageType: PageType; contentSlug: string } {
  const path = sanitizePath(pathname);
  if (path === "/") return { pageType: "home", contentSlug: "" };
  if (path === "/guides") return { pageType: "guides_index", contentSlug: "" };
  if (path.startsWith("/guides/")) {
    return { pageType: "guide", contentSlug: path.slice("/guides/".length).split("/")[0] };
  }
  if (path === "/docs") return { pageType: "docs", contentSlug: "" };
  if (path === "/privacy") return { pageType: "legal", contentSlug: "" };
  return { pageType: "other", contentSlug: "" };
}

type EventParams = Record<string, unknown>;

function sanitizeString(value: string) {
  const trimmed = value.trim().slice(0, 100);
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const parsed = new URL(trimmed);
      return `${parsed.hostname}${sanitizePath(parsed.pathname)}`;
    } catch {
      return trimmed;
    }
  }
  return trimmed.startsWith("/") ? sanitizePath(trimmed) : trimmed;
}

/**
 * Send a GA4 event. Every event carries content_group, page_type, and content_slug,
 * so all events can be broken down by page in reports (content_slug is "(none)" off guides). GA's consent mode decides what is
 * stored: before a visitor accepts, hits are cookieless pings; after, full analytics.
 * Every parameter name sent here must be registered as a custom dimension in GA4
 * (see scripts/ga-admin.mjs), or it never appears in reports.
 */
export function track(name: string, params: EventParams = {}) {
  if (!GA_MEASUREMENT_ID || !canUseBrowser()) {
    return;
  }
  const { pageType, contentSlug } = pageMeta(window.location.pathname);
  // Sent explicitly on every event: the values set by the bootstrap's config call stick to the
  // first page and are not updated by client-side navigation.
  const payload: Record<string, string | number | boolean> = {
    content_group: pageType,
    page_type: pageType,
  };
  payload.content_slug = contentSlug || "(none)";
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") payload[key] = sanitizeString(value);
    else if (typeof value === "number" || typeof value === "boolean") payload[key] = value;
  }
  sendGAEvent("event", name, payload);
}

/** Page view for client-side navigations. The first page view is sent by the inline bootstrap. */
export function trackPageView(pathname: string) {
  if (!GA_MEASUREMENT_ID || !canUseBrowser()) {
    return;
  }
  const path = sanitizePath(pathname);
  const { pageType, contentSlug } = pageMeta(path);
  const slug = contentSlug || "(none)";
  sendGAEvent("event", "page_view", {
    content_group: pageType,
    page_location: `${window.location.origin}${path}`,
    page_title: document.title,
    page_type: pageType,
    content_slug: slug,
  });
}
