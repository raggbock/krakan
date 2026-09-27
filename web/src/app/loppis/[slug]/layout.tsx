import type { Metadata } from 'next'
import { sessionSource } from './market-cache'
import { buildLoppisMetadata, LoppisLayoutView } from './loppis-view'

// Signed-in visitors only. middleware.ts rewrites every request without a
// session to /loppis-publik/[slug], the ISR-cached copy of this page. This
// route reads the session cookies — so organizers can preview their drafts —
// and that makes it render per request, which is fine for the few who land
// here. (It used to be the only route, with `revalidate = 3600` that could
// never apply: cookies() made every render dynamic, cache hits included.)

type Props = {
  params: Promise<{ slug: string }>
  children: React.ReactNode
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  return buildLoppisMetadata(slug, sessionSource)
}

export default async function LoppisLayout({ params, children }: Props) {
  const { slug } = await params
  return (
    <LoppisLayoutView slug={slug} source={sessionSource}>
      {children}
    </LoppisLayoutView>
  )
}
