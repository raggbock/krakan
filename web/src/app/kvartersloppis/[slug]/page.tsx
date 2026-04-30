'use client'

import { useParams } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'
import { useBlockSale } from '@/hooks/use-block-sale'
import { BlockSalePublicMap } from '@/components/block-sale-public-map'
import { BlockSaleStandPanel } from '@/components/block-sale-stand-panel'

export default function Page() {
  const params = useParams<{ slug: string }>()
  const slug = params.slug
  const { data: bs, isLoading, error } = useBlockSale(slug)
  const [selectedStandId, setSelectedStandId] = useState<string | null>(null)

  if (isLoading) return <p className="p-6">Laddar…</p>
  if (error || !bs) return <p className="p-6">Kunde inte ladda kvartersloppis.</p>

  const dateLabel = bs.endDate !== bs.startDate ? `${bs.startDate} – ${bs.endDate}` : bs.startDate
  const isOver = new Date(bs.endDate + 'T23:59:59') < new Date()

  type ApprovedStand = (typeof bs.approvedStands)[number]
  const selectedStand = selectedStandId
    ? (bs.approvedStands as ApprovedStand[]).find((s: ApprovedStand) => s.id === selectedStandId) ?? null
    : null

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold">{bs.name}</h1>
        <p className="text-espresso/70">
          {dateLabel} · {bs.dailyOpen}–{bs.dailyClose} · {bs.city}
        </p>
        {bs.description && <p className="mt-2">{bs.description}</p>}
        {isOver && <p className="mt-2 text-rust">Detta kvartersloppis är avslutat.</p>}
      </header>

      <BlockSalePublicMap
        stands={bs.approvedStands}
        center={
          bs.centerLatitude && bs.centerLongitude
            ? { lat: bs.centerLatitude, lng: bs.centerLongitude }
            : null
        }
        onSelect={setSelectedStandId}
      />

      {!isOver && (
        <section>
          <Link
            href={`/kvartersloppis/${slug}/ansok`}
            className="inline-block bg-forest text-white px-5 py-3 rounded-pill font-bold hover:bg-forest-light transition-colors"
          >
            Ansök om eget stånd
          </Link>
        </section>
      )}

      {selectedStand && (
        <BlockSaleStandPanel
          stand={selectedStand}
          onClose={() => setSelectedStandId(null)}
        />
      )}
    </div>
  )
}
