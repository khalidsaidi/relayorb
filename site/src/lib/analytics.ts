"use client";

export const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() ?? "";

export const CONSENT_STORAGE_KEY = "relayorb_analytics_consent";

export type AnalyticsConsent = "granted" | "denied";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

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

  const value = window.localStorage.getItem(CONSENT_STORAGE_KEY);
  if (value === "granted" || value === "denied") {
    return value;
  }

  return null;
}

export function updateConsent(consent: AnalyticsConsent) {
  if (!canUseBrowser()) {
    return;
  }

  window.localStorage.setItem(CONSENT_STORAGE_KEY, consent);

  if (window.gtag) {
    window.gtag(
      "consent",
      "update",
      consent === "granted"
        ? CONSENT_GRANTED_PAYLOAD
        : CONSENT_DENIED_PAYLOAD,
    );
  }

  window.dispatchEvent(new CustomEvent("relayorb-analytics-consent"));
}

function hasGrantedConsent() {
  return readConsent() === "granted";
}

function hasAnalyticsRuntime() {
  return Boolean(GA_MEASUREMENT_ID && canUseBrowser() && window.gtag);
}

function sanitizeParamValue(value: unknown): string | number | boolean | undefined {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  return undefined;
}

type EventParams = Record<string, unknown>;

export function trackEvent(name: string, params: EventParams = {}) {
  if (!hasAnalyticsRuntime() || !hasGrantedConsent()) {
    return;
  }

  const safeParams = Object.fromEntries(
    Object.entries(params)
      .map(([key, value]) => [key, sanitizeParamValue(value)])
      .filter(([, value]) => value !== undefined),
  );

  window.gtag?.("event", name, safeParams);
}

export function trackPageView(pathWithSearch: string) {
  if (!hasAnalyticsRuntime() || !hasGrantedConsent()) {
    return;
  }

  window.gtag?.("config", GA_MEASUREMENT_ID, {
    page_path: pathWithSearch,
  });
}
