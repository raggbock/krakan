'use client'

import { useState } from 'react'
import { useBlockSaleQueue, useBlockSaleDecide, type StandRow } from '@/hooks/use-block-sale-stands'

type Props = {
  slug: string
  blockSaleId: string
}

type Status = StandRow['status']

function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, { label: string; className: string }> = {
    pending:   { label: 'Ej bekräftad', className: 'bg-gray-100 text-gray-600' },
    confirmed: { label: 'Väntar',        className: 'bg-amber-100 text-amber-700' },
    approved:  { label: 'Godkänd',       className: 'bg-green-100 text-green-700' },
    rejected:  { label: 'Avböjd',        className: 'bg-red-100 text-red-700' },
  }
  const { label, className } = map[status] ?? { label: status, className: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${className}`}>
      {label}
    </span>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('sv-SE', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

export function BlockSaleQueue({ slug, blockSaleId }: Props) {
  const { data: standsRaw, isLoading, error } = useBlockSaleQueue(slug, blockSaleId)
  const stands: StandRow[] = standsRaw ?? []
  const decide = useBlockSaleDecide(slug)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  if (isLoading) return <p>Laddar ansökningar…</p>
  if (error) return <p className="text-rust">Kunde inte ladda ansökningar.</p>
  if (stands.length === 0) return <p className="text-espresso/60">Inga ansökningar än.</p>

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === stands.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(stands.map((s) => s.id)))
    }
  }

  const selectedList = stands.filter((s) => selected.has(s.id))
  const anyPendingSelected = selectedList.some((s) => s.status === 'pending')
  const actionableSelected = selectedList.filter((s) => s.status === 'confirmed')

  async function handleBulkDecide(decision: 'approve' | 'reject') {
    const ids = decision === 'approve'
      ? actionableSelected.map((s) => s.id)
      : selectedList.map((s) => s.id)
    if (ids.length === 0) return
    await decide.mutateAsync({ blockSaleId, standIds: ids, decision })
    setSelected(new Set())
  }

  async function handleRowDecide(standId: string, decision: 'approve' | 'reject') {
    await decide.mutateAsync({ blockSaleId, standIds: [standId], decision })
    setSelected((prev) => {
      const next = new Set(prev)
      next.delete(standId)
      return next
    })
  }

  return (
    <div className="space-y-4">
      {/* Bulk toolbar */}
      {selected.size > 0 && (
        <div className="sticky top-0 z-10 bg-parchment/95 backdrop-blur border border-espresso/20 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-sm text-espresso/70 mr-auto">
            {selected.size} markerade
          </span>
          <button
            onClick={() => handleBulkDecide('approve')}
            disabled={decide.isPending || actionableSelected.length === 0}
            title={anyPendingSelected ? 'Markerade rader innehåller ej bekräftade ansökningar — dessa hoppas över' : undefined}
            className="bg-green-600 text-white text-sm px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Godkänn valda{anyPendingSelected && actionableSelected.length > 0 ? ` (${actionableSelected.length})` : ''}
          </button>
          <button
            onClick={() => handleBulkDecide('reject')}
            disabled={decide.isPending || selectedList.length === 0}
            className="bg-red-600 text-white text-sm px-4 py-2 rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Avböj valda
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-sm text-espresso/60 hover:text-espresso transition-colors"
          >
            Avmarkera
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-espresso/15">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-espresso/5 text-left">
              <th className="px-3 py-3 w-10">
                <input
                  type="checkbox"
                  checked={selected.size === stands.length && stands.length > 0}
                  onChange={toggleAll}
                  aria-label="Markera alla"
                  className="rounded"
                />
              </th>
              <th className="px-3 py-3 font-medium">Namn</th>
              <th className="px-3 py-3 font-medium">Adress</th>
              <th className="px-3 py-3 font-medium">Beskrivning</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-3 py-3 font-medium">Ansökt</th>
              <th className="px-3 py-3 font-medium">Åtgärd</th>
            </tr>
          </thead>
          <tbody>
            {stands.map((stand, i) => {
              const isSelected = selected.has(stand.id)
              const canAct = stand.status === 'confirmed'
              return (
                <tr
                  key={stand.id}
                  className={[
                    i % 2 === 0 ? 'bg-white' : 'bg-espresso/2',
                    isSelected ? 'ring-1 ring-inset ring-forest/30' : '',
                  ].join(' ')}
                >
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleOne(stand.id)}
                      aria-label={`Markera ${stand.applicant_name}`}
                      className="rounded"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-medium">{stand.applicant_name}</div>
                    <div className="text-espresso/55 text-xs">{stand.applicant_email}</div>
                  </td>
                  <td className="px-3 py-3">
                    <div>{stand.street}</div>
                    <div className="text-espresso/55 text-xs">{stand.city}</div>
                  </td>
                  <td className="px-3 py-3 max-w-[200px]">
                    <p className="truncate" title={stand.description}>
                      {stand.description}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge status={stand.status} />
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-xs text-espresso/60">
                    {formatDate(stand.created_at)}
                  </td>
                  <td className="px-3 py-3">
                    {canAct ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleRowDecide(stand.id, 'approve')}
                          disabled={decide.isPending}
                          className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                          Godkänn
                        </button>
                        <button
                          onClick={() => handleRowDecide(stand.id, 'reject')}
                          disabled={decide.isPending}
                          className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 transition-colors disabled:opacity-50"
                        >
                          Avböj
                        </button>
                      </div>
                    ) : (
                      <span
                        className="text-xs text-espresso/40"
                        title={
                          stand.status === 'pending'
                            ? 'Inväntar e-postbekräftelse från sökanden'
                            : undefined
                        }
                      >
                        {stand.status === 'pending' ? 'Väntar på bekräftelse' : '—'}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-espresso/50">
        Totalt {stands.length} ansökning{stands.length !== 1 ? 'ar' : ''}
      </p>
    </div>
  )
}
