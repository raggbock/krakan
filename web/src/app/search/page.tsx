import type { Metadata } from 'next'
import SearchClient from './search-client'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

// Dynamic robots: noindex on /search?q=… (thin/auto-generated content)
// while keeping the bare /search landing page indexable.
export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams
}): Promise<Metadata> {
  const sp = await searchParams
  const q = Array.isArray(sp.q) ? sp.q[0] : sp.q
  const hasQuery = typeof q === 'string' && q.trim().length > 0
  return {
    alternates: { canonical: '/search' },
    ...(hasQuery ? { robots: { index: false, follow: true } } : {}),
  }
}

export default function SearchPage() {
  return <SearchClient />
}
