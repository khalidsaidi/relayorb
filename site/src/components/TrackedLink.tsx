"use client";

import type { AnchorHTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { trackEvent } from "@/lib/analytics";

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & {
  children: ReactNode;
  eventName?: string;
  eventParams?: Record<string, string>;
  variant?: "primary" | "secondary" | "ghost" | "link";
};

const variantClass: Record<NonNullable<Props["variant"]>, string> = {
  primary:
    "rounded-xl border border-cyan-300/50 bg-cyan-400/20 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/35",
  secondary:
    "rounded-xl border border-indigo-300/40 bg-indigo-400/20 px-4 py-2 text-sm font-medium text-indigo-100 transition hover:bg-indigo-300/35",
  ghost:
    "rounded-xl border border-slate-500/60 bg-slate-900/70 px-4 py-2 text-sm text-slate-100 transition hover:border-slate-300",
  link: "text-cyan-300 hover:text-cyan-200",
};

export function TrackedLink({
  children,
  href = "#",
  className,
  eventName,
  eventParams,
  variant = "link",
  target,
  rel,
  ...rest
}: Props) {
  const isExternal = typeof href === "string" && href.startsWith("http");
  const isGithubLink = isExternal && href.includes("github.com");

  const resolvedEventName =
    eventName ?? (isGithubLink ? "outbound_github" : undefined);

  const resolvedEventParams =
    eventParams ??
    (isGithubLink
      ? {
          label: "github_link",
          location: "site",
        }
      : undefined);

  const anchorClass = clsx(variantClass[variant], className);

  const handleClick = () => {
    if (resolvedEventName) {
      trackEvent(resolvedEventName, resolvedEventParams ?? {});
    }
  };

  if (isExternal) {
    return (
      <a
        href={href}
        className={anchorClass}
        target={target ?? "_blank"}
        rel={rel ?? "noreferrer"}
        onClick={handleClick}
        {...rest}
      >
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={anchorClass} onClick={handleClick} {...rest}>
      {children}
    </Link>
  );
}
