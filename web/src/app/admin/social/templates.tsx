'use client'

import { forwardRef } from 'react'
import { FsLogo } from './FsLogo'
import s from './templates.module.css'

// ─── Template 1: Helgens loppisar (1080×1080) ───────────────────────

export type WeekendItem = {
  day: string        // "Tor", "Lör", "Sön"
  title: string
  meta: string       // "11–18 · Stora Mellösa"
  badge?: string     // "café", "120 m²", "nyöppet"
}

export type WeekendData = {
  week: string                // "vecka 18"
  region: string              // "Närke"
  subhead: string             // "Tre favoriter, en optimerad rutt."
  items: WeekendItem[]
}

export const WeekendTemplate = forwardRef<HTMLDivElement, { data: WeekendData }>(
  function WeekendTemplate({ data }, ref) {
    return (
      <div ref={ref} className={`${s.tmpl} ${s.feedWeekend}`}>
        <div className={s.fwHeader}>
          <div className={s.fwBrand}>
            <FsLogo />
            <span>fyndstigen</span>
          </div>
          <div className={s.fwWeek}>{data.week}</div>
        </div>
        <div className={s.fwHero}>
          Loppisar i<br /><em>{data.region}</em><br />denna helg.
        </div>
        <div className={s.fwSubhead}>{data.subhead}</div>
        <div className={s.fwList}>
          {data.items.map((item, i) => (
            <div key={i} className={s.fwItem}>
              <div className={s.fwDay}>{item.day}</div>
              <div className={s.fwItemContent}>
                <div className={s.fwItemTitle}>{item.title}</div>
                <div className={s.fwItemMeta}>{item.meta}</div>
              </div>
              {item.badge && <div className={s.fwCount}>{item.badge}</div>}
            </div>
          ))}
        </div>
        <div className={s.fwFooter}>
          <div className={s.fwCta}>Planera rutten i appen ↓</div>
          <div className={s.fwCtaDomain}>fyndstigen.se</div>
        </div>
      </div>
    )
  },
)

// ─── Template 2: Ruttplanerare story (1080×1920) ────────────────────

export type RouteStop = { name: string; time: string }
export type RouteData = {
  eyebrow: string       // "Slipp slingrig bilväg."
  heroCount: number     // 6
  heroLine2: string     // "En rutt." / "rutt."
  body: string
  mapLabel: string      // "Lördag 3 maj · din rutt"
  stops: RouteStop[]
  cta: string
}

export const RouteTemplate = forwardRef<HTMLDivElement, { data: RouteData }>(
  function RouteTemplate({ data }, ref) {
    return (
      <div ref={ref} className={`${s.tmpl} ${s.storyRoute}`}>
        <div className={s.srBrandTop}>
          <FsLogo />
          <span>fyndstigen</span>
        </div>
        <div className={s.srEyebrow}>{data.eyebrow}</div>
        <div className={s.srHero}>
          {data.heroCount} loppisar.<br /><em>En</em> {data.heroLine2}
        </div>
        <div className={s.srBody}>{data.body}</div>
        <div className={s.srMap}>
          <div className={s.srMapLabel}>{data.mapLabel}</div>
          <div className={s.srStops}>
            {data.stops.map((stop, i) => (
              <div key={i} className={s.srStop}>
                <div className={s.srStopNum}>{i + 1}</div>
                <div className={s.srStopInfo}>
                  <div className={s.srStopName}>{stop.name}</div>
                  <div className={s.srStopTime}>{stop.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className={s.srCta}>{data.cta}</div>
      </div>
    )
  },
)

// ─── Template 3: Reel cover (1080×1920) ─────────────────────────────

export type ReelCoverData = {
  bigNum: string        // "6"
  suffix: string        // "st"
  claimLine1: string    // "loppisar,"
  claimLine2: string    // "en lördag"
  sub: string           // "Så körde jag runt Närke →"
}

export const ReelCoverTemplate = forwardRef<HTMLDivElement, { data: ReelCoverData }>(
  function ReelCoverTemplate({ data }, ref) {
    return (
      <div ref={ref} className={`${s.tmpl} ${s.reelCover}`}>
        <div className={s.rcLogoTop}><FsLogo /></div>
        <svg className={s.rcPath} viewBox="0 0 1080 240" fill="none" preserveAspectRatio="none">
          <path d="M40 180 Q 200 60, 360 140 T 680 100 T 1040 160"
                stroke="#A84B2A" strokeWidth="3" strokeDasharray="4 10"
                strokeLinecap="round" opacity="0.5" />
          <circle cx="40" cy="180" r="10" fill="#A84B2A" opacity="0.6" />
          <circle cx="360" cy="140" r="10" fill="#D4A043" opacity="0.6" />
          <circle cx="680" cy="100" r="10" fill="#D4A043" opacity="0.6" />
          <circle cx="1040" cy="160" r="10" fill="#496342" opacity="0.6" />
        </svg>
        <div className={s.rcBigNum}>{data.bigNum}<sup>{data.suffix}</sup></div>
        <div className={s.rcClaim}>{data.claimLine1}<br />{data.claimLine2}</div>
        <div className={s.rcSub}>{data.sub}</div>
        <div className={s.rcCornerBrand}>fyndstigen</div>
      </div>
    )
  },
)

// ─── Template 4: Dagens fynd (1080×1080) ────────────────────────────

export type FindData = {
  title1: string        // "Teak"
  title2Em: string      // "sidobord" (italic/rust)
  title3: string        // "från 60-talet"
  priceLabelLeft: string   // "På Blocket"
  priceLeft: string        // "1 200"
  priceLabelRight: string  // "Mitt pris"
  priceRight: string       // "80"
  currency: string         // " kr"
  location: string
  hashtags: string
}

export const FindTemplate = forwardRef<HTMLDivElement, { data: FindData }>(
  function FindTemplate({ data }, ref) {
    return (
      <div ref={ref} className={`${s.tmpl} ${s.feedFynd}`}>
        <div className={s.ffStamp}>Dagens fynd</div>
        <div className={s.ffHero}>
          {data.title1}<br /><em>{data.title2Em}</em><br />{data.title3}
        </div>
        <div className={s.ffPriceRow}>
          <div className={s.ffPriceBlock}>
            <div className={s.ffPriceLabel}>{data.priceLabelLeft}</div>
            <div className={s.ffPriceVal}>{data.priceLeft}<span className={s.ffSmall}>{data.currency}</span></div>
          </div>
          <div className={s.ffArrow}>→</div>
          <div className={s.ffPriceBlock}>
            <div className={s.ffPriceLabel}>{data.priceLabelRight}</div>
            <div className={s.ffPriceVal}>{data.priceRight}<span className={s.ffSmall}>{data.currency}</span></div>
          </div>
        </div>
        <div className={s.ffLocation}>{data.location}</div>
        <div className={s.ffFooter}>
          <div className={s.ffBrand}>
            <FsLogo />
            <div className={s.ffBrandText}>fyndstigen</div>
          </div>
          <div className={s.ffHashtags}>{data.hashtags}</div>
        </div>
      </div>
    )
  },
)

export const TEMPLATE_STYLES = s as unknown as Record<string, string>
