'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import { FyndstigenLogo } from '@/components/fyndstigen-logo'
import { BackLink } from '@/components/back-link'
import { AddressCard } from '@/components/address-card'
import { OpeningHoursCard } from '@/components/opening-hours-card'
import { OrganizerCard } from '@/components/organizer-card'
import { BookableTablesCard } from '@/components/bookable-tables-card'
import { useMarketDetails } from '@/hooks/use-market-details'

export default function FleaMarketDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { market, tables, loading } = useMarketDetails(id)

  if (loading) {
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

  const isOwner = user?.id === market.organizer_id

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <BackLink href="/utforska" />

      {/* Draft notice */}
      {!market.published_at && isOwner && (
        <div className="bg-mustard/10 border border-mustard/20 rounded-xl px-4 py-3 text-sm text-mustard mb-6 animate-fade-up">
          Den här loppisen är ett opublicerat utkast och syns bara för dig.{' '}
          <Link href={`/fleamarkets/${id}/edit`} className="underline font-medium">
            Redigera och publicera
          </Link>
        </div>
      )}

      {/* Images */}
      {market.flea_market_images?.length > 0 && (
        <div className="mb-8 animate-fade-up">
          <div className={`grid gap-3 ${market.flea_market_images.length === 1 ? '' : 'grid-cols-2 sm:grid-cols-3'}`}>
            {market.flea_market_images
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((img, idx) => (
                <div
                  key={img.id}
                  className={`relative rounded-xl overflow-hidden bg-cream-warm ${
                    market.flea_market_images.length === 1 ? 'aspect-[2/1]' : 'aspect-square'
                  }`}
                >
                  <Image
                    src={api.images.publicUrl(img.storage_path)}
                    alt={market.name}
                    fill
                    sizes={market.flea_market_images.length === 1 ? '100vw' : '(min-width: 640px) 33vw, 50vw'}
                    className="object-cover"
                    priority={idx === 0}
                  />
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Header */}
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
              href={`/fleamarkets/${id}/edit`}
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

      {/* Info cards */}
      <div className="space-y-4 mt-8">
        <AddressCard
          street={market.street}
          zipCode={market.zip_code}
          city={market.city}
          country={market.country}
        />

        {market.opening_hour_rules?.length > 0 && (
          <OpeningHoursCard
            rules={market.opening_hour_rules}
            exceptions={market.opening_hour_exceptions ?? []}
          />
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
            tables={tables}
            openingHours={market.opening_hour_rules.length > 0 || market.opening_hour_exceptions.length > 0
              ? { rules: market.opening_hour_rules, exceptions: market.opening_hour_exceptions }
              : undefined}
          />
        )}
      </div>

      {/* Map link */}
      <div className="mt-8 animate-fade-up delay-5">
        <Link
          href="/map"
          className="inline-flex items-center gap-2 text-sm font-medium text-rust hover:text-rust-light transition-colors"
        >
          Visa på karta &rarr;
        </Link>
      </div>
    </div>
  )
}
