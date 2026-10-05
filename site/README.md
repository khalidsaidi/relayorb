# relayorb-site

Public website for RelayOrb, a flight recorder for AI agents (open-source Rust CLI
that records MCP tool calls to local SQLite and replays/regression-checks them).

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- Framer Motion (subtle section reveal)
- GA4 integration with Consent Mode + consent banner

## Routes

- `/` landing page
- `/privacy` analytics/privacy summary
- `/docs.md` markdown docs (source: `src/lib/docsMarkdown.ts`)
- `/llms.txt` (static, `public/`) and `/llms-full.txt` (same content as `/docs.md`)
- `/privacy.md`, `/terms.md`, `/cookies.md` markdown mirrors
- `/sitemap.xml`, `/robots.txt`
- `/air.json`, `/.well-known/air.json` (static discovery metadata)

## Run locally

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

## Build

```bash
pnpm build
pnpm start
```

## Environment variables

Create `.env.local`:

```bash
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

If `NEXT_PUBLIC_GA_MEASUREMENT_ID` is empty, GA scripts are not loaded.

## GA4 + Consent behavior

- Consent mode default is denied on first load.
- Consent banner offers: **Accept analytics** or **Reject**.
- Consent state is stored in localStorage key:
  - `relayorb_analytics_consent = granted|denied`
- Events are sent only when consent is granted.
- Tracked events:
  - `page_view`
  - `cta_click` (e.g. `view_github`, `quickstart`, `nav_docs`)
  - `copy_code` (e.g. `copy_install`, `copy_mcp_config`, `copy_ci_example`)
  - `outbound_click`

No PII is intentionally sent in events.

## GA verification (prod)

Use GA4 Realtime and DebugView (not the GA Home summary tile):

1. Open `https://relayorb.com` in an incognito session.
2. Click **Accept analytics** in the consent banner.
3. In GA Realtime, confirm:
   - `page_view`
   - `cta_click`
   - `copy_code`
   - `outbound_click`
4. Optional local debug: use GA DebugView in a development session only; do not ship permanent debug flags in production.

## Deploy (Vercel)

1. Import this repo into Vercel.
2. Set env var:
   - `NEXT_PUBLIC_GA_MEASUREMENT_ID`
3. Add domains:
   - `relayorb.com`
   - `www.relayorb.com`
4. Ensure redirect `www -> relayorb.com` is active.
5. Verify HTTPS certs are issued for both domains.

## Security headers

Defined in `next.config.ts`:

- Strict-Transport-Security
- X-Content-Type-Options
- Referrer-Policy
- Permissions-Policy
- Content-Security-Policy (includes GA domains)

## Canonical product links used on site

- GitHub: https://github.com/khalidsaidi/relayorb
- Releases: https://github.com/khalidsaidi/relayorb/releases
