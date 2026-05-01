'use client'

import { useState } from 'react'
import { usePostHog } from 'posthog-js/react'
import { endpoints } from '@/lib/edge'

type Props = {
  blockSaleId: string
  defaultCity: string
  onSuccess: () => void
}

export function BlockSaleStandForm({ blockSaleId, defaultCity, onSuccess }: Props) {
  const posthog = usePostHog()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [street, setStreet] = useState('')
  const [zipCode, setZipCode] = useState('')
  const [city, setCity] = useState(defaultCity)
  const [description, setDescription] = useState('')
  const [website, setWebsite] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setErrorMsg(null)

    try {
      const res = await endpoints['block-sale.stand.apply'].invoke({
        blockSaleId,
        email,
        name,
        street,
        zipCode: zipCode || undefined,
        city,
        description,
        website,
      })
      if (res.ok) {
        posthog?.capture('block_sale_application_submitted', { blockSaleId })
        onSuccess()
      }
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string }
      if (e?.code === 'honeypot') {
        setErrorMsg('Något gick fel — försök igen')
      } else {
        setErrorMsg(e?.message ?? 'Något gick fel — försök igen')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 relative">
      {/* Honeypot — hidden from humans */}
      <input
        name="website"
        type="text"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute left-[-9999px] w-0 h-0"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
      />

      <div>
        <label className="block text-sm font-medium mb-1" htmlFor="bs-email">
          E-postadress
        </label>
        <input
          id="bs-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-espresso/30 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-forest"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1" htmlFor="bs-name">
          Fullständigt namn
        </label>
        <input
          id="bs-name"
          type="text"
          required
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border border-espresso/30 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-forest"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1" htmlFor="bs-street">
          Gatuadress
        </label>
        <input
          id="bs-street"
          type="text"
          required
          maxLength={200}
          value={street}
          onChange={(e) => setStreet(e.target.value)}
          className="w-full border border-espresso/30 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-forest"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="bs-zipcode">
            Postnummer <span className="text-espresso/50">(valfritt)</span>
          </label>
          <input
            id="bs-zipcode"
            type="text"
            maxLength={10}
            value={zipCode}
            onChange={(e) => setZipCode(e.target.value)}
            className="w-full border border-espresso/30 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-forest"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="bs-city">
            Ort
          </label>
          <input
            id="bs-city"
            type="text"
            required
            maxLength={80}
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full border border-espresso/30 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-forest"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1" htmlFor="bs-description">
          Vad tänker du sälja?
        </label>
        <textarea
          id="bs-description"
          required
          maxLength={200}
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full border border-espresso/30 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-forest resize-none"
        />
        <p className="text-xs text-espresso/50 text-right mt-1">
          {description.length}/200 tecken
        </p>
      </div>

      {errorMsg && (
        <p className="text-rust text-sm" role="alert">
          {errorMsg}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-forest text-white px-5 py-3 rounded-pill font-bold hover:bg-forest-light transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {submitting ? 'Skickar…' : 'Skicka ansökan'}
      </button>
    </form>
  )
}
