'use client'

import { useParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useBlockSale } from '@/hooks/use-block-sale'
import { BlockSaleQueue } from '@/components/block-sale-queue'

export default function AdminPage() {
  const params = useParams<{ slug: string }>()
  const slug = params.slug
  const { user, loading: authLoading } = useAuth()
  const { data: bs, isLoading } = useBlockSale(slug)

  if (authLoading || isLoading) return <p className="p-6">Laddar…</p>
  if (!bs) return <p className="p-6">Kunde inte ladda kvartersloppis.</p>
  if (!user || user.id !== bs.organizerId) {
    return <p className="p-6">Du har inte tillgång till den här sidan.</p>
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold">{bs.name} — administration</h1>
        <p className="text-espresso/70">Granska och godkänn ansökningar</p>
      </header>
      <BlockSaleQueue slug={slug} blockSaleId={bs.id} />
    </div>
  )
}
