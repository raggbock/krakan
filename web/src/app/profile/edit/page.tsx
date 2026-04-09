'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, OrganizerProfile } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import { FyndstigenLogo } from '@/components/fyndstigen-logo'

export default function EditProfilePage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [profile, setProfile] = useState<OrganizerProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Form state
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [bio, setBio] = useState('')
  const [website, setWebsite] = useState('')
  const [phone, setPhone] = useState('')

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push('/auth')
      return
    }
    api.organizers
      .get(user.id)
      .then((p) => {
        setProfile(p)
        setFirstName(p.first_name ?? '')
        setLastName(p.last_name ?? '')
        setBio(p.bio ?? '')
        setWebsite(p.website ?? '')
        setPhone(p.phone_number ?? '')
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user, authLoading])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    setSaved(false)
    setSaveError('')
    try {
      await api.organizers.update(user.id, {
        first_name: firstName || null,
        last_name: lastName || null,
        bio: bio || null,
        website: website || null,
        phone_number: phone || null,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setSaveError('Kunde inte spara. Försök igen.')
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex justify-center py-20">
        <FyndstigenLogo size={40} className="text-rust animate-bob" />
      </div>
    )
  }

  const isPremium = (profile?.subscription_tier ?? 0) >= 1

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-sm text-espresso/40 hover:text-espresso transition-colors mb-6"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M9 3L5 7L9 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Tillbaka
      </button>

      <h1 className="font-display text-2xl font-bold mb-2">Redigera profil</h1>
      <p className="text-sm text-espresso/65 mb-8">
        Din arrangörsprofil syns publikt på{' '}
        <span className="text-espresso/70">/arrangorer/{user?.id?.slice(0, 8)}...</span>
      </p>

      {/* Tier badge */}
      <div className="vintage-card p-5 mb-6 flex items-center justify-between">
        <div>
          <span className="text-sm font-semibold">
            {isPremium ? 'Premium-arrangör' : 'Gratis-arrangör'}
          </span>
          <p className="text-xs text-espresso/40 mt-0.5">
            {isPremium
              ? 'Du har tillgång till statistik, bilder och utvalda-badgen.'
              : 'Uppgradera för statistik, bilder på loppisar och utvald-badge.'}
          </p>
        </div>
        {!isPremium && (
          <span className="bg-mustard/15 text-mustard px-4 py-2 rounded-full text-xs font-bold">
            Kommer snart
          </span>
        )}
        {isPremium && (
          <span className="stamp text-mustard text-xs">Premium</span>
        )}
      </div>

      {/* Edit form */}
      <form onSubmit={handleSave} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-semibold text-espresso/70 block mb-1.5">
              Förnamn
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full h-11 rounded-xl bg-card px-4 text-sm border border-cream-warm outline-none focus:border-rust/40 transition-all"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-espresso/70 block mb-1.5">
              Efternamn
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full h-11 rounded-xl bg-card px-4 text-sm border border-cream-warm outline-none focus:border-rust/40 transition-all"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-semibold text-espresso/70 block mb-1.5">
            Om dig / din organisation
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            placeholder="Berätta lite om dig och dina loppisar..."
            className="w-full rounded-xl bg-card px-4 py-3 text-sm border border-cream-warm outline-none focus:border-rust/40 transition-all resize-none placeholder:text-espresso/25"
          />
        </div>

        <div>
          <label className="text-sm font-semibold text-espresso/70 block mb-1.5">
            Webbplats
          </label>
          <input
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://..."
            className="w-full h-11 rounded-xl bg-card px-4 text-sm border border-cream-warm outline-none focus:border-rust/40 transition-all placeholder:text-espresso/25"
          />
        </div>

        <div>
          <label className="text-sm font-semibold text-espresso/70 block mb-1.5">
            Telefon
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="070-123 45 67"
            className="w-full h-11 rounded-xl bg-card px-4 text-sm border border-cream-warm outline-none focus:border-rust/40 transition-all placeholder:text-espresso/25"
          />
        </div>

        {saveError && (
          <div className="text-sm text-error bg-error/8 border border-error/15 rounded-xl px-4 py-3">
            {saveError}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="h-12 w-full rounded-xl bg-rust text-parchment font-semibold text-sm hover:bg-rust-light transition-colors disabled:opacity-50 shadow-sm"
        >
          {saving ? 'Sparar...' : saved ? 'Sparat!' : 'Spara ändringar'}
        </button>
      </form>
    </div>
  )
}
