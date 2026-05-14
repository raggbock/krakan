'use client'

import Link from 'next/link'
import { useRouteBuilder } from '@/hooks/use-route-builder'
import { useAuth } from '@/lib/auth/auth-context'
import { FyndstigenLogo } from '../fyndstigen-logo'
import { RouteFormFields } from './route-form-fields'
import { StopList, type RouteBuilderStop } from './stop-list'
import { RouteMap } from './route-map'
import { SaveRouteButton } from './save-route-button'
import { AnonSaveForm } from './anon-save-form'
import type { FleaMarketNearByView, OpeningHourRuleView, OpeningHourExceptionView } from '@fyndstigen/shared'

type MarketWithHours = FleaMarketNearByView & {
  opening_hour_rules?: OpeningHourRuleView[]
  opening_hour_exceptions?: OpeningHourExceptionView[]
}

export default function RouteBuilder() {
  const vm = useRouteBuilder()
  const { user } = useAuth()

  const loading = vm.markets === undefined

  // StopList passes the full reordered array; the hook expects (from, to).
  // StopList does a single splice per dragover, so exactly one element will be
  // out of place compared to vm.stops. Find it and delegate.
  function handleReorder(newStops: RouteBuilderStop[]) {
    const toIdx = newStops.findIndex((s, i) => s.market.id !== vm.stops[i]?.market.id)
    if (toIdx === -1) return
    const fromIdx = vm.stops.findIndex((s) => s.market.id === newStops[toIdx].market.id)
    if (fromIdx !== toIdx) vm.reorderStops(fromIdx, toIdx)
  }

  const saveError =
    vm.saveProgress && 'type' in vm.saveProgress && vm.saveProgress.type === 'failed'
      ? 'Kunde inte spara rundan. Försök igen.'
      : ''

  return (
    <div className="flex flex-col lg:flex-row lg:h-[calc(100dvh-64px)]">
      {/* Sidebar */}
      <div className="w-full lg:w-[440px] xl:w-[480px] bg-card border-r border-cream-warm overflow-y-auto shrink-0 order-2 lg:order-1">
        <div className="p-6">
          {/* Header */}
          <Link
            href="/map"
            className="inline-flex items-center gap-1.5 text-sm text-espresso/60 hover:text-espresso transition-colors mb-4"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M9 3L5 7L9 11"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Tillbaka
          </Link>

          <h1 className="font-display text-2xl font-bold">Skapa loppisrunda</h1>
          <p className="text-sm text-espresso/65 mt-1">
            Klicka på loppisar i kartan eller sök nedan.
          </p>

          <RouteFormFields
            name={vm.name}
            onNameChange={vm.setName}
            plannedDate={vm.plannedDate}
            onPlannedDateChange={vm.setPlannedDate}
            useGps={vm.useGps}
            onUseGpsChange={vm.setUseGps}
          />

          <StopList
            stops={vm.stops}
            plannedDate={vm.plannedDate}
            onReorder={handleReorder}
            onRemove={vm.removeStop}
            onOptimize={vm.optimize}
            canOptimize={vm.stops.length >= 2}
          />

          {user ? (
            <SaveRouteButton
              disabled={!vm.name.trim() || vm.stops.length === 0}
              saving={vm.isSaving}
              error={saveError}
              onSave={vm.save}
            />
          ) : vm.stops.length > 0 ? (
            <div className="mt-6 vintage-card p-4 space-y-3">
              <p className="text-sm font-semibold text-espresso">
                Du har {vm.stops.length} stopp på din runda — spara den så du inte tappar bort den.
              </p>
              <AnonSaveForm
                stops={vm.stops}
                name={vm.name}
                plannedDate={vm.plannedDate}
                useGps={vm.useGps}
                customStart={vm.customStart}
                userPos={vm.userPos}
                onSaved={vm.clearDraft}
              />
              <p className="text-xs text-espresso/60 text-center">
                Eller{' '}
                <Link href="/auth" className="text-rust font-semibold underline">
                  logga in
                </Link>{' '}
                om du redan har konto.
              </p>
            </div>
          ) : (
            <div className="mt-6 vintage-card p-4 text-center">
              <p className="text-sm text-espresso/65">
                <Link href="/auth" className="text-rust font-semibold">
                  Logga in
                </Link>{' '}
                för att spara din runda.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Map */}
      <div className="relative order-1 lg:order-2 h-[350px] lg:h-auto lg:flex-1 lg:min-h-0">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-parchment/50">
            <FyndstigenLogo size={40} className="text-rust animate-bob" />
          </div>
        )}
        <RouteMap
          markets={(vm.markets ?? []) as MarketWithHours[]}
          stops={vm.stops}
          onToggleMarket={(market) => vm.toggleStop(market.id)}
          useGps={vm.useGps}
          customStart={vm.customStart}
          onCustomStartChange={vm.setCustomStart}
        />
      </div>
    </div>
  )
}
