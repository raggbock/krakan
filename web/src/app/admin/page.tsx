'use client'

import { useAdmins, useAdminActions } from '@/hooks/use-admin'

export default function AdminOverviewPage() {
  const admins = useAdmins()
  const actions = useAdminActions(20)

  return (
    <div className="space-y-8">
      <section>
        <h1 className="font-display text-3xl font-bold">Översikt</h1>
        <p className="text-espresso/65 mt-1">
          {admins.data?.length ?? '…'} aktiva admins.
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl font-bold mb-3">Senaste händelser</h2>
        {actions.isLoading && <p className="text-espresso/60">Laddar…</p>}
        {actions.data && actions.data.length === 0 && (
          <p className="text-espresso/60">Inga loggade åtgärder ännu.</p>
        )}
        <ul className="space-y-2">
          {actions.data?.map((a) => (
            <li key={a.id} className="text-sm flex gap-3 border-b border-cream-warm py-2">
              <time className="text-espresso/50 tabular-nums min-w-[150px]">
                {new Date(a.createdAt).toLocaleString('sv-SE')}
              </time>
              <span className="font-mono text-espresso/80">{a.action}</span>
              {a.targetId && <span className="text-espresso/60">→ {a.targetId}</span>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
