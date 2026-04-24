'use client'

import { useMemo, useState } from 'react'
import { useTakeoverPending, useTakeoverSend } from '@/hooks/use-takeover-admin'

export default function AdminTakeoverPage() {
  const pending = useTakeoverPending()
  const send = useTakeoverSend()
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const markets = pending.data?.markets ?? []
  const canSend = useMemo(
    () => markets.filter((m) => selected.has(m.marketId) && m.contactEmail),
    [markets, selected],
  )

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelected(new Set(markets.filter((m) => m.contactEmail).map((m) => m.marketId)))
  }

  function clear() {
    setSelected(new Set())
  }

  async function onSend() {
    const ids = canSend.map((m) => m.marketId)
    if (ids.length === 0) return
    if (!confirm(`Skicka takeover-inbjudningar till ${ids.length} butiker?`)) return
    await send.mutateAsync(ids)
    setSelected(new Set())
  }

  return (
    <div className="space-y-8">
      <section>
        <h1 className="font-display text-3xl font-bold">Takeover</h1>
        <p className="text-espresso/65 mt-1">
          System-ägda butiker med aktiva tokens. Välj vilka som ska få ett
          mejl med länk till takeover-flödet.
        </p>
      </section>

      {pending.isLoading && <p className="text-espresso/60">Laddar…</p>}
      {pending.isError && (
        <p className="text-red-700 text-sm">Kunde inte hämta: {String(pending.error)}</p>
      )}

      {pending.data && markets.length === 0 && (
        <p className="text-espresso/60">Inga butiker väntar på takeover-inbjudan.</p>
      )}

      {markets.length > 0 && (
        <>
          <section className="flex items-center gap-3">
            <button onClick={selectAll} className="text-sm text-rust hover:underline">
              Markera alla med e-post
            </button>
            <button onClick={clear} className="text-sm text-espresso/60 hover:underline">
              Rensa
            </button>
            <span className="text-sm text-espresso/60 ml-auto">
              {selected.size} av {markets.length} valda
            </span>
            <button
              onClick={onSend}
              disabled={canSend.length === 0 || send.isPending}
              className="bg-emerald-700 text-white px-4 py-2 rounded-md font-semibold disabled:opacity-50"
            >
              {send.isPending ? 'Skickar…' : `Skicka (${canSend.length})`}
            </button>
          </section>

          <section>
            <ul className="divide-y divide-cream-warm">
              {markets.map((m) => {
                const checked = selected.has(m.marketId)
                return (
                  <li key={m.marketId} className="py-3 text-sm flex items-baseline gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(m.marketId)}
                      disabled={!m.contactEmail}
                      className="mt-1"
                    />
                    <span className="text-espresso/40 tabular-nums w-8">P{m.priority}</span>
                    <span className="font-medium flex-1">{m.name}</span>
                    <span className="text-espresso/60 w-32">{m.city ?? '—'}</span>
                    <span className={`w-56 ${m.contactEmail ? 'text-espresso/70' : 'text-red-700 italic'}`}>
                      {m.contactEmail ?? 'ingen e-post'}
                    </span>
                    {m.sentAt && (
                      <span className="text-xs text-espresso/50 tabular-nums">
                        skickat {new Date(m.sentAt).toLocaleDateString('sv-SE')}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        </>
      )}

      {send.data && (
        <section className="rounded-md border border-cream-warm p-4 space-y-2">
          <h2 className="font-display text-lg font-bold">Rapport</h2>
          <div className="flex gap-6 text-sm">
            <span className="text-emerald-700 font-semibold">
              Skickat: {send.data.summary.sent}
            </span>
            <span className="text-amber-700">Överhoppade: {send.data.summary.skipped}</span>
            <span className="text-red-700">Fel: {send.data.summary.errors}</span>
          </div>
          <ul className="text-sm space-y-1 mt-2">
            {send.data.results.map((r) => (
              <li key={r.marketId} className="flex gap-3">
                <span className={`w-20 font-semibold ${
                  r.status === 'sent' ? 'text-emerald-700' :
                  r.status === 'skipped' ? 'text-amber-700' : 'text-red-700'
                }`}>
                  {r.status}
                </span>
                <span className="text-espresso/70">{r.email ?? '(ingen e-post)'}</span>
                {r.reason && <span className="text-espresso/50">— {r.reason}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
