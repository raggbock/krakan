import type { Metadata } from 'next'
import { createSupabaseServerData } from '@fyndstigen/shared'
import { createSupabaseAnonClient } from '@/lib/supabase/anon'
import { publicSource } from '@/app/loppis/[slug]/market-cache'
import { buildLoppisMetadata, LoppisLayoutView } from '@/app/loppis/[slug]/loppis-view'

// The cached copy of /loppis/[slug], for everyone without a session —
// crawlers and most visitors. middleware.ts rewrites /loppis/<slug> here, so
// the address bar and canonical stay /loppis/<slug>; a direct hit on this path
// is redirected back. No cookies anywhere in this tree, so ISR applies.
//
// Measured before the split (fyndstigen.se, 2026-09-27): 652 loppis renders a
// day, every one a full render at ~0.5–1 s CPU. With revalidate 3600 about 395
// of them would still render (a third of pages are visited once a day).
export const revalidate = 3600

export async function generateStaticParams() {
  // Pre-render the top markets at build time. Other slugs render on first
  // request and are cached from then on (dynamicParams defaults to true).
  const server = createSupabaseServerData(createSupabaseAnonClient())
  const markets = await server.listPublishedMarketIds()
  return markets.slice(0, 200).map((m) => ({ slug: m.slug ?? m.id }))
}

type Props = {
  params: Promise<{ slug: string }>
  children: React.ReactNode
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  return buildLoppisMetadata(slug, publicSource)
}

export default async function LoppisPublicLayout({ params, children }: Props) {
  const { slug } = await params
  return (
    <LoppisLayoutView slug={slug} source={publicSource}>
      {children}
    </LoppisLayoutView>
  )
}
