'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { api, OrganizerProfile } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import { FyndstigenLogo } from '@/components/fyndstigen-logo'
import { useFlag } from '@/lib/flags'

export default function EditProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <FyndstigenLogo size={40} className="text-rust animate-bob" />
        </div>
      }
    >
      <EditProfilePageInner />
    </Suspense>
  )
}

function EditProfilePageInner() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const skyltfonstretEnabled = useFlag('skyltfonstret')
  const [profile, setProfile] = useState<OrganizerProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const searchParams = useSearchParams()
  const [upgradeLoading, setUpgradeLoading] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  // Check for success redirect from Stripe Checkout
  useEffect(() => {
    if (searchParams.get('skyltfonstret') === 'active') {
      setShowSuccess(true)
      router.replace('/profile/edit', { scroll: false })
      setTimeout(() => setShowSuccess(false), 5000)
    }
  }, [searchParams, router])

  async function handleUpgrade() {
    setUpgradeLoading(true)
    try {
      const data = await api.edge.invoke<{ url?: string }>('skyltfonstret-checkout')
      // eslint-disable-next-line no-restricted-syntax -- internal guard: unexpected missing URL from edge function, caught immediately above
      if (!data?.url) throw new Error('Failed to create checkout')
      window.location.href = data.url
    } catch {
      setUpgradeLoading(false)
    }
  }

  async function handleManageSubscription() {
    setUpgradeLoading(true)
    try {
      const data = await api.edge.invoke<{ url?: string }>('skyltfonstret-portal')
      // eslint-disable-next-line no-restricted-syntax -- internal guard: unexpected missing URL from edge function, caught immediately above
      if (!data?.url) throw new Error('Failed to create portal session')
      window.location.href = data.url
    } catch {
      setUpgradeLoading(false)
    }
  }

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
        className="inline-flex items-center gap-1.5 text-sm text-espresso/60 hover:text-espresso transition-colors mb-6"
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

      {/* Success banner */}
      {skyltfonstretEnabled && showSuccess && (
        <div className="bg-forest/10 text-forest rounded-xl px-4 py-3 text-sm font-medium mb-6 animate-fade-up">
          Skyltfönstret är aktiverat! Dina loppisar får nu bättre synlighet.
        </div>
      )}

      {/* Skyltfönstret */}
      {skyltfonstretEnabled && <div className="vintage-card p-6 mb-6">
        {isPremium ? (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="stamp text-mustard text-xs">Skyltfönstret</span>
              <span className="text-sm font-semibold">Aktivt</span>
            </div>
            <p className="text-sm text-espresso/60 mb-4">
              Dina loppisar har utökad SEO, detaljerad statistik och bättre synlighet på Google.
            </p>
            <button
              onClick={handleManageSubscription}
              disabled={upgradeLoading}
              className="text-sm text-rust hover:text-rust-light transition-colors disabled:opacity-50"
            >
              {upgradeLoading ? 'Laddar...' : 'Hantera prenumeration'}
            </button>
          </div>
        ) : (
          <div>
            <h3 className="font-display font-bold text-lg mb-2">Skyltfönstret</h3>
            <p className="text-sm text-espresso/70 mb-3">
              Ställ ut din loppis i Skyltfönstret och få tillgång till egen SEO, detaljerad statistik och mer synlighet.
            </p>
            <ul className="text-sm text-espresso/70 space-y-1 mb-4">
              <li>&#10003; Bättre synlighet på Google</li>
              <li>&#10003; Sidvisningar och konvertering</li>
              <li>&#10003; Statistik per loppis</li>
            </ul>
            <button
              onClick={handleUpgrade}
              disabled={upgradeLoading}
              className="h-11 px-6 rounded-xl bg-mustard text-white font-semibold text-sm hover:bg-mustard/90 transition-colors disabled:opacity-50 shadow-sm"
            >
              {upgradeLoading ? 'Laddar...' : 'Uppgradera — 69 kr/mån'}
            </button>
          </div>
        )}
      </div>}

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
          className="h-12 w-full rounded-xl bg-rust text-white font-semibold text-sm hover:bg-rust-light transition-colors disabled:opacity-50 shadow-sm"
        >
          {saving ? 'Sparar...' : saved ? 'Sparat!' : 'Spara ändringar'}
        </button>
      </form>
    </div>
  )
}
