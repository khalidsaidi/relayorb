import type { NextConfig } from "next";

const csp = [
  "default-src 'self'",
  // Google Analytics 4 hosts, per Google's CSP guidance (GA4 also sends hits to www.google.com).
  "script-src 'self' 'unsafe-inline' https://*.googletagmanager.com",
  "connect-src 'self' https://identitytoolkit.googleapis.com https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://www.google.com",
  "img-src 'self' data: https://*.google-analytics.com https://*.googletagmanager.com https://www.google.com",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  output: "export",
  turbopack: {
    root: process.cwd(),
  },
  async headers() {
    return [
      {
        source: "/install.sh",
        headers: [
          { key: "Content-Type", value: "text/plain; charset=utf-8" },
          { key: "Cache-Control", value: "public, max-age=300, s-maxage=300" },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: csp,
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.relayorb.com" }],
        destination: "https://relayorb.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
