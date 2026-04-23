'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { api } from '@/lib/api'
import type { FleaMarketDetails, MarketTable } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import { FyndstigenLogo } from '@/components/fyndstigen-logo'
import { OpeningHoursEditor } from '@/components/opening-hours-editor'
import { ImageUploadList } from '@/components/image-upload-list'
import { useMarketForm } from '@/hooks/market-form'

const AddressPicker = dynamic(() => import('@/components/address-picker'), { ssr: false })

export default function EditMarketPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [publishedAt, setPublishedAt] = useState<string | null>(null)
  const [initial, setInitial] = useState<(FleaMarketDetails & { market_tables?: MarketTable[] }) | undefined>()

  const form = useMarketForm({ mode: 'edit', initial })
  const { fields, openingHours, images, tables, submit, status, clearError, clearSuccess } = form

  useEffect(() => {
    if (!id) return
    loadMarket()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function loadMarket() {
    try {
      const [market, marketTables] = await Promise.all([
        api.fleaMarkets.details(id),
        api.marketTables.list(id),
      ])
      if (market.organizer_id !== user?.id) {
        router.replace(`/fleamarkets/${id}`)
        return
      }
      const full = { ...market, market_tables: marketTables }
      setPublishedAt(market.published_at ?? null)
      setInitial(full)
    } catch {
      // error shown via form.status.error
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit() {
    const result = await submit()
    if (result.ok) {
      // Reload to get fresh DB state
      setLoading(true)
      images.resetNew()
      tables.resetNew()
      await loadMarket()
    }
  }

  async function handlePublish() {
    if (!user) return
    setPublishing(true)
    clearError()
    try {
      await api.fleaMarkets.publish(id)
      router.push(`/fleamarkets/${id}`)
    } catch (err) {
      // Surface publish errors via local state — status.error is for form submit
    } finally {
      setPublishing(false)
    }
  }

  if (authLoading || loading) {
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
          Du behöver vara inloggad för att redigera en loppis.
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

  const totalImageCount = images.totalCount

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <Link
        href={`/fleamarkets/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-espresso/60 hover:text-espresso transition-colors mb-6"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M9 3L5 7L9 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Tillbaka till loppisen
      </Link>

      <h1 className="font-display text-2xl font-bold">Redigera loppis</h1>
      <p className="text-sm text-espresso/65 mt-1 mb-8">
        Uppdatera information, bilder, öppettider och bord.
      </p>

      {status.success && (
        <div className="bg-forest/10 text-forest rounded-xl px-4 py-3 text-sm font-medium mb-6 animate-fade-in">
          {status.success}
        </div>
      )}
      {status.error && (
        <div className="text-sm text-error bg-error/8 border border-error/15 rounded-xl px-4 py-3 mb-6">
          {status.error}
        </div>
      )}

      <div className="space-y-8">
        {/* === SECTION: Basic Info === */}
        <section className="vintage-card p-6 animate-fade-up">
          <h2 className="font-display font-bold text-lg mb-4">Information</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-espresso/70 block mb-1.5">Namn *</label>
              <input
                type="text"
                value={fields.name}
                onChange={(e) => fields.setName(e.target.value)}
                className="w-full h-11 rounded-xl bg-parchment px-4 text-sm border border-cream-warm outline-none focus:border-rust/40 transition-all"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-espresso/70 block mb-1.5">Beskrivning</label>
              <textarea
                value={fields.description}
                onChange={(e) => fields.setDescription(e.target.value)}
                rows={3}
                className="w-full rounded-xl bg-parchment px-4 py-3 text-sm border border-cream-warm outline-none focus:border-rust/40 transition-all resize-none"
              />
            </div>
            <AddressPicker value={fields.address} onChange={fields.setAddress} inputBg="bg-parchment" />
            <div>
              <label className="text-sm font-semibold text-espresso/70 block mb-1.5">Typ</label>
              <div className="flex gap-1 bg-cream-warm rounded-xl p-1">
                <button
                  onClick={() => fields.setIsPermanent(true)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${fields.isPermanent ? 'bg-card text-espresso shadow-sm' : 'text-espresso/60'}`}
                >
                  Permanent
                </button>
                <button
                  onClick={() => fields.setIsPermanent(false)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${!fields.isPermanent ? 'bg-card text-espresso shadow-sm' : 'text-espresso/60'}`}
                >
                  Tillfällig
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* === SECTION: Opening Hours === */}
        <section id="opening-hours" className="vintage-card p-6 animate-fade-up delay-1 scroll-mt-20">
          <h2 className="font-display font-bold text-lg mb-4">Öppettider</h2>
          <OpeningHoursEditor
            rules={openingHours.rules}
            setRules={openingHours.setRules}
            exceptions={openingHours.exceptions}
            setExceptions={openingHours.setExceptions}
          />
        </section>

        {/* === SECTION: Images === */}
        <section className="vintage-card p-6 animate-fade-up delay-2">
          <h2 className="font-display font-bold text-lg mb-4">
            Bilder
            <span className="text-sm font-normal text-espresso/60 ml-2">({totalImageCount}/6)</span>
          </h2>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {images.existingImages.map((img) => {
              const isDeleted = img._deleted
              return (
                <div
                  key={img.id}
                  className={`relative aspect-square rounded-lg overflow-hidden bg-cream-warm group ${isDeleted ? 'opacity-30' : ''}`}
                >
                  <img src={api.images.publicUrl(img.storage_path)} alt="" className="w-full h-full object-cover" />
                  {isDeleted ? (
                    <button
                      type="button"
                      onClick={() => images.undoRemoveExisting(img.id)}
                      className="absolute inset-0 flex items-center justify-center bg-espresso/40 text-parchment text-xs font-semibold"
                    >
                      Ångra
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => images.removeExisting(img.id)}
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-espresso/60 text-parchment flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
                        <path d="M4 4L10 10M10 4L4 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </button>
                  )}
                </div>
              )
            })}
            {images.newPreviews.map((src, i) => (
              <div key={`new-${i}`} className="relative aspect-square rounded-lg overflow-hidden bg-cream-warm group">
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
          {totalImageCount < 6 && (
            <label className="flex items-center justify-center h-20 rounded-xl border-2 border-dashed border-cream-warm hover:border-rust/30 transition-colors cursor-pointer">
              <div className="text-center">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="mx-auto text-espresso/25 mb-1">
                  <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <span className="text-xs text-espresso/35">Lägg till bilder</span>
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
        </section>

        {/* === SECTION: Tables === */}
        <section className="vintage-card p-6 animate-fade-up delay-3">
          <h2 className="font-display font-bold text-lg mb-4">Bord</h2>
          <TableSection tables={tables} />
        </section>

        {/* === Publish (drafts only) === */}
        {!publishedAt && (
          <section className="rounded-xl border border-mustard/30 bg-mustard/5 p-5 space-y-3">
            <div>
              <h3 className="font-display font-bold text-espresso text-lg">Redo att publicera?</h3>
              <p className="text-sm text-espresso/65 mt-1">
                Din loppis är ett utkast och syns bara för dig. Publicera för att den ska synas för besökare.
              </p>
            </div>
            <button
              onClick={handlePublish}
              disabled={publishing || status.isSubmitting || !fields.isValid}
              className="w-full h-11 rounded-xl bg-forest text-white font-semibold text-sm hover:bg-forest/90 transition-colors disabled:opacity-40 shadow-sm"
            >
              {publishing ? 'Publicerar...' : 'Publicera loppisen'}
            </button>
          </section>
        )}

        {status.isSubmitting && status.imageStatuses.length > 0 && (
          <ImageUploadList statuses={status.imageStatuses} />
        )}

        <div className="flex gap-3 pt-2">
          <Link
            href={`/fleamarkets/${id}`}
            className="flex-1 h-12 rounded-xl bg-cream-warm text-sm font-semibold text-espresso/60 hover:bg-espresso/8 transition-colors flex items-center justify-center"
          >
            Avbryt
          </Link>
          <button
            onClick={handleSubmit}
            disabled={status.isSubmitting || publishing || !fields.isValid}
            className="flex-1 h-12 rounded-xl bg-rust text-white font-semibold text-sm hover:bg-rust-light transition-colors disabled:opacity-40 shadow-sm"
          >
            {status.isSubmitting && status.imageStatuses.some((s) => s.state === 'uploading' || s.state === 'pending')
              ? `Laddar upp bilder (${status.imageStatuses.filter((s) => s.state === 'done').length}/${status.imageStatuses.length})...`
              : status.isSubmitting
                ? 'Sparar...'
                : 'Spara ändringar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- Sub-component: table section ----
import type { TableDraftResult } from '@/hooks/market-form'

function TableSection({ tables }: { tables: TableDraftResult }) {
  const [tableLabel, setTableLabel] = useState('')
  const [tableDesc, setTableDesc] = useState('')
  const [tablePrice, setTablePrice] = useState('')
  const [tableSize, setTableSize] = useState('')

  function addTable() {
    if (!tableLabel || !tablePrice) return
    tables.addBatch([{
      label: tableLabel,
      description: tableDesc,
      priceSek: parseInt(tablePrice, 10) || 0,
      sizeDescription: tableSize,
    }])
    setTableLabel('')
    setTableDesc('')
    setTablePrice('')
    setTableSize('')
  }

  return (
    <>
      {tables.existingTables.length > 0 && (
        <div className="space-y-2 mb-4">
          {tables.existingTables.map((t) => (
            <div
              key={t.id}
              className={`flex items-center justify-between bg-parchment rounded-xl p-4 ${t._deleted ? 'opacity-30' : ''}`}
            >
              <div>
                <p className="font-medium text-sm">{t.label}</p>
                <p className="text-xs text-espresso/60 mt-0.5">
                  {t.sizeDescription}{t.description && ` — ${t.description}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-display font-bold text-rust text-sm">{t.priceSek} kr</span>
                {t._deleted ? (
                  <button onClick={() => tables.undoDelete(t.id!)} className="text-xs font-semibold text-rust hover:text-rust-light transition-colors">
                    Ångra
                  </button>
                ) : (
                  <button onClick={() => tables.markDeleted(t.id!)} className="text-espresso/20 hover:text-error transition-colors">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M4 4L10 10M10 4L4 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tables.newTables.length > 0 && (
        <div className="space-y-2 mb-4">
          <p className="text-xs font-semibold text-espresso/60 uppercase tracking-wide">
            Nya bord (sparas vid uppdatering)
          </p>
          {tables.newTables.map((t, i) => (
            <div key={`new-${i}`} className="flex items-center justify-between bg-forest/5 rounded-xl p-4 border border-forest/10">
              <div>
                <p className="font-medium text-sm">{t.label}</p>
                <p className="text-xs text-espresso/60 mt-0.5">
                  {t.sizeDescription}{t.description && ` — ${t.description}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-display font-bold text-rust text-sm">{t.priceSek} kr</span>
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

      <div className="bg-parchment rounded-xl p-4 space-y-3">
        <p className="text-xs font-semibold text-espresso/60">Lägg till nytt bord</p>
        <div className="grid grid-cols-2 gap-3">
          <input type="text" value={tableLabel} onChange={(e) => setTableLabel(e.target.value)} placeholder="Namn, t.ex. Bord 1" className="h-10 rounded-lg bg-card px-3 text-sm border border-cream-warm outline-none focus:border-rust/40 transition-all placeholder:text-espresso/25" />
          <input type="number" value={tablePrice} onChange={(e) => setTablePrice(e.target.value)} placeholder="Pris (kr)" className="h-10 rounded-lg bg-card px-3 text-sm border border-cream-warm outline-none focus:border-rust/40 transition-all placeholder:text-espresso/25" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input type="text" value={tableSize} onChange={(e) => setTableSize(e.target.value)} placeholder="Storlek, t.ex. 2x1 meter" className="h-10 rounded-lg bg-card px-3 text-sm border border-cream-warm outline-none focus:border-rust/40 transition-all placeholder:text-espresso/25" />
          <input type="text" value={tableDesc} onChange={(e) => setTableDesc(e.target.value)} placeholder="Beskrivning" className="h-10 rounded-lg bg-card px-3 text-sm border border-cream-warm outline-none focus:border-rust/40 transition-all placeholder:text-espresso/25" />
        </div>
        <button
          onClick={addTable}
          disabled={!tableLabel || !tablePrice}
          className="w-full h-9 rounded-lg bg-cream-warm text-sm font-semibold text-espresso/60 hover:bg-espresso/8 transition-colors disabled:opacity-30"
        >
          + Lägg till
        </button>
      </div>
    </>
  )
}
