"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";

export function NotFoundTracker() {
  useEffect(() => {
    track("page_not_found", { page_type: "not_found", link_url: window.location.pathname });
  }, []);
  return null;
}
