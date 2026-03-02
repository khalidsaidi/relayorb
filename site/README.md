# relayorb-site

Public marketing website for RelayOrb.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- Framer Motion (subtle section reveal)
- GA4 integration with Consent Mode + consent banner

## Pages

- `/` landing page
- `/demo` anonymous demo details and curl
- `/privacy` analytics/privacy summary
- `/terraform` Terraform module usage

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
  - `cta_try_demo`
  - `cta_deploy_prod_module`
  - `cta_deploy_demo_module`
  - `outbound_github`
  - `copy_demo_curl`
  - `copy_terraform_snippet`

No PII is intentionally sent in events.

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
- Demo docs: https://github.com/khalidsaidi/relayorb/blob/main/docs/DEMO.md
- Terraform prod module: https://registry.terraform.io/modules/khalidsaidi/relayorb/google/latest
- Terraform demo module: https://registry.terraform.io/modules/khalidsaidi/relayorb-demo/google/latest
