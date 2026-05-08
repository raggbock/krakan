'use client'

import Link from 'next/link'
import { FyndstigenLogo } from '@/components/fyndstigen-logo'
import { BackLink } from '@/components/back-link'
import { AddressCard } from '@/components/address-card'
import { OpeningHoursCard } from '@/components/opening-hours-card'
import { OrganizerCard } from '@/components/organizer-card'
import { BookableTablesCard } from '@/components/booking/tables-card'
import { AutoImportedNotice } from '@/components/auto-imported-notice'
import { ClaimMarketButton } from '@/components/claim-market-button'
import { MarketImageGallery } from '@/components/market/image-gallery'
import { useMarketDetailViewModel } from '@/hooks/use-market-detail-view-model'

export function MarketDetail({ id }: { id: string }) {
  const vm = useMarketDetailViewModel(id)
  const { market, tables, images, openingHours, isOwner, editUrl, mapUrl } = vm

  if (vm.isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <FyndstigenLogo size={40} className="text-rust animate-bob" />
      </div>
    )
  }

  if (!market) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-10 text-center">
        <FyndstigenLogo size={56} className="text-espresso/15 mx-auto mb-4" />
        <h1 className="font-display text-2xl font-bold">
          Loppisen hittades inte
        </h1>
        <p className="text-espresso/65 mt-2">
          Den kanske har tagits bort eller flyttat.
        </p>
        <Link
          href="/utforska"
          className="inline-block mt-6 text-rust font-medium hover:text-rust-light transition-colors"
        >
          &larr; Tillbaka till utforska
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <BackLink href="/utforska" />

      {!market.published_at && isOwner && (
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
              market.is_permanent ? 'text-forest' : 'text-mustard'
            }`}
          >
            {market.is_permanent ? 'Permanent' : 'Tillfällig'}
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
            zipCode={market.zip_code}
            city={market.city}
            country={market.country}
          />
          {market.is_system_owned && (
            <AutoImportedNotice
              what="Adressen"
              contactWebsite={market.contact_website}
              googlePlaceId={market.google_place_id}
            />
          )}
        </div>

        {market.opening_hour_rules?.length > 0 && (
          <div>
            <OpeningHoursCard
              rules={market.opening_hour_rules}
              exceptions={market.opening_hour_exceptions ?? []}
            />
            {market.is_system_owned && (
              <AutoImportedNotice
                what="Öppettiderna"
                plural
                contactWebsite={market.contact_website}
                googlePlaceId={market.google_place_id}
              />
            )}
          </div>
        )}

        {market.organizerName && (
          <OrganizerCard
            organizerId={market.organizer_id}
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
        <Link
          href={mapUrl}
          className="inline-flex items-center gap-2 text-sm font-medium text-rust hover:text-rust-light transition-colors"
        >
          Visa på karta &rarr;
        </Link>
        {market.is_system_owned && (
          <ClaimMarketButton marketId={id} marketName={market.name} />
        )}
      </div>
    </div>
  )
}
