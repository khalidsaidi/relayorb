import { GoogleAnalytics } from "@next/third-parties/google";

const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();

// Runs before GA loads, and sends the first page view. Plain string with no backslashes or regexes on purpose: this
// ships as an inline script, and scripts/check-inline-scripts.mjs fails the build if
// any inline script does not parse. Page classification mirrors pageMeta() in
// src/lib/analytics.ts.
function bootstrap(id: string) {
  return `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = window.gtag || gtag;
gtag('consent', 'default', {
  analytics_storage: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  wait_for_update: 500
});
try {
  if (localStorage.getItem('relayorb_analytics_consent') === 'granted') {
    gtag('consent', 'update', { analytics_storage: 'granted' });
  }
} catch (e) {}
var p = location.pathname;
var kind = p === '/' ? 'home'
  : p === '/guides' ? 'guides_index'
  : p.indexOf('/guides/') === 0 ? 'guide'
  : p === '/docs' || p === '/testing' ? 'docs'
  : p === '/privacy' ? 'legal'
  : 'other';
var slug = kind === 'guide' ? (p.split('/')[2] || '(none)') : '(none)';
window.__relayorbPageType = kind;
// Config params stick to every later hit for this tag, including Enhanced Measurement
// events. send_page_view is off (also for the library's own config call) so the page view
// below is the only one, and it carries the content group.
gtag('config', '${id}', {
  send_page_view: false,
  allow_google_signals: false,
  content_group: kind,
  page_type: kind,
  content_slug: slug
});
gtag('event', 'page_view', {
  page_location: location.origin + p,
  page_title: document.title,
  content_group: kind,
  page_type: kind,
  content_slug: slug
});
`;
}

export function AnalyticsScripts() {
  if (!gaId) {
    return null;
  }
  return (
    <>
      <script id="ga-bootstrap" dangerouslySetInnerHTML={{ __html: bootstrap(gaId) }} />
      <GoogleAnalytics gaId={gaId} />
    </>
  );
}
