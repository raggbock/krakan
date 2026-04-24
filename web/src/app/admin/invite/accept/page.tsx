'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useAcceptInvite } from '@/hooks/use-admin'

function AcceptInviteInner() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token') ?? ''
  const { user, loading } = useAuth()
  const accept = useAcceptInvite()
  const [state, setState] = useState<'idle' | 'running' | 'done' | 'error'>('idle')

  useEffect(() => {
    if (!token || loading || !user || state !== 'idle') return
    setState('running')
    accept
      .mutateAsync(token)
      .then(() => {
        setState('done')
        router.replace('/admin')
      })
      .catch(() => setState('error'))
  }, [token, loading, user, state, accept, router])

  useEffect(() => {
    if (!loading && !user && token) {
      const next = encodeURIComponent(`/admin/invite/accept?token=${token}`)
      router.replace(`/auth?next=${next}`)
    }
  }, [loading, user, token, router])

  if (!token) return <p className="p-8">Ogiltig länk — token saknas.</p>

  if (!loading && !user) {
    return <p className="p-8 text-center text-espresso/65">Omdirigerar till inloggning…</p>
  }

  return (
    <div className="max-w-md mx-auto p-8 text-center">
      <h1 className="font-display text-2xl font-bold">Aktiverar admin-konto…</h1>
      {state === 'running' && <p className="mt-4 text-espresso/65">Ett ögonblick.</p>}
      {state === 'error' && (
        <p className="mt-4 text-error">Kunde inte aktivera inviten. Kontakta den som bjöd in dig.</p>
      )}
    </div>
  )
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<p className="p-8 text-center text-espresso/65">Laddar…</p>}>
      <AcceptInviteInner />
    </Suspense>
  )
}
