'use client'

import { useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { usePostHog } from 'posthog-js/react'
import { useBlockSale } from '@/hooks/use-block-sale'
import { BlockSaleStandForm } from '@/components/block-sale-stand-form'

export default function ApplyPage() {
  const params = useParams<{ slug: string }>()
  const slug = params.slug
  const router = useRouter()
  const posthog = usePostHog()
  const tracked = useRef(false)
  const { data: bs, isLoading, error } = useBlockSale(slug)

  useEffect(() => {
    if (tracked.current || !bs) return
    tracked.current = true
    posthog?.capture('block_sale_apply_started', { slug, blockSaleId: bs.id })
  }, [bs, posthog, slug])

  if (isLoading) return <p className="p-6">Laddar…</p>
  if (error || !bs) return <p className="p-6">Kunde inte ladda kvartersloppis.</p>

  const isOver = new Date(bs.endDate + 'T23:59:59') < new Date()
  if (isOver) {
    return (
      <div className="max-w-xl mx-auto p-6">
        <p>Detta kvartersloppis är avslutat — det går inte längre att ansöka.</p>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <header>
        <h1 className="font-display text-2xl font-bold">Ansök om stånd</h1>
        <p className="text-espresso/70">{bs.name}</p>
      </header>
      <p className="text-sm text-espresso/65">
        Fyll i din adress och vad du tänker sälja. Vi skickar ett bekräftelsemail —
        klicka på länken där så går ansökan till arrangören.
      </p>
      <BlockSaleStandForm
        blockSaleId={bs.id}
        defaultCity={bs.city}
        onSuccess={() => router.push(`/kvartersloppis/${slug}/ansokt`)}
      />
    </div>
  )
}
