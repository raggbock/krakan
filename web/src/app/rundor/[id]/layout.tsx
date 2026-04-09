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
  const route = await getServerData().getRouteMeta(id)
  if (!route) {
    return { title: 'Rundan hittades inte' }
  }

  const description = route.description
    ? route.description.slice(0, 160)
    : `Loppisrunda med ${route.stopCount} stopp. Planera din second hand-tur med Fyndstigen.`

  return {
    title: route.name,
    description,
    openGraph: {
      title: `${route.name} — Loppisrunda på Fyndstigen`,
      description,
      type: 'website',
      locale: 'sv_SE',
    },
  }
}

export default function RouteLayout({ children }: Props) {
  return <>{children}</>
}
