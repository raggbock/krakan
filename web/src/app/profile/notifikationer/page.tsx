import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { NotifikationerClient } from './notifikationer-client'

export const metadata = {
  title: 'Notifikationsinställningar – Fyndstigen',
}

export default async function NotifikationerPage() {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth?next=/profile/notifikationer&reason=auth-required')
  }

  // Load current prefs — may not exist yet (row created on first follow)
  const { data: prefs } = await supabase
    .from('user_notification_prefs')
    .select('email_digest_enabled')
    .eq('user_id', user.id)
    .maybeSingle()

  // Default to true when no prefs row exists yet
  const emailDigestEnabled = prefs?.email_digest_enabled ?? true

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <NotifikationerClient initialEmailDigestEnabled={emailDigestEnabled} userId={user.id} />
    </div>
  )
}
