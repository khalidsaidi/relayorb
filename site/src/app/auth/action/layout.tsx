import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Complete your account action | RelayOrb",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function EmailActionLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
