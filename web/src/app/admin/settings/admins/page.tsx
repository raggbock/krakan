'use client'

import { useState } from 'react'
import {
  useAdmins,
  usePendingInvites,
  useInviteAdmin,
  useRevokeInvite,
  useRevokeAdmin,
} from '@/hooks/use-admin'

export default function AdminsSettingsPage() {
  const admins = useAdmins()
  const invites = usePendingInvites()
  const invite = useInviteAdmin()
  const revokeInvite = useRevokeInvite()
  const revokeAdmin = useRevokeAdmin()
  const [email, setEmail] = useState('')

  async function onInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    await invite.mutateAsync(email)
    setEmail('')
  }

  return (
    <div className="space-y-10">
      <section>
        <h1 className="font-display text-3xl font-bold">Admins</h1>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl font-bold">Bjud in ny admin</h2>
        <form onSubmit={onInvite} className="flex gap-3">
          <input
            type="email"
            required
            placeholder="namn@domän.se"
            className="flex-1 px-3 py-2 rounded-md border border-cream-warm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button
            type="submit"
            disabled={invite.isPending}
            className="bg-rust text-white px-4 py-2 rounded-md font-semibold disabled:opacity-50"
          >
            {invite.isPending ? 'Skickar…' : 'Bjud in'}
          </button>
        </form>
        {invite.isError && (
          <p className="text-error text-sm">Kunde inte skicka: {String(invite.error)}</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold">Pending invites</h2>
        {invites.data?.length === 0 && <p className="text-espresso/60">Inga pending invites.</p>}
        <ul className="space-y-2">
          {invites.data?.map((i) => (
            <li key={i.id} className="flex items-center justify-between border-b border-cream-warm py-2 text-sm">
              <span>
                <span className="font-medium">{i.email}</span>
                <span className="text-espresso/50 ml-3">
                  utgår {new Date(i.expiresAt).toLocaleDateString('sv-SE')}
                </span>
              </span>
              <button
                onClick={() => revokeInvite.mutate(i.id)}
                className="text-sm text-rust hover:underline"
              >
                Återkalla
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold">Aktiva admins</h2>
        <ul className="space-y-2">
          {admins.data?.map((a) => (
            <li key={a.userId} className="flex items-center justify-between border-b border-cream-warm py-2 text-sm">
              <span>
                <span className="font-medium">{a.email || a.userId}</span>
                <span className="text-espresso/50 ml-3">
                  sedan {new Date(a.grantedAt).toLocaleDateString('sv-SE')}
                </span>
              </span>
              <button
                onClick={() => {
                  if (confirm(`Återkalla admin-behörighet för ${a.email || a.userId}?`)) {
                    revokeAdmin.mutate(a.userId)
                  }
                }}
                className="text-sm text-rust hover:underline"
              >
                Återkalla
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
