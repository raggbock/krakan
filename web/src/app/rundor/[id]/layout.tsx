import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'

type Props = {
  params: Promise<{ id: string }>
  children: React.ReactNode
}

async function getRoute(id: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  const { data } = await supabase
    .from('routes')
    .select('name, description, route_stops(id)')
    .eq('id', id)
    .single()
  return data
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const route = await getRoute(id)
  if (!route) {
    return { title: 'Rundan hittades inte' }
  }

  const stopCount = (route as any).route_stops?.length ?? 0
  const description = route.description
    ? route.description.slice(0, 160)
    : `Loppisrunda med ${stopCount} stopp. Planera din second hand-tur med Fyndstigen.`

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
