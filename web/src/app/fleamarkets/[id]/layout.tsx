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
  const market = await getServerData().getMarketMeta(id)
  if (!market) {
    return { title: 'Loppis hittades inte' }
  }

  const title = market.name
  const description = market.description
    ? market.description.slice(0, 160)
    : `${market.name} i ${market.city}. Hitta öppettider, adress och boka bord på Fyndstigen.`

  return {
    title,
    description,
    openGraph: {
      title: `${market.name} — Fyndstigen`,
      description,
      type: 'website',
      locale: 'sv_SE',
    },
  }
}

export default async function FleaMarketLayout({ params, children }: Props) {
  const { id } = await params
  const market = await getServerData().getMarketMeta(id)

  const jsonLd = market
    ? {
        '@context': 'https://schema.org',
        '@type': 'LocalBusiness',
        name: market.name,
        description: market.description,
        address: {
          '@type': 'PostalAddress',
          streetAddress: market.street,
          postalCode: market.zip_code,
          addressLocality: market.city,
          addressCountry: 'SE',
        },
        ...(market.latitude && market.longitude
          ? {
              geo: {
                '@type': 'GeoCoordinates',
                latitude: market.latitude,
                longitude: market.longitude,
              },
            }
          : {}),
        url: `https://fyndstigen.se/fleamarkets/${id}`,
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
