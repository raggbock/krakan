'use client'

import { useState } from 'react'

export type TableAddPayload = {
  label: string
  description: string
  priceSek: number
  sizeDescription: string
}

export type MarketTableAddFormProps = {
  onAdd: (table: TableAddPayload) => void
  /** When false, the price field is hidden and priceSek is always 0. Default: true. */
  showPrice?: boolean
}

export function MarketTableAddForm({ onAdd, showPrice = true }: MarketTableAddFormProps) {
  const [label, setLabel] = useState('')
  const [desc, setDesc] = useState('')
  const [price, setPrice] = useState('')
  const [size, setSize] = useState('')

  const isDisabled = !label || (showPrice && !price)

  function handleAdd() {
    if (isDisabled) return
    onAdd({
      label,
      description: desc,
      priceSek: showPrice ? parseInt(price, 10) || 0 : 0,
      sizeDescription: size,
    })
    setLabel('')
    setDesc('')
    setPrice('')
    setSize('')
  }

  return (
    <div className="bg-parchment rounded-xl p-4 space-y-3">
      <p className="text-xs font-semibold text-espresso/60">Lägg till nytt bord</p>
      <div className={`grid gap-3 ${showPrice ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Namn, t.ex. Bord 1"
          className="h-10 rounded-lg bg-card px-3 text-sm border border-cream-warm outline-none focus:border-rust/40 transition-all placeholder:text-espresso/25"
        />
        {showPrice && (
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Pris (kr)"
            className="h-10 rounded-lg bg-card px-3 text-sm border border-cream-warm outline-none focus:border-rust/40 transition-all placeholder:text-espresso/25"
          />
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input
          type="text"
          value={size}
          onChange={(e) => setSize(e.target.value)}
          placeholder="Storlek, t.ex. 2x1 meter"
          className="h-10 rounded-lg bg-card px-3 text-sm border border-cream-warm outline-none focus:border-rust/40 transition-all placeholder:text-espresso/25"
        />
        <input
          type="text"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Beskrivning"
          className="h-10 rounded-lg bg-card px-3 text-sm border border-cream-warm outline-none focus:border-rust/40 transition-all placeholder:text-espresso/25"
        />
      </div>
      <button
        onClick={handleAdd}
        disabled={isDisabled}
        className="w-full h-9 rounded-lg bg-cream-warm text-sm font-semibold text-espresso/60 hover:bg-espresso/8 transition-colors disabled:opacity-30"
      >
        + Lägg till
      </button>
    </div>
  )
}
