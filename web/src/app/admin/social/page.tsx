'use client'

import { useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import {
  WeekendTemplate,
  RouteTemplate,
  ReelCoverTemplate,
  FindTemplate,
  TEMPLATE_STYLES as s,
  type WeekendData,
  type RouteData,
  type ReelCoverData,
  type FindData,
  type WeekendItem,
} from './templates'
import { useWeekendMarkets, type WeekendMarket } from '@/hooks/use-weekend-markets'

type Tab = 'weekend' | 'route' | 'reel' | 'find'

const TAB_META: Record<Tab, { label: string; size: string }> = {
  weekend: { label: 'Helgens loppisar', size: '1080×1080' },
  route:   { label: 'Ruttplanerare',    size: '1080×1920' },
  reel:    { label: 'Reel-cover',       size: '1080×1920' },
  find:    { label: 'Dagens fynd',      size: '1080×1080' },
}

const DEFAULT_WEEKEND: WeekendData = {
  week: 'vecka 18',
  region: 'Närke',
  subhead: 'Tre favoriter, en optimerad rutt.',
  items: [
    { day: 'Tor', title: 'Lilla Grodans Loppis', meta: '11–18 · Stora Mellösa', badge: 'café' },
    { day: 'Lör', title: 'Karins Loppis', meta: '10–18 · Hallsberg', badge: '120 m²' },
    { day: 'Lör', title: 'Gåvan Secondhand', meta: '10–14 · Nora', badge: 'nyöppet' },
  ],
}

const DEFAULT_ROUTE: RouteData = {
  eyebrow: 'Slipp slingrig bilväg.',
  heroCount: 6,
  heroLine2: 'rutt.',
  body: 'Lägg till loppisarna du vill besöka. Vi räknar ut ordningen så du kör minst.',
  mapLabel: 'Lördag 3 maj · din rutt',
  stops: [
    { name: 'Lilla Grodans, Stora Mellösa', time: 'Start 10:00' },
    { name: 'Kyrkornas, Odensbacken', time: '11:00 · 12 min bilväg' },
    { name: 'Karins Loppis, Hallsberg', time: '12:15 · 25 min bilväg' },
  ],
  cta: 'Hämta appen gratis →',
}

const DEFAULT_REEL: ReelCoverData = {
  bigNum: '6',
  suffix: 'st',
  claimLine1: 'loppisar,',
  claimLine2: 'en lördag',
  sub: 'Så körde jag runt Närke →',
}

const DEFAULT_FIND: FindData = {
  title1: 'Teak',
  title2Em: 'sidobord',
  title3: 'från 60-talet',
  priceLabelLeft: 'På Blocket',
  priceLeft: '1 200',
  priceLabelRight: 'Mitt pris',
  priceRight: '80',
  currency: ' kr',
  location: 'Lilla Grodans Loppis, Stora Mellösa',
  hashtags: '#loppisfynd #secondhand',
}

export default function AdminSocialPage() {
  const [tab, setTab] = useState<Tab>('weekend')
  const [weekend, setWeekend] = useState<WeekendData>(DEFAULT_WEEKEND)
  const [route, setRoute] = useState<RouteData>(DEFAULT_ROUTE)
  const [reel, setReel] = useState<ReelCoverData>(DEFAULT_REEL)
  const [find, setFind] = useState<FindData>(DEFAULT_FIND)
  const [exporting, setExporting] = useState(false)

  const templateRef = useRef<HTMLDivElement | null>(null)

  async function exportPng() {
    if (!templateRef.current) return
    setExporting(true)
    try {
      const dataUrl = await toPng(templateRef.current, {
        pixelRatio: 1,
        cacheBust: true,
      })
      const link = document.createElement('a')
      link.download = `fyndstigen-${tab}-${Date.now()}.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      alert('Export misslyckades: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setExporting(false)
    }
  }

  const { current, wrapClass } = renderCurrent(tab, { weekend, route, reel, find, templateRef, s })

  return (
    <div className="space-y-6">
      <section>
        <h1 className="font-display text-3xl font-bold">Social</h1>
        <p className="text-espresso/65 mt-1">
          Redigera text, förhandsgranska, exportera som PNG. Ingen AI — du skriver, vi mallar.
        </p>
      </section>

      <nav className="flex flex-wrap gap-2 border-b border-cream-warm">
        {(Object.keys(TAB_META) as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${
              tab === t ? 'border-rust text-rust' : 'border-transparent text-espresso/65 hover:text-espresso'
            }`}
          >
            {TAB_META[t].label}
            <span className="ml-2 text-xs text-espresso/40 font-normal">{TAB_META[t].size}</span>
          </button>
        ))}
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          {tab === 'weekend' && <WeekendForm value={weekend} onChange={setWeekend} />}
          {tab === 'route' && <RouteForm value={route} onChange={setRoute} />}
          {tab === 'reel' && <ReelForm value={reel} onChange={setReel} />}
          {tab === 'find' && <FindForm value={find} onChange={setFind} />}

          <div className="pt-4 border-t border-cream-warm">
            <button
              onClick={exportPng}
              disabled={exporting}
              className="w-full bg-rust text-white px-4 py-3 rounded-md font-semibold disabled:opacity-50"
            >
              {exporting ? 'Exporterar…' : 'Exportera PNG'}
            </button>
          </div>
        </div>

        <div className="flex justify-center items-start">
          <div className={`${s.tmplWrap} ${wrapClass}`}>{current}</div>
        </div>
      </div>
    </div>
  )
}

function renderCurrent(
  tab: Tab,
  ctx: {
    weekend: WeekendData
    route: RouteData
    reel: ReelCoverData
    find: FindData
    templateRef: React.MutableRefObject<HTMLDivElement | null>
    s: Record<string, string>
  },
) {
  const { weekend, route, reel, find, templateRef, s } = ctx
  switch (tab) {
    case 'weekend':
      return { current: <WeekendTemplate ref={templateRef} data={weekend} />, wrapClass: s.tmplWrapFeed }
    case 'route':
      return { current: <RouteTemplate ref={templateRef} data={route} />, wrapClass: s.tmplWrapStory }
    case 'reel':
      return { current: <ReelCoverTemplate ref={templateRef} data={reel} />, wrapClass: s.tmplWrapStory }
    case 'find':
      return { current: <FindTemplate ref={templateRef} data={find} />, wrapClass: s.tmplWrapFeed }
  }
}

// ─── Forms ──────────────────────────────────────────────────────────

function WeekendForm({ value, onChange }: { value: WeekendData; onChange: (v: WeekendData) => void }) {
  const weekend = useWeekendMarkets()

  function autofill() {
    if (!weekend.data) return
    const { markets, weekNo } = weekend.data
    const dayLabel = (d: number) => d === 5 ? 'Fre' : d === 6 ? 'Lör' : 'Sön'
    const items: WeekendItem[] = markets.slice(0, 3).map((m: WeekendMarket) => ({
      day: dayLabel(m.day),
      title: m.name,
      meta: `${m.openTime}–${m.closeTime} · ${m.city ?? ''}`.trim(),
    }))
    onChange({ ...value, week: `vecka ${weekNo}`, items })
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={autofill}
        disabled={weekend.isLoading || !weekend.data || weekend.data.markets.length === 0}
        className="w-full border border-forest text-forest px-3 py-2 rounded-md text-sm font-semibold hover:bg-forest/5 disabled:opacity-50"
      >
        {weekend.isLoading
          ? 'Hämtar…'
          : weekend.data
            ? `Hämta helgens öppna butiker (${weekend.data.markets.length} st)`
            : 'Hämta helgens öppna butiker'}
      </button>

      <TextField label="Vecka" value={value.week} onChange={(v) => onChange({ ...value, week: v })} />
      <TextField label="Region" value={value.region} onChange={(v) => onChange({ ...value, region: v })} />
      <TextField label="Underrubrik" value={value.subhead} onChange={(v) => onChange({ ...value, subhead: v })} />

      <fieldset className="space-y-2 border-t border-cream-warm pt-3">
        <legend className="text-xs uppercase tracking-wide text-espresso/55">Butiker (max 3)</legend>
        {value.items.map((item, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-end">
            <TextField cols={2} label="Dag" value={item.day} onChange={(v) => onChange({ ...value, items: value.items.map((x, j) => j === i ? { ...x, day: v } : x) })} />
            <TextField cols={5} label="Namn" value={item.title} onChange={(v) => onChange({ ...value, items: value.items.map((x, j) => j === i ? { ...x, title: v } : x) })} />
            <TextField cols={3} label="Meta" value={item.meta} onChange={(v) => onChange({ ...value, items: value.items.map((x, j) => j === i ? { ...x, meta: v } : x) })} />
            <TextField cols={2} label="Badge" value={item.badge ?? ''} onChange={(v) => onChange({ ...value, items: value.items.map((x, j) => j === i ? { ...x, badge: v || undefined } : x) })} />
          </div>
        ))}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onChange({ ...value, items: [...value.items, { day: 'Lör', title: '', meta: '' }] })}
            disabled={value.items.length >= 3}
            className="text-sm text-rust hover:underline disabled:opacity-40"
          >
            + Lägg till
          </button>
          {value.items.length > 1 && (
            <button
              type="button"
              onClick={() => onChange({ ...value, items: value.items.slice(0, -1) })}
              className="text-sm text-espresso/60 hover:underline"
            >
              − Ta bort sista
            </button>
          )}
        </div>
      </fieldset>
    </div>
  )
}

function RouteForm({ value, onChange }: { value: RouteData; onChange: (v: RouteData) => void }) {
  return (
    <div className="space-y-3">
      <TextField label="Eyebrow" value={value.eyebrow} onChange={(v) => onChange({ ...value, eyebrow: v })} />
      <div className="grid grid-cols-3 gap-2">
        <TextField cols={1} label="Antal" value={String(value.heroCount)} onChange={(v) => onChange({ ...value, heroCount: Number(v) || 0 })} />
        <TextField cols={2} label='Andra raden (t.ex. "rutt.")' value={value.heroLine2} onChange={(v) => onChange({ ...value, heroLine2: v })} />
      </div>
      <TextArea label="Body" value={value.body} onChange={(v) => onChange({ ...value, body: v })} />
      <TextField label="Map-label" value={value.mapLabel} onChange={(v) => onChange({ ...value, mapLabel: v })} />

      <fieldset className="space-y-2 border-t border-cream-warm pt-3">
        <legend className="text-xs uppercase tracking-wide text-espresso/55">Stopp</legend>
        {value.stops.map((stop, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-end">
            <TextField cols={7} label={`Stopp ${i + 1}`} value={stop.name} onChange={(v) => onChange({ ...value, stops: value.stops.map((x, j) => j === i ? { ...x, name: v } : x) })} />
            <TextField cols={5} label="Tid" value={stop.time} onChange={(v) => onChange({ ...value, stops: value.stops.map((x, j) => j === i ? { ...x, time: v } : x) })} />
          </div>
        ))}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onChange({ ...value, stops: [...value.stops, { name: '', time: '' }] })}
            className="text-sm text-rust hover:underline"
          >
            + Lägg till
          </button>
          {value.stops.length > 1 && (
            <button
              type="button"
              onClick={() => onChange({ ...value, stops: value.stops.slice(0, -1) })}
              className="text-sm text-espresso/60 hover:underline"
            >
              − Ta bort sista
            </button>
          )}
        </div>
      </fieldset>

      <TextField label="CTA" value={value.cta} onChange={(v) => onChange({ ...value, cta: v })} />
    </div>
  )
}

function ReelForm({ value, onChange }: { value: ReelCoverData; onChange: (v: ReelCoverData) => void }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <TextField cols={1} label="Stor siffra" value={value.bigNum} onChange={(v) => onChange({ ...value, bigNum: v })} />
        <TextField cols={2} label="Suffix" value={value.suffix} onChange={(v) => onChange({ ...value, suffix: v })} />
      </div>
      <TextField label="Claim rad 1" value={value.claimLine1} onChange={(v) => onChange({ ...value, claimLine1: v })} />
      <TextField label="Claim rad 2" value={value.claimLine2} onChange={(v) => onChange({ ...value, claimLine2: v })} />
      <TextField label="Underrad" value={value.sub} onChange={(v) => onChange({ ...value, sub: v })} />
    </div>
  )
}

function FindForm({ value, onChange }: { value: FindData; onChange: (v: FindData) => void }) {
  return (
    <div className="space-y-3">
      <TextField label="Titel rad 1" value={value.title1} onChange={(v) => onChange({ ...value, title1: v })} />
      <TextField label="Titel rad 2 (italic)" value={value.title2Em} onChange={(v) => onChange({ ...value, title2Em: v })} />
      <TextField label="Titel rad 3" value={value.title3} onChange={(v) => onChange({ ...value, title3: v })} />

      <fieldset className="grid grid-cols-2 gap-3 border-t border-cream-warm pt-3">
        <legend className="text-xs uppercase tracking-wide text-espresso/55 col-span-2">Priser</legend>
        <TextField label="Vänster label" value={value.priceLabelLeft} onChange={(v) => onChange({ ...value, priceLabelLeft: v })} />
        <TextField label="Vänster pris" value={value.priceLeft} onChange={(v) => onChange({ ...value, priceLeft: v })} />
        <TextField label="Höger label" value={value.priceLabelRight} onChange={(v) => onChange({ ...value, priceLabelRight: v })} />
        <TextField label="Höger pris" value={value.priceRight} onChange={(v) => onChange({ ...value, priceRight: v })} />
        <TextField label="Valuta" value={value.currency} onChange={(v) => onChange({ ...value, currency: v })} />
      </fieldset>

      <TextField label="Plats" value={value.location} onChange={(v) => onChange({ ...value, location: v })} />
      <TextField label="Hashtags" value={value.hashtags} onChange={(v) => onChange({ ...value, hashtags: v })} />
    </div>
  )
}

// ─── Field helpers ──────────────────────────────────────────────────

function TextField({
  label, value, onChange, cols,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  cols?: number
}) {
  // gridColumn via inline style — Tailwind JIT can't see dynamic
  // `col-span-${n}` so the class would never be generated.
  const style = cols ? { gridColumn: `span ${cols} / span ${cols}` } : undefined
  return (
    <label className="block min-w-0" style={style}>
      <span className="text-xs uppercase tracking-wide text-espresso/55">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full px-2 py-1.5 rounded-md border border-cream-warm text-sm"
      />
    </label>
  )
}

function TextArea({
  label, value, onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-espresso/55">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="mt-1 w-full px-2 py-1.5 rounded-md border border-cream-warm text-sm"
      />
    </label>
  )
}
