// The public market view moved to /loppis/[slug]. The only route still
// living under /fleamarkets/[id] is the admin-only /edit page, so this
// layout no longer needs to fetch market data or emit SEO metadata —
// /edit is auth-gated and noindex-ed by virtue of being behind a login.
export default function FleaMarketLegacyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

export const metadata = { robots: { index: false, follow: false } }
