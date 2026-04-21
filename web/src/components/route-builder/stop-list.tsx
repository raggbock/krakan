'use client'

import { useState } from 'react'
import { checkOpeningHours, type OpeningHourRule, type OpeningHourException } from '@fyndstigen/shared'
import { FyndstigenLogo } from '../fyndstigen-logo'
import type { FleaMarketNearBy } from '@/lib/api'

type MarketWithHours = FleaMarketNearBy & {
  opening_hour_rules?: OpeningHourRule[]
  opening_hour_exceptions?: OpeningHourException[]
}

export type RouteStop = {
  market: MarketWithHours
  index: number
}

type Props = {
  stops: RouteStop[]
  plannedDate: string
  onReorder: (stops: RouteStop[]) => void
  onRemove: (marketId: string) => void
  onOptimize: () => void
  canOptimize: boolean
}

export function StopList({ stops, plannedDate, onReorder, onRemove, onOptimize, canOptimize }: Props) {
  const [dragIdx, setDragIdx] = useState<number | null>(null)

  function handleDragStart(idx: number) {
    setDragIdx(idx)
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault()
    if (dragIdx === null || dragIdx === idx) return
    const newStops = [...stops]
    const [moved] = newStops.splice(dragIdx, 1)
    newStops.splice(idx, 0, moved)
    onReorder(newStops)
    setDragIdx(idx)
  }

  function handleDragEnd() {
    setDragIdx(null)
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display font-bold">
          Stopp ({stops.length})
        </h2>
        {canOptimize && stops.length >= 2 && (
          <button
            onClick={onOptimize}
            className="text-xs font-semibold text-rust hover:text-rust-light transition-colors"
          >
            Optimera rutt
          </button>
        )}
      </div>

      {stops.length === 0 ? (
        <div className="text-center py-8">
          <FyndstigenLogo
            size={36}
            className="text-espresso/10 mx-auto mb-2"
          />
          <p className="text-xs text-espresso/30">
            Klicka på en markör i kartan för att lägga till stopp.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {stops.map((stop, i) => {
            const oh = plannedDate
              ? checkOpeningHours(
                  stop.market.opening_hour_rules ?? [],
                  stop.market.opening_hour_exceptions ?? [],
                  plannedDate,
                )
              : null

            return (
              <div
                key={stop.market.id}
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-3 bg-parchment rounded-xl p-3 cursor-grab active:cursor-grabbing transition-all ${dragIdx === i ? 'opacity-50 scale-95' : ''}`}
              >
                {/* Number badge */}
                <div className="w-7 h-7 rounded-full bg-rust text-white flex items-center justify-center text-xs font-bold shrink-0">
                  {i + 1}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {stop.market.name}
                  </p>
                  <p className="text-xs text-espresso/60 truncate">
                    {stop.market.city}
                  </p>
                </div>

                {/* Opening hours warning */}
                {oh && !oh.isOpen && (
                  <span
                    className="text-error text-xs font-medium shrink-0"
                    title="Stängt denna dag"
                  >
                    Stängt
                  </span>
                )}
                {oh && oh.isOpen && oh.hours.length > 0 && (
                  <span className="text-forest text-xs font-medium shrink-0 tabular-nums">
                    {oh.hours.map((h) => `${h.open_time}–${h.close_time}`).join(', ')}
                  </span>
                )}

                {/* Remove button */}
                <button
                  onClick={() => onRemove(stop.market.id)}
                  className="text-espresso/20 hover:text-error transition-colors shrink-0"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                  >
                    <path
                      d="M4 4L10 10M10 4L4 10"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
