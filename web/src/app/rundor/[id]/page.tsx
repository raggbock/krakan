import { notFound } from 'next/navigation'
import { RouteViewer } from './route-viewer'
import { resolveRoute } from './route-cache'

type Props = { params: Promise<{ id: string }> }

export default async function RoutePage({ params }: Props) {
  const { id } = await params

  // E2E bypass — server-side Supabase isn't available under the in-memory
  // bridge, so skip the server fetch and let RouteViewer resolve via hook.
  if (process.env.NEXT_PUBLIC_E2E_FAKE === '1') {
    return <RouteViewer route={null} id={id} />
  }

  const route = await resolveRoute(id)
  if (!route) notFound()

  return <RouteViewer route={route} id={id} />
}
