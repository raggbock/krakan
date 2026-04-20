'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { api, geo } from '@/lib/api'
import type { FleaMarketDetails, FleaMarketImage, MarketTable } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import { FyndstigenLogo } from '@/components/fyndstigen-logo'
import { OpeningHoursEditor } from '@/components/opening-hours-editor'
import type { RuleDraft, ExceptionDraft } from '@/hooks/use-create-market'
import type { AddressValue } from '@/components/address-picker'

const AddressPicker = dynamic(() => import('@/components/address-picker'), { ssr: false })

type TableDraft = {
  id?: string
  label: string
  description: string
  priceSek: number
  sizeDescription: string
}

export default function EditMarketPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Market info
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [address, setAddress] = useState<AddressValue>({
    street: '',
    zipCode: '',
    city: '',
    latitude: null,
    longitude: null,
  })
  const [isPermanent, setIsPermanent] = useState(true)

  // Opening hours — rule-based
  const [rules, setRules] = useState<RuleDraft[]>([])
  const [exceptions, setExceptions] = useState<ExceptionDraft[]>([])
  // Images
  const [existingImages, setExistingImages] = useState<FleaMarketImage[]>([])
  const [newImages, setNewImages] = useState<File[]>([])
  const [newImagePreviews, setNewImagePreviews] = useState<string[]>([])

  // Tables
  const [existingTables, setExistingTables] = useState<MarketTable[]>([])
  const [newTables, setNewTables] = useState<TableDraft[]>([])
  const [tableLabel, setTableLabel] = useState('')
  const [tableDesc, setTableDesc] = useState('')
  const [tablePrice, setTablePrice] = useState('')
  const [tableSize, setTableSize] = useState('')

  // Track which existing tables to delete
  const [deletedTableIds, setDeletedTableIds] = useState<string[]>([])
  const [deletedImageIds, setDeletedImageIds] = useState<{ id: string; path: string }[]>([])

  useEffect(() => {
    if (!id) return
    loadMarket()
  }, [id])

  async function loadMarket() {
    try {
      const [market, tables] = await Promise.all([
        api.fleaMarkets.details(id),
        api.marketTables.list(id),
      ])

      // Verify current user is the organizer
      if (market.organizer_id !== user?.id) {
        router.replace(`/fleamarkets/${id}`)
        return
      }

      setName(market.name)
      setDescription(market.description ?? '')
      setAddress({
        street: market.street,
        zipCode: market.zip_code ?? '',
        city: market.city,
        latitude: market.latitude ?? null,
        longitude: market.longitude ?? null,
      })
      setIsPermanent(market.is_permanent)

      if (market.opening_hour_rules?.length) {
        setRules(
          market.opening_hour_rules.map((r) => ({
            type: r.type as 'weekly' | 'biweekly' | 'date',
            dayOfWeek: r.day_of_week,
            anchorDate: r.anchor_date,
            openTime: r.open_time,
            closeTime: r.close_time,
          })),
        )
      }
      if (market.opening_hour_exceptions?.length) {
        setExceptions(
          market.opening_hour_exceptions.map((ex) => ({
            date: ex.date,
            reason: ex.reason,
          })),
        )
      }

      if (market.flea_market_images?.length) {
        setExistingImages(
          [...market.flea_market_images].sort((a, b) => a.sort_order - b.sort_order),
        )
      }

      setExistingTables(tables)
    } catch {
      setError('Kunde inte ladda loppisen.')
    } finally {
      setLoading(false)
    }
  }

  // --- Images ---
  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    const totalImages = existingImages.length - deletedImageIds.length + newImages.length
    const remaining = 6 - totalImages
    const toAdd = files.slice(0, remaining)
    if (toAdd.length === 0) return
    const combined = [...newImages, ...toAdd]
    newImagePreviews.forEach(URL.revokeObjectURL)
    setNewImages(combined)
    setNewImagePreviews(combined.map((f) => URL.createObjectURL(f)))
    e.target.value = ''
  }

  function removeExistingImage(img: FleaMarketImage) {
    setDeletedImageIds((prev) => [...prev, { id: img.id, path: img.storage_path }])
  }

  function undoRemoveImage(imgId: string) {
    setDeletedImageIds((prev) => prev.filter((d) => d.id !== imgId))
  }

  function removeNewImage(idx: number) {
    URL.revokeObjectURL(newImagePreviews[idx])
    const next = newImages.filter((_, i) => i !== idx)
    setNewImages(next)
    setNewImagePreviews(next.map((f) => URL.createObjectURL(f)))
  }

  // --- Tables ---
  function addTable() {
    if (!tableLabel || !tablePrice) return
    setNewTables((prev) => [
      ...prev,
      {
        label: tableLabel,
        description: tableDesc,
        priceSek: parseInt(tablePrice, 10) || 0,
        sizeDescription: tableSize,
      },
    ])
    setTableLabel('')
    setTableDesc('')
    setTablePrice('')
    setTableSize('')
  }

  function markTableDeleted(tableId: string) {
    setDeletedTableIds((prev) => [...prev, tableId])
  }

  function undoDeleteTable(tableId: string) {
    setDeletedTableIds((prev) => prev.filter((id) => id !== tableId))
  }

  function removeNewTable(idx: number) {
    setNewTables((prev) => prev.filter((_, i) => i !== idx))
  }

  // --- Submit ---
  async function handleSubmit() {
    if (!user || !name.trim() || !address.street.trim() || !address.city.trim()) return
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      // Use map coordinates if available, otherwise geocode
      let latitude: number
      let longitude: number
      if (address.latitude && address.longitude) {
        latitude = address.latitude
        longitude = address.longitude
      } else {
        const coords = await geo.geocode(`${address.street.trim()}, ${address.zipCode.trim()} ${address.city.trim()}, Sweden`)
        latitude = coords.lat
        longitude = coords.lng
      }

      // Update market
      await api.fleaMarkets.update(id, {
        name: name.trim(),
        description: description.trim(),
        address: {
          street: address.street.trim(),
          zipCode: address.zipCode.trim(),
          city: address.city.trim(),
          country: 'Sweden',
          location: { latitude, longitude },
        },
        isPermanent,
        openingHours: rules,
        openingHourExceptions: exceptions,
      })

      // Delete removed images
      for (const img of deletedImageIds) {
        await api.images.delete(img.id, img.path)
      }

      // Upload new images
      for (const file of newImages) {
        await api.images.upload(id, file)
      }

      // Delete removed tables
      for (const tableId of deletedTableIds) {
        await api.marketTables.delete(tableId)
      }

      // Create new tables
      for (const table of newTables) {
        await api.marketTables.create({
          fleaMarketId: id,
          label: table.label,
          description: table.description || undefined,
          priceSek: table.priceSek,
          sizeDescription: table.sizeDescription || undefined,
        })
      }

      setSuccess('Loppisen har uppdaterats!')
      setDeletedImageIds([])
      setDeletedTableIds([])
      setNewImages([])
      newImagePreviews.forEach(URL.revokeObjectURL)
      setNewImagePreviews([])
      setNewTables([])

      // Reload to get fresh data
      setLoading(true)
      await loadMarket()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Något gick fel')
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

  const totalImageCount =
    existingImages.length - deletedImageIds.length + newImages.length

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

      {/* Success / Error banners */}
      {success && (
        <div className="bg-forest/10 text-forest rounded-xl px-4 py-3 text-sm font-medium mb-6 animate-fade-in">
          {success}
        </div>
      )}
      {error && (
        <div className="text-sm text-error bg-error/8 border border-error/15 rounded-xl px-4 py-3 mb-6">
          {error}
        </div>
      )}

      <div className="space-y-8">
        {/* === SECTION: Basic Info === */}
        <section className="vintage-card p-6 animate-fade-up">
          <h2 className="font-display font-bold text-lg mb-4">Information</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-espresso/70 block mb-1.5">
                Namn *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-11 rounded-xl bg-parchment px-4 text-sm border border-cream-warm outline-none focus:border-rust/40 transition-all"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-espresso/70 block mb-1.5">
                Beskrivning
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full rounded-xl bg-parchment px-4 py-3 text-sm border border-cream-warm outline-none focus:border-rust/40 transition-all resize-none"
              />
            </div>

            <AddressPicker value={address} onChange={setAddress} inputBg="bg-parchment" />

            <div>
              <label className="text-sm font-semibold text-espresso/70 block mb-1.5">
                Typ
              </label>
              <div className="flex gap-1 bg-cream-warm rounded-xl p-1">
                <button
                  onClick={() => setIsPermanent(true)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    isPermanent ? 'bg-card text-espresso shadow-sm' : 'text-espresso/60'
                  }`}
                >
                  Permanent
                </button>
                <button
                  onClick={() => setIsPermanent(false)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    !isPermanent ? 'bg-card text-espresso shadow-sm' : 'text-espresso/60'
                  }`}
                >
                  Tillfällig
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* === SECTION: Opening Hours === */}
        <section className="vintage-card p-6 animate-fade-up delay-1">
          <h2 className="font-display font-bold text-lg mb-4">Öppettider</h2>
          <OpeningHoursEditor rules={rules} setRules={setRules} exceptions={exceptions} setExceptions={setExceptions} />
        </section>

        {/* === SECTION: Images === */}
        <section className="vintage-card p-6 animate-fade-up delay-2">
          <h2 className="font-display font-bold text-lg mb-4">
            Bilder
            <span className="text-sm font-normal text-espresso/60 ml-2">
              ({totalImageCount}/6)
            </span>
          </h2>

          <div className="grid grid-cols-3 gap-2 mb-3">
            {/* Existing images */}
            {existingImages.map((img) => {
              const isDeleted = deletedImageIds.some((d) => d.id === img.id)
              return (
                <div
                  key={img.id}
                  className={`relative aspect-square rounded-lg overflow-hidden bg-cream-warm group ${
                    isDeleted ? 'opacity-30' : ''
                  }`}
                >
                  <img
                    src={api.images.getPublicUrl(img.storage_path)}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  {isDeleted ? (
                    <button
                      type="button"
                      onClick={() => undoRemoveImage(img.id)}
                      className="absolute inset-0 flex items-center justify-center bg-espresso/40 text-parchment text-xs font-semibold"
                    >
                      Ångra
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => removeExistingImage(img)}
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

            {/* New image previews */}
            {newImagePreviews.map((src, i) => (
              <div key={`new-${i}`} className="relative aspect-square rounded-lg overflow-hidden bg-cream-warm group">
                <img src={src} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeNewImage(i)}
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
                onChange={handleImageSelect}
                className="hidden"
              />
            </label>
          )}
        </section>

        {/* === SECTION: Tables === */}
        <section className="vintage-card p-6 animate-fade-up delay-3">
          <h2 className="font-display font-bold text-lg mb-4">Bord</h2>

          {/* Existing tables */}
          {existingTables.length > 0 && (
            <div className="space-y-2 mb-4">
              {existingTables.map((t) => {
                const isDeleted = deletedTableIds.includes(t.id)
                return (
                  <div
                    key={t.id}
                    className={`flex items-center justify-between bg-parchment rounded-xl p-4 ${
                      isDeleted ? 'opacity-30' : ''
                    }`}
                  >
                    <div>
                      <p className="font-medium text-sm">{t.label}</p>
                      <p className="text-xs text-espresso/60 mt-0.5">
                        {t.size_description}
                        {t.description && ` — ${t.description}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-display font-bold text-rust text-sm">
                        {t.price_sek} kr
                      </span>
                      {isDeleted ? (
                        <button
                          onClick={() => undoDeleteTable(t.id)}
                          className="text-xs font-semibold text-rust hover:text-rust-light transition-colors"
                        >
                          Ångra
                        </button>
                      ) : (
                        <button
                          onClick={() => markTableDeleted(t.id)}
                          className="text-espresso/20 hover:text-error transition-colors"
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M4 4L10 10M10 4L4 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* New tables (not yet saved) */}
          {newTables.length > 0 && (
            <div className="space-y-2 mb-4">
              <p className="text-xs font-semibold text-espresso/60 uppercase tracking-wide">
                Nya bord (sparas vid uppdatering)
              </p>
              {newTables.map((t, i) => (
                <div
                  key={`new-${i}`}
                  className="flex items-center justify-between bg-forest/5 rounded-xl p-4 border border-forest/10"
                >
                  <div>
                    <p className="font-medium text-sm">{t.label}</p>
                    <p className="text-xs text-espresso/60 mt-0.5">
                      {t.sizeDescription}
                      {t.description && ` — ${t.description}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-display font-bold text-rust text-sm">
                      {t.priceSek} kr
                    </span>
                    <button
                      onClick={() => removeNewTable(i)}
                      className="text-espresso/20 hover:text-error transition-colors"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M4 4L10 10M10 4L4 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add table form */}
          <div className="bg-parchment rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-espresso/60">
              Lägg till nytt bord
            </p>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                value={tableLabel}
                onChange={(e) => setTableLabel(e.target.value)}
                placeholder="Namn, t.ex. Bord 1"
                className="h-10 rounded-lg bg-card px-3 text-sm border border-cream-warm outline-none focus:border-rust/40 transition-all placeholder:text-espresso/25"
              />
              <input
                type="number"
                value={tablePrice}
                onChange={(e) => setTablePrice(e.target.value)}
                placeholder="Pris (kr)"
                className="h-10 rounded-lg bg-card px-3 text-sm border border-cream-warm outline-none focus:border-rust/40 transition-all placeholder:text-espresso/25"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                value={tableSize}
                onChange={(e) => setTableSize(e.target.value)}
                placeholder="Storlek, t.ex. 2x1 meter"
                className="h-10 rounded-lg bg-card px-3 text-sm border border-cream-warm outline-none focus:border-rust/40 transition-all placeholder:text-espresso/25"
              />
              <input
                type="text"
                value={tableDesc}
                onChange={(e) => setTableDesc(e.target.value)}
                placeholder="Beskrivning"
                className="h-10 rounded-lg bg-card px-3 text-sm border border-cream-warm outline-none focus:border-rust/40 transition-all placeholder:text-espresso/25"
              />
            </div>
            <button
              onClick={addTable}
              disabled={!tableLabel || !tablePrice}
              className="w-full h-9 rounded-lg bg-cream-warm text-sm font-semibold text-espresso/60 hover:bg-espresso/8 transition-colors disabled:opacity-30"
            >
              + Lägg till
            </button>
          </div>
        </section>

        {/* === Save button === */}
        <div className="flex gap-3 pt-2">
          <Link
            href={`/fleamarkets/${id}`}
            className="flex-1 h-12 rounded-xl bg-cream-warm text-sm font-semibold text-espresso/60 hover:bg-espresso/8 transition-colors flex items-center justify-center"
          >
            Avbryt
          </Link>
          <button
            onClick={handleSubmit}
            disabled={saving || !name.trim() || !address.street.trim() || !address.city.trim()}
            className="flex-1 h-12 rounded-xl bg-rust text-white font-semibold text-sm hover:bg-rust-light transition-colors disabled:opacity-40 shadow-sm"
          >
            {saving ? 'Sparar...' : 'Spara ändringar'}
          </button>
        </div>
      </div>
    </div>
  )
}
