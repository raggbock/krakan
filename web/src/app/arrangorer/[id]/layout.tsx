import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServerData } from '@fyndstigen/shared'

type Props = {
  params: Promise<{ id: string }>
  children: React.ReactNode
}

function getServerData() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder',
  )
  return createSupabaseServerData(supabase)
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const organizer = await getServerData().getOrganizerMeta(id)
  if (!organizer) {
    return { title: 'Arrangören hittades inte' }
  }

  const description = organizer.bio
    ? organizer.bio.slice(0, 160)
    : `${organizer.name} arrangerar ${organizer.marketCount} loppisar på Fyndstigen.`

  return {
    title: organizer.name,
    description,
    openGraph: {
      title: `${organizer.name} — Arrangör på Fyndstigen`,
      description,
      type: 'profile',
      locale: 'sv_SE',
    },
  }
}

export default async function OrganizerLayout({ params, children }: Props) {
  const { id } = await params
  const organizer = await getServerData().getOrganizerMeta(id)

  const jsonLd = organizer
    ? {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: organizer.name,
        ...(organizer.bio ? { description: organizer.bio } : {}),
        ...(organizer.website ? { url: organizer.website } : {}),
      }
    : null

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {children}
    </>
  )
}
