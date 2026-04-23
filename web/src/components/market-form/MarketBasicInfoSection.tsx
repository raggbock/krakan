'use client'

import dynamic from 'next/dynamic'
import type { AddressValue } from '@/components/address-picker'

const AddressPicker = dynamic(() => import('@/components/address-picker'), { ssr: false })

export type MarketBasicInfoSectionProps = {
  name: string
  setName: (v: string) => void
  description: string
  setDescription: (v: string) => void
  address: AddressValue
  setAddress: (v: AddressValue) => void
  isPermanent: boolean
  setIsPermanent: (v: boolean) => void
  /** When true, inputs get bg-parchment (edit page); false = bg-card (create page). */
  inputBg?: 'bg-parchment' | 'bg-card'
  /** When true, name/description get placeholder text (create page). */
  showPlaceholders?: boolean
}

export function MarketBasicInfoSection({
  name,
  setName,
  description,
  setDescription,
  address,
  setAddress,
  isPermanent,
  setIsPermanent,
  inputBg = 'bg-card',
  showPlaceholders = false,
}: MarketBasicInfoSectionProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-semibold text-espresso/70 block mb-1.5">Namn *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={showPlaceholders ? 'T.ex. Södermalms Loppis' : undefined}
          className={`w-full h-11 rounded-xl ${inputBg} px-4 text-sm border border-cream-warm outline-none focus:border-rust/40 transition-all placeholder:text-espresso/25`}
        />
      </div>
      <div>
        <label className="text-sm font-semibold text-espresso/70 block mb-1.5">Beskrivning</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder={showPlaceholders ? 'Berätta om din loppis...' : undefined}
          className={`w-full rounded-xl ${inputBg} px-4 py-3 text-sm border border-cream-warm outline-none focus:border-rust/40 transition-all resize-none placeholder:text-espresso/25`}
        />
      </div>
      <AddressPicker value={address} onChange={setAddress} inputBg={inputBg} />
      <div>
        <label className="text-sm font-semibold text-espresso/70 block mb-1.5">Typ</label>
        <div className="flex gap-1 bg-cream-warm rounded-xl p-1">
          <button
            onClick={() => setIsPermanent(true)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${isPermanent ? 'bg-card text-espresso shadow-sm' : 'text-espresso/60'}`}
          >
            Permanent
          </button>
          <button
            onClick={() => setIsPermanent(false)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${!isPermanent ? 'bg-card text-espresso shadow-sm' : 'text-espresso/60'}`}
          >
            Tillfällig
          </button>
        </div>
      </div>
    </div>
  )
}
