'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { usePostHog } from 'posthog-js/react'
import { useAuth } from '@/lib/auth-context'
import { FyndstigenLogo } from '@/components/fyndstigen-logo'
import { useStripeConnect } from '@/hooks/use-stripe-connect'
import {
  useDraftAutosave,
  loadDraft,
  clearDraft,
} from '@/hooks/use-draft-autosave'
import { ImageUploadList } from '@/components/image-upload-list'
import { useFlag } from '@/lib/flags'
import { useMarketForm } from '@/hooks/market-form'
import type { RuleDraft, ExceptionDraft } from '@fyndstigen/shared'
import type { AddressValue } from '@/components/address-picker'
import { MarketBasicInfoSection } from '@/components/market-form/MarketBasicInfoSection'
import { OpeningHoursSection } from '@/components/market-form/OpeningHoursSection'
import { MarketTableAddForm } from '@/components/market-form/MarketTableAddForm'

type TableDraft = {
  label: string
  description: string
  priceSek: number
  sizeDescription: string
}

const DRAFT_KEY = 'fyndstigen-create-market-draft'

type CreateMarketDraft = {
  step: 1 | 2
  name: string
  description: string
  address: AddressValue
  isPermanent: boolean
  autoAcceptBookings: boolean
  rules: RuleDraft[]
  exceptions: ExceptionDraft[]
  tables: TableDraft[]
}

function formatDraftAge(savedAt: number): string {
  const seconds = Math.floor((Date.now() - savedAt) / 1000)
  if (seconds < 60) return 'några sekunder sedan'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min sedan`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} tim sedan`
  return `${Math.floor(hours / 24)} dagar sedan`
}

export default function CreateMarketPage() {
  const router = useRouter()
  const posthog = usePostHog()
  const { user, loading: authLoading } = useAuth()
  const paymentsEnabled = useFlag('payments')

  const [step, setStep] = useState<1 | 2>(1)
  const [hydrated, setHydrated] = useState(false)
  const [restoredAgeLabel, setRestoredAgeLabel] = useState<string | null>(null)

  const form = useMarketForm({ mode: 'create', organizerId: user?.id })
  const { fields, openingHours, images, tables, submit, status } = form

  // Step 2 batch-mode state (only for batch add — single add is handled by MarketTableAddForm)
  const [tableDesc, setTableDesc] = useState('')
  const [tablePrice, setTablePrice] = useState('')
  const [tableSize, setTableSize] = useState('')
  const [batchMode, setBatchMode] = useState(false)
  const [batchPrefix, setBatchPrefix] = useState('Bord')
  const [batchCount, setBatchCount] = useState('')

  const hasAnyPaidTable = tables.newTables.some((t) => t.priceSek > 0)
  const needsStripe = paymentsEnabled && hasAnyPaidTable
  const { onboardingComplete: stripeReady, loading: stripeLoading } = useStripeConnect(
    user?.id,
    needsStripe,
  )

  // Hydrate draft on first mount.
  useEffect(() => {
    const existing = loadDraft<CreateMarketDraft>(DRAFT_KEY)
    if (existing) {
      const d = existing.data
      setStep(d.step)
      fields.setName(d.name)
      fields.setDescription(d.description)
      fields.setAddress(d.address)
      fields.setIsPermanent(d.isPermanent)
      fields.setAutoAcceptBookings(d.autoAcceptBookings)
      openingHours.reset(d.rules, d.exceptions)
      tables.addBatch(d.tables)
      const hasContent =
        d.name.trim() !== '' ||
        d.description.trim() !== '' ||
        d.address.street.trim() !== '' ||
        d.tables.length > 0 ||
        d.rules.length > 0
      if (hasContent) setRestoredAgeLabel(formatDraftAge(existing.savedAt))
    }
    setHydrated(true)
    // Intentionally run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist draft (debounced).
  const draft = useMemo<CreateMarketDraft>(
    () => ({
      step,
      name: fields.name,
      description: fields.description,
      address: fields.address,
      isPermanent: fields.isPermanent,
      autoAcceptBookings: fields.autoAcceptBookings,
      rules: openingHours.rules,
      exceptions: openingHours.exceptions,
      tables: tables.newTables,
    }),
    [step, fields.name, fields.description, fields.address, fields.isPermanent,
     fields.autoAcceptBookings, openingHours.rules, openingHours.exceptions, tables.newTables],
  )

  useDraftAutosave(DRAFT_KEY, draft, { enabled: hydrated })

  function discardDraft() {
    clearDraft(DRAFT_KEY)
    setStep(1)
    fields.setName('')
    fields.setDescription('')
    fields.setAddress({ street: '', zipCode: '', city: '', latitude: null, longitude: null })
    fields.setIsPermanent(true)
    fields.setAutoAcceptBookings(false)
    openingHours.reset([], [])
    tables.resetNew()
    setRestoredAgeLabel(null)
  }

  function addBatchTables() {
    const count = parseInt(batchCount, 10)
    const price = paymentsEnabled ? parseInt(tablePrice, 10) : 0
    if (!batchPrefix || !count || count < 1 || count > 50) return
    if (paymentsEnabled && !price) return
    const startNum = tables.newTables.length + 1
    tables.addBatch(
      Array.from({ length: count }, (_, i) => ({
        label: `${batchPrefix} ${startNum + i}`,
        description: tableDesc,
        priceSek: price || 0,
        sizeDescription: tableSize,
      })),
    )
    setBatchCount('')
    setTablePrice('')
    setTableSize('')
    setTableDesc('')
  }

  async function handleSubmit() {
    if (!user) return
    const result = await submit()
    if (result.ok) {
      posthog?.capture('market_created', {
        market_id: result.marketId,
        is_permanent: fields.isPermanent,
        table_count: tables.newTables.length,
        has_images: images.newFiles.length > 0,
        auto_accept: fields.autoAcceptBookings,
      })
      clearDraft(DRAFT_KEY)
      router.push(`/fleamarkets/${result.marketId}`)
    }
  }

  if (authLoading) {
    return (
      <div className="flex justify-center py-20">
        <FyndstigenLogo size={40} className="text-rust animate-bob" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <FyndstigenLogo size={48} className="text-espresso/15 mx-auto mb-4" />
        <h1 className="font-display text-xl font-bold">Logga in först</h1>
        <p className="text-sm text-espresso/65 mt-2">
          Du behöver ett konto för att skapa en loppis.
        </p>
        <Link
          href="/auth"
          className="inline-block mt-5 bg-rust text-white px-6 py-2.5 rounded-full text-sm font-semibold"
        >
          Logga in
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <Link
        href="/profile"
        className="inline-flex items-center gap-1.5 text-sm text-espresso/60 hover:text-espresso transition-colors mb-6"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M9 3L5 7L9 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Tillbaka
      </Link>

      <h1 className="font-display text-2xl font-bold">Skapa ny loppis</h1>
      <p className="text-sm text-espresso/65 mt-1 mb-8">
        Steg {step} av 2 &mdash;{' '}
        {step === 1 ? 'Information' : 'Lägg till bord'}
      </p>

      {restoredAgeLabel && (
        <div className="flex items-start justify-between gap-3 bg-forest/8 border border-forest/20 rounded-xl px-4 py-3 mb-6 animate-fade-up">
          <div className="text-sm text-espresso/75">
            Fortsätter där du slutade — utkast sparat {restoredAgeLabel}.
            <span className="block text-xs text-espresso/55 mt-0.5">Obs: bilder måste väljas på nytt.</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" onClick={() => setRestoredAgeLabel(null)} className="text-xs font-semibold text-forest hover:text-forest-light transition-colors px-2">
              Stäng
            </button>
            <button type="button" onClick={discardDraft} className="text-xs font-semibold text-espresso/55 hover:text-espresso transition-colors px-2">
              Börja om
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-8">
        <div className={`h-1 flex-1 rounded-full ${step >= 1 ? 'bg-rust' : 'bg-cream-warm'}`} />
        <div className={`h-1 flex-1 rounded-full ${step >= 2 ? 'bg-rust' : 'bg-cream-warm'}`} />
      </div>

      {step === 1 && (
        <div className="space-y-5 animate-fade-up">
          <MarketBasicInfoSection
            name={fields.name}
            setName={fields.setName}
            description={fields.description}
            setDescription={fields.setDescription}
            address={fields.address}
            setAddress={fields.setAddress}
            isPermanent={fields.isPermanent}
            setIsPermanent={fields.setIsPermanent}
            showPlaceholders
          />
          <div>
            <label className="text-sm font-semibold text-espresso/70 block mb-1.5">Öppettider</label>
            <OpeningHoursSection
              rules={openingHours.rules}
              setRules={openingHours.setRules}
              exceptions={openingHours.exceptions}
              setExceptions={openingHours.setExceptions}
              variant="bare"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-espresso/70 block mb-1.5">Bilder (max 6)</label>
            {images.newPreviews.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                {images.newPreviews.map((src, i) => (
                  <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-cream-warm group">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => images.removeNew(i)}
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-espresso/60 text-parchment flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
                        <path d="M4 4L10 10M10 4L4 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
            {images.newFiles.length < 6 && (
              <label className="flex items-center justify-center h-20 rounded-xl border-2 border-dashed border-cream-warm hover:border-rust/30 transition-colors cursor-pointer">
                <div className="text-center">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="mx-auto text-espresso/25 mb-1">
                    <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <span className="text-xs text-espresso/35">Välj bilder</span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? [])
                    e.target.value = ''
                    images.addFiles(files)
                  }}
                  className="hidden"
                />
              </label>
            )}
          </div>
          <button
            onClick={() => setStep(2)}
            disabled={!fields.isValid}
            className="w-full h-12 rounded-xl bg-rust text-white font-semibold text-sm hover:bg-rust-light transition-colors disabled:opacity-40 shadow-sm mt-2"
          >
            Nästa &mdash; Lägg till bord
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="animate-fade-up">
          {tables.newTables.length > 0 && (
            <div className="space-y-2 mb-6">
              {tables.newTables.map((t, i) => (
                <div key={i} className="flex items-center justify-between bg-parchment rounded-xl p-4">
                  <div>
                    <p className="font-medium text-sm">{t.label}</p>
                    <p className="text-xs text-espresso/60 mt-0.5">
                      {t.sizeDescription}{t.description && ` — ${t.description}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-display font-bold text-rust text-sm">
                      {t.priceSek > 0 ? `${t.priceSek} kr` : 'Gratis'}
                    </span>
                    <button onClick={() => tables.removeNew(i)} className="text-espresso/20 hover:text-error transition-colors">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M4 4L10 10M10 4L4 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="vintage-card p-5 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-bold text-sm">Lägg till bord</h3>
              <button onClick={() => setBatchMode(!batchMode)} className="text-xs font-semibold text-rust hover:text-rust-light transition-colors">
                {batchMode ? 'Enskilt bord' : 'Lägg till flera'}
              </button>
            </div>

            {batchMode ? (
              <div className="space-y-3">
                <div className={`grid gap-3 ${paymentsEnabled ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  <input type="text" value={batchPrefix} onChange={(e) => setBatchPrefix(e.target.value)} placeholder="Prefix, t.ex. Bord" className="h-10 rounded-lg bg-parchment px-3 text-sm border border-cream-warm outline-none focus:border-rust/40 transition-all placeholder:text-espresso/25" />
                  <input type="number" value={batchCount} onChange={(e) => setBatchCount(e.target.value)} placeholder="Antal" min="1" max="50" className="h-10 rounded-lg bg-parchment px-3 text-sm border border-cream-warm outline-none focus:border-rust/40 transition-all placeholder:text-espresso/25" />
                  {paymentsEnabled && (
                    <input type="number" value={tablePrice} onChange={(e) => setTablePrice(e.target.value)} placeholder="Pris/st (kr)" className="h-10 rounded-lg bg-parchment px-3 text-sm border border-cream-warm outline-none focus:border-rust/40 transition-all placeholder:text-espresso/25" />
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" value={tableSize} onChange={(e) => setTableSize(e.target.value)} placeholder="Storlek, t.ex. 2x1 meter" className="h-10 rounded-lg bg-parchment px-3 text-sm border border-cream-warm outline-none focus:border-rust/40 transition-all placeholder:text-espresso/25" />
                  <input type="text" value={tableDesc} onChange={(e) => setTableDesc(e.target.value)} placeholder="Beskrivning (valfri)" className="h-10 rounded-lg bg-parchment px-3 text-sm border border-cream-warm outline-none focus:border-rust/40 transition-all placeholder:text-espresso/25" />
                </div>
                <button
                  onClick={addBatchTables}
                  disabled={!batchPrefix || !batchCount || (paymentsEnabled && !tablePrice)}
                  className="w-full h-9 rounded-lg bg-cream-warm text-sm font-semibold text-espresso/60 hover:bg-espresso/8 transition-colors disabled:opacity-30"
                >
                  + Lägg till {batchCount || '...'} bord
                </button>
              </div>
            ) : (
              <MarketTableAddForm
                onAdd={(table) => tables.addBatch([table])}
                showPrice={paymentsEnabled}
              />
            )}
          </div>

          <p className="text-xs text-espresso/30 text-center mb-4">
            Du kan hoppa över bord och lägga till dem senare.
          </p>

          {status.error && (
            <div className="text-sm text-error bg-error/8 border border-error/15 rounded-xl px-4 py-3 mb-4">
              {status.error}
            </div>
          )}

          <div className="flex items-center justify-between p-4 bg-cream-warm/50 rounded-xl mb-4">
            <div>
              <p className="text-sm font-semibold text-espresso">Godkänn bokningar automatiskt</p>
              <p className="text-xs text-espresso/60 mt-0.5">Bokningar bekräftas direkt utan din godkännande</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={fields.autoAcceptBookings}
              onClick={() => fields.setAutoAcceptBookings(!fields.autoAcceptBookings)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${fields.autoAcceptBookings ? 'bg-rust' : 'bg-espresso/20'}`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${fields.autoAcceptBookings ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {!stripeLoading && !stripeReady && needsStripe && (
            <div className="bg-mustard/10 border border-mustard/20 rounded-xl px-4 py-3 text-sm text-mustard mb-4">
              <Link href="/profile" className="underline font-semibold">Koppla betalning</Link>{' '}
              för att ta betalt för bord.
            </div>
          )}

          {status.progress === 'images' && status.imageStatuses.length > 0 && (
            <ImageUploadList statuses={status.imageStatuses} />
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="flex-1 h-12 rounded-xl bg-cream-warm text-sm font-semibold text-espresso/60 hover:bg-espresso/8 transition-colors">
              Tillbaka
            </button>
            <button
              onClick={handleSubmit}
              disabled={status.isSubmitting || (needsStripe && !stripeReady)}
              className="flex-1 h-12 rounded-xl bg-rust text-white font-semibold text-sm hover:bg-rust-light transition-colors disabled:opacity-50 shadow-sm"
            >
              {status.isSubmitting
                ? status.progress === 'geocoding' ? 'Söker adress...'
                : status.progress === 'creating' ? 'Skapar loppis...'
                : status.progress === 'tables' ? 'Skapar bord...'
                : status.progress === 'images' ? `Laddar upp bilder (${status.imageStatuses.filter((s) => s.state === 'done').length}/${status.imageStatuses.length})...`
                : status.progress === 'publishing' ? 'Publicerar...'
                : 'Skapar...'
                : 'Publicera loppis'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
