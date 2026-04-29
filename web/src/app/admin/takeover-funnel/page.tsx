'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useTakeoverFunnel } from '@/hooks/use-takeover-funnel'
import { FyndstigenLogo } from '@/components/fyndstigen-logo'
import { marketUrl } from '@/lib/urls'
import type { FunnelRow } from '@fyndstigen/shared/contracts/admin-takeover-funnel'

// Nya flödet (efter 8a385fd) har fyra levande stages:
//   never_clicked        — invitet skickat men aldrig öppnat
//   clicked_only         — landade på sidan, försökte aldrig submitta
//   attempt_failed       — försökte submitta, fick fel (oftast email_mismatch)
//   attempt_succeeded_unclaimed — submit ok, magic-link skickad men aldrig klickad
// När visitorn klickar magic-link:en sätts used_at och tokenen försvinner.
// email_no_code + code_sent_unverified kan bara innehålla legacy-tokens
// från innan magic-link-deployen — visas tills de rinner ut.
const STAGE_LABEL: Record<FunnelRow['stage'], string> = {
  never_clicked: 'Aldrig klickat',
  clicked_only: 'Klickat, ej försökt',
  attempt_failed: 'Försök misslyckades',
  attempt_succeeded_unclaimed: 'Mail skickat, ej inloggad',
  email_no_code: 'E-post angiven (legacy)',
  code_sent_unverified: 'Kod skickad (legacy)',
}

const STAGE_TONE: Record<FunnelRow['stage'], string> = {
  never_clicked: 'bg-cream-warm text-espresso-light',
  clicked_only: 'bg-mustard/15 text-mustard',
  attempt_failed: 'bg-rust/15 text-rust',
  attempt_succeeded_unclaimed: 'bg-forest/15 text-forest',
  email_no_code: 'bg-rust/15 text-rust',
  code_sent_unverified: 'bg-forest/15 text-forest',
}

type StageFilter = 'all' | FunnelRow['stage']

export default function TakeoverFunnelPage() {
  const { data, isLoading, error } = useTakeoverFunnel()
  const [filter, setFilter] = useState<StageFilter>('all')

  const filtered = useMemo(() => {
    if (!data) return []
    return filter === 'all' ? data.rows : data.rows.filter((r) => r.stage === filter)
  }, [data, filter])

  if (isLoading) {
    return (
      <div className="min-h-dvh grid place-items-center">
        <FyndstigenLogo size={40} className="text-rust animate-bob" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-10">
        <p className="text-error">Kunde inte ladda funnel: {error instanceof Error ? error.message : 'okänt fel'}</p>
      </div>
    )
  }

  const { summary } = data

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold mb-2">Takeover-funnel</h1>
        <p className="text-espresso-light">
          Aktiva tokens som ännu inte är claimade. Sortera per steg för att se var folk fastnar.
        </p>
        <p className="text-espresso/55 text-xs mt-2">
          Fyra levande stages: <strong>aldrig klickat</strong> · <strong>klickat, ej försökt</strong> ·{' '}
          <strong>försök misslyckades</strong> (oftast email-mismatch — kolla last_failure_code) ·{' '}
          <strong>mail skickat, ej inloggad</strong> (magic-link gick ut men de loggade aldrig in).
          De två legacy-stagen rör bara tokens från innan magic-link-deployen.
        </p>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
        <SummaryCard label="Totalt aktiva" count={summary.total} active={filter === 'all'} onClick={() => setFilter('all')} />
        <SummaryCard label="Aldrig klickat" count={summary.neverClicked} active={filter === 'never_clicked'} onClick={() => setFilter('never_clicked')} />
        <SummaryCard label="Klickat, ej försökt" count={summary.clickedOnly} active={filter === 'clicked_only'} onClick={() => setFilter('clicked_only')} />
        <SummaryCard label="Försök misslyckades" count={summary.attemptFailed} active={filter === 'attempt_failed'} onClick={() => setFilter('attempt_failed')} />
        <SummaryCard label="Mail ej klickat" count={summary.attemptSucceededUnclaimed} active={filter === 'attempt_succeeded_unclaimed'} onClick={() => setFilter('attempt_succeeded_unclaimed')} />
        <SummaryCard label="E-post (legacy)" count={summary.emailNoCode} active={filter === 'email_no_code'} onClick={() => setFilter('email_no_code')} />
        <SummaryCard label="Kod (legacy)" count={summary.codeSentUnverified} active={filter === 'code_sent_unverified'} onClick={() => setFilter('code_sent_unverified')} />
      </div>

      <div className="bg-card border border-cream-warm rounded-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-parchment border-b border-cream-warm text-left text-[12px] uppercase tracking-wide text-espresso/55">
            <tr>
              <th className="px-4 py-3 font-bold">Loppis</th>
              <th className="px-4 py-3 font-bold">Stad</th>
              <th className="px-4 py-3 font-bold">E-post</th>
              <th className="px-4 py-3 font-bold">Steg</th>
              <th className="px-4 py-3 font-bold">Försök</th>
              <th className="px-4 py-3 font-bold">Skickad</th>
              <th className="px-4 py-3 font-bold">Klickad</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-espresso/55">
                  Inga rader matchar filtret.
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr key={r.tokenId} className="border-b border-cream-warm/60 hover:bg-parchment/50">
                <td className="px-4 py-3">
                  {r.marketSlug ? (
                    <Link href={marketUrl({ id: r.marketId, slug: r.marketSlug })} className="text-rust hover:underline">
                      {r.marketName}
                    </Link>
                  ) : (
                    r.marketName
                  )}
                </td>
                <td className="px-4 py-3 text-espresso-light">{r.city ?? '—'}</td>
                <td className="px-4 py-3 text-espresso-light font-mono text-xs">{r.sentToEmail ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${STAGE_TONE[r.stage]}`}>
                    {STAGE_LABEL[r.stage]}
                  </span>
                </td>
                <td className="px-4 py-3 text-espresso-light text-xs">
                  {r.emailAttemptCount === 0 ? '—' : (
                    <span title={r.lastFailureCode ?? 'success'}>
                      {r.emailAttemptCount}× {r.lastFailureCode ? `(${r.lastFailureCode})` : '✓'}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-espresso-light text-xs">
                  {r.sentAt ? `${Math.round(r.daysSinceSent)} d sedan` : '—'}
                </td>
                <td className="px-4 py-3 text-espresso-light text-xs">
                  {r.clickedAt ? new Date(r.clickedAt).toLocaleDateString('sv-SE') : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SummaryCard({
  label, count, active, onClick,
}: {
  label: string; count: number; active: boolean; onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left p-4 rounded-card border transition-colors ${
        active ? 'border-rust bg-rust/5' : 'border-cream-warm bg-card hover:border-espresso-light'
      }`}
    >
      <div className="text-2xl font-display font-bold text-espresso">{count}</div>
      <div className="text-[12px] text-espresso/65 mt-1">{label}</div>
    </button>
  )
}
