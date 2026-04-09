'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { FyndstigenLogo } from '@/components/fyndstigen-logo'
import { useCreateMarket } from '@/hooks/use-create-market'

type TableDraft = {
  label: string
  description: string
  priceSek: number
  sizeDescription: string
}

export default function CreateMarketPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [step, setStep] = useState<1 | 2>(1)
  const { submit: createMarket, isSubmitting: saving, error, progress } = useCreateMarket()

  // Step 1: Market info
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [street, setStreet] = useState('')
  const [zipCode, setZipCode] = useState('')
  const [city, setCity] = useState('')
  const [isPermanent, setIsPermanent] = useState(true)
  const [images, setImages] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    const combined = [...images, ...files].slice(0, 6)
    setCombinedImages(combined)
    e.target.value = ''
  }

  function setCombinedImages(files: File[]) {
    // Clean up old preview URLs
    imagePreviews.forEach(URL.revokeObjectURL)
    setImages(files)
    setImagePreviews(files.map((f) => URL.createObjectURL(f)))
  }

  function removeImage(idx: number) {
    imagePreviews.forEach(URL.revokeObjectURL)
    const next = images.filter((_, i) => i !== idx)
    setImages(next)
    setImagePreviews(next.map((f) => URL.createObjectURL(f)))
  }

  // Step 2: Tables
  const [tables, setTables] = useState<TableDraft[]>([])
  const [tableLabel, setTableLabel] = useState('')
  const [tableDesc, setTableDesc] = useState('')
  const [tablePrice, setTablePrice] = useState('')
  const [tableSize, setTableSize] = useState('')
  const [batchMode, setBatchMode] = useState(false)
  const [batchPrefix, setBatchPrefix] = useState('Bord')
  const [batchCount, setBatchCount] = useState('')

  function addTable() {
    if (!tableLabel || !tablePrice) return
    setTables((prev) => [
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

  function removeTable(idx: number) {
    setTables((prev) => prev.filter((_, i) => i !== idx))
  }

  function addBatchTables() {
    const count = parseInt(batchCount, 10)
    const price = parseInt(tablePrice, 10)
    if (!batchPrefix || !count || !price || count < 1 || count > 50) return
    const startNum = tables.length + 1
    const newTables: TableDraft[] = Array.from({ length: count }, (_, i) => ({
      label: `${batchPrefix} ${startNum + i}`,
      description: tableDesc,
      priceSek: price,
      sizeDescription: tableSize,
    }))
    setTables((prev) => [...prev, ...newTables])
    setBatchCount('')
    setTablePrice('')
    setTableSize('')
    setTableDesc('')
  }

  async function handleSubmit() {
    if (!user || !name.trim() || !street.trim() || !city.trim()) return
    const result = await createMarket({
      name: name.trim(),
      description: description.trim(),
      street: street.trim(),
      zipCode: zipCode.trim(),
      city: city.trim(),
      isPermanent,
      organizerId: user.id,
      tables,
      images,
    })
    if (result) {
      router.push(`/fleamarkets/${result.id}`)
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

      {/* Progress bar */}
      <div className="flex gap-2 mb-8">
        <div className={`h-1 flex-1 rounded-full ${step >= 1 ? 'bg-rust' : 'bg-cream-warm'}`} />
        <div className={`h-1 flex-1 rounded-full ${step >= 2 ? 'bg-rust' : 'bg-cream-warm'}`} />
      </div>

      {step === 1 && (
        <div className="space-y-5 animate-fade-up">
          <div>
            <label className="text-sm font-semibold text-espresso/70 block mb-1.5">
              Namn *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="T.ex. Södermalms Loppis"
              className="w-full h-11 rounded-xl bg-card px-4 text-sm border border-cream-warm outline-none focus:border-rust/40 transition-all placeholder:text-espresso/25"
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
              placeholder="Berätta om din loppis..."
              className="w-full rounded-xl bg-card px-4 py-3 text-sm border border-cream-warm outline-none focus:border-rust/40 transition-all resize-none placeholder:text-espresso/25"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-espresso/70 block mb-1.5">
              Gatuadress *
            </label>
            <input
              type="text"
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              placeholder="Storgatan 1"
              className="w-full h-11 rounded-xl bg-card px-4 text-sm border border-cream-warm outline-none focus:border-rust/40 transition-all placeholder:text-espresso/25"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-espresso/70 block mb-1.5">
                Postnummer
              </label>
              <input
                type="text"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                placeholder="702 11"
                className="w-full h-11 rounded-xl bg-card px-4 text-sm border border-cream-warm outline-none focus:border-rust/40 transition-all placeholder:text-espresso/25"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-espresso/70 block mb-1.5">
                Stad *
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Örebro"
                className="w-full h-11 rounded-xl bg-card px-4 text-sm border border-cream-warm outline-none focus:border-rust/40 transition-all placeholder:text-espresso/25"
              />
            </div>
          </div>

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

          {/* Images */}
          <div>
            <label className="text-sm font-semibold text-espresso/70 block mb-1.5">
              Bilder (max 6)
            </label>
            {imagePreviews.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                {imagePreviews.map((src, i) => (
                  <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-cream-warm group">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
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
            {images.length < 6 && (
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
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </label>
            )}
          </div>

          <button
            onClick={() => setStep(2)}
            disabled={!name.trim() || !street.trim() || !city.trim()}
            className="w-full h-12 rounded-xl bg-rust text-white font-semibold text-sm hover:bg-rust-light transition-colors disabled:opacity-40 shadow-sm mt-2"
          >
            Nästa &mdash; Lägg till bord
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="animate-fade-up">
          {/* Added tables */}
          {tables.length > 0 && (
            <div className="space-y-2 mb-6">
              {tables.map((t, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between bg-parchment rounded-xl p-4"
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
                      onClick={() => removeTable(i)}
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

          {/* Add table form — single or batch */}
          <div className="vintage-card p-5 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-bold text-sm">
                Lägg till bord
              </h3>
              <button
                onClick={() => setBatchMode(!batchMode)}
                className="text-xs font-semibold text-rust hover:text-rust-light transition-colors"
              >
                {batchMode ? 'Enskilt bord' : 'Lägg till flera'}
              </button>
            </div>

            {batchMode ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <input
                    type="text"
                    value={batchPrefix}
                    onChange={(e) => setBatchPrefix(e.target.value)}
                    placeholder="Prefix, t.ex. Bord"
                    className="h-10 rounded-lg bg-parchment px-3 text-sm border border-cream-warm outline-none focus:border-rust/40 transition-all placeholder:text-espresso/25"
                  />
                  <input
                    type="number"
                    value={batchCount}
                    onChange={(e) => setBatchCount(e.target.value)}
                    placeholder="Antal"
                    min="1"
                    max="50"
                    className="h-10 rounded-lg bg-parchment px-3 text-sm border border-cream-warm outline-none focus:border-rust/40 transition-all placeholder:text-espresso/25"
                  />
                  <input
                    type="number"
                    value={tablePrice}
                    onChange={(e) => setTablePrice(e.target.value)}
                    placeholder="Pris/st (kr)"
                    className="h-10 rounded-lg bg-parchment px-3 text-sm border border-cream-warm outline-none focus:border-rust/40 transition-all placeholder:text-espresso/25"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={tableSize}
                    onChange={(e) => setTableSize(e.target.value)}
                    placeholder="Storlek, t.ex. 2x1 meter"
                    className="h-10 rounded-lg bg-parchment px-3 text-sm border border-cream-warm outline-none focus:border-rust/40 transition-all placeholder:text-espresso/25"
                  />
                  <input
                    type="text"
                    value={tableDesc}
                    onChange={(e) => setTableDesc(e.target.value)}
                    placeholder="Beskrivning (valfri)"
                    className="h-10 rounded-lg bg-parchment px-3 text-sm border border-cream-warm outline-none focus:border-rust/40 transition-all placeholder:text-espresso/25"
                  />
                </div>
                <button
                  onClick={addBatchTables}
                  disabled={!batchPrefix || !batchCount || !tablePrice}
                  className="w-full h-9 rounded-lg bg-cream-warm text-sm font-semibold text-espresso/60 hover:bg-espresso/8 transition-colors disabled:opacity-30"
                >
                  + Lägg till {batchCount || '...'} bord
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={tableLabel}
                    onChange={(e) => setTableLabel(e.target.value)}
                    placeholder="Namn, t.ex. Bord 1"
                    className="h-10 rounded-lg bg-parchment px-3 text-sm border border-cream-warm outline-none focus:border-rust/40 transition-all placeholder:text-espresso/25"
                  />
                  <input
                    type="number"
                    value={tablePrice}
                    onChange={(e) => setTablePrice(e.target.value)}
                    placeholder="Pris (kr)"
                    className="h-10 rounded-lg bg-parchment px-3 text-sm border border-cream-warm outline-none focus:border-rust/40 transition-all placeholder:text-espresso/25"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={tableSize}
                    onChange={(e) => setTableSize(e.target.value)}
                    placeholder="Storlek, t.ex. 2x1 meter"
                    className="h-10 rounded-lg bg-parchment px-3 text-sm border border-cream-warm outline-none focus:border-rust/40 transition-all placeholder:text-espresso/25"
                  />
                  <input
                    type="text"
                    value={tableDesc}
                    onChange={(e) => setTableDesc(e.target.value)}
                    placeholder="Beskrivning"
                    className="h-10 rounded-lg bg-parchment px-3 text-sm border border-cream-warm outline-none focus:border-rust/40 transition-all placeholder:text-espresso/25"
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
            )}
          </div>

          <p className="text-xs text-espresso/30 text-center mb-4">
            Du kan hoppa över bord och lägga till dem senare.
          </p>

          {error && (
            <div className="text-sm text-error bg-error/8 border border-error/15 rounded-xl px-4 py-3 mb-4">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="flex-1 h-12 rounded-xl bg-cream-warm text-sm font-semibold text-espresso/60 hover:bg-espresso/8 transition-colors"
            >
              Tillbaka
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 h-12 rounded-xl bg-rust text-white font-semibold text-sm hover:bg-rust-light transition-colors disabled:opacity-50 shadow-sm"
            >
              {saving
                ? progress === 'geocoding' ? 'Söker adress...'
                : progress === 'creating' ? 'Skapar loppis...'
                : progress === 'tables' ? 'Skapar bord...'
                : progress === 'images' ? 'Laddar upp bilder...'
                : progress === 'publishing' ? 'Publicerar...'
                : 'Skapar...'
                : 'Publicera loppis'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
