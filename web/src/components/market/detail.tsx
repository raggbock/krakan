'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { BackLink } from '@/components/back-link'
import { AddressCard } from '@/components/address-card'
import { OpeningHoursCard } from '@/components/opening-hours-card'
import { OrganizerCard } from '@/components/organizer-card'
import { BookableTablesCard } from '@/components/booking/tables-card'
import { AutoImportedNotice } from '@/components/auto-imported-notice'
import { ClaimMarketButton } from '@/components/claim-market-button'
import { MarketImageGallery } from '@/components/market/image-gallery'
import { AddToRouteButton } from '@/components/add-to-route-button'
import { useAuth } from '@/lib/auth/auth-context'
import { marketEditUrl } from '@/lib/urls'
import type { FleaMarketDetailsView, MarketTableView } from '@fyndstigen/shared'

type Props = {
  id: string
  market: FleaMarketDetailsView | null
  tables: MarketTableView[]
}

export function MarketDetail({ id, market, tables }: Props) {
  const { user } = useAuth()

  const { images, openingHours, isOwner, editUrl, mapUrl } = useMemo(() => {
    const images = [...(market?.images ?? [])].sort((a, b) => a.sortOrder - b.sortOrder)

    const rules = market?.openingHourRules ?? []
    const exceptions = market?.openingHourExceptions ?? []
    const openingHours =
      rules.length === 0 && exceptions.length === 0
        ? undefined
        : { rules, exceptions }

    const isOwner = !!market && user?.id === market.organizerId

    const mapUrl = (() => {
      if (!market || market.latitude == null || market.longitude == null) {
        return '/map'
      }
      const params = new URLSearchParams({
        lat: String(market.latitude),
        lng: String(market.longitude),
        name: market.name,
      })
      if (market.slug) params.set('slug', market.slug)
      return `/map?${params.toString()}`
    })()

    return {
      images,
      openingHours,
      isOwner,
      editUrl: marketEditUrl({ id }),
      mapUrl,
    }
  }, [market, user?.id, id])

  // market is null only in the E2E bypass path where the in-memory bridge
  // resolves data client-side. In production the server always passes the
  // full market — page.tsx calls notFound() if the market doesn't exist.
  if (!market) return null

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <BackLink href="/utforska" />

      {!market.publishedAt && isOwner && (
        <div className="bg-mustard/10 border border-mustard/20 rounded-xl px-4 py-3 text-sm text-mustard mb-6 animate-fade-up">
          Den här loppisen är ett opublicerat utkast och syns bara för dig.{' '}
          <Link href={editUrl} className="underline font-medium">
            Redigera och publicera
          </Link>
        </div>
      )}

      <MarketImageGallery images={images} marketName={market.name} />

      <div className="animate-fade-up">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <h1 className="font-display text-3xl sm:text-4xl font-bold">
            {market.name}
          </h1>
          <span
            className={`stamp animate-stamp delay-2 ${
              market.isPermanent ? 'text-forest' : 'text-mustard'
            }`}
          >
            {market.isPermanent ? 'Permanent' : 'Tillfällig'}
          </span>
          {isOwner && (
            <Link
              href={editUrl}
              className="ml-auto inline-flex items-center gap-1.5 text-sm font-semibold text-rust hover:text-rust-light transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M10.5 1.5L12.5 3.5L4.5 11.5L1.5 12.5L2.5 9.5L10.5 1.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Redigera
            </Link>
          )}
        </div>

        {market.description && (
          <p className="text-espresso/60 text-lg leading-relaxed mt-3 max-w-2xl">
            {market.description}
          </p>
        )}
      </div>

      <div className="space-y-4 mt-8">
        <div>
          <AddressCard
            street={market.street}
            zipCode={market.zipCode}
            city={market.city}
            country={market.country}
          />
          {market.isSystemOwned && (
            <AutoImportedNotice
              what="Adressen"
              contactWebsite={market.contactWebsite}
              googlePlaceId={market.googlePlaceId}
            />
          )}
        </div>

        {openingHours && (
          <div>
            <OpeningHoursCard
              rules={openingHours.rules}
              exceptions={openingHours.exceptions}
            />
            {market.isSystemOwned && (
              <AutoImportedNotice
                what="Öppettiderna"
                plural
                contactWebsite={market.contactWebsite}
                googlePlaceId={market.googlePlaceId}
              />
            )}
          </div>
        )}

        {market.organizerName && (
          <OrganizerCard
            organizerId={market.organizerId}
            organizerName={market.organizerName}
          />
        )}

        {tables.length > 0 && (
          <BookableTablesCard
            fleaMarketId={id}
            fleaMarketName={market.name}
            tables={tables}
            openingHours={openingHours}
          />
        )}
      </div>

      <div className="mt-8 animate-fade-up delay-5 flex flex-wrap items-center gap-x-6 gap-y-3">
        {market.publishedAt && (
          <AddToRouteButton
            marketId={id}
            marketName={market.name}
            marketCity={market.city}
            source="market_detail"
          />
        )}
        <Link
          href={mapUrl}
          className="inline-flex items-center gap-2 text-sm font-medium text-rust hover:text-rust-light transition-colors"
        >
          Visa på karta &rarr;
        </Link>
        {market.isSystemOwned && (
          <ClaimMarketButton marketId={id} marketName={market.name} />
        )}
      </div>
    </div>
  )
}
