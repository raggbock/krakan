'use client'

export type MarketContactSectionProps = {
  website: string
  setWebsite: (v: string) => void
  phone: string
  setPhone: (v: string) => void
  email: string
  setEmail: (v: string) => void
  instagram: string
  setInstagram: (v: string) => void
  facebook: string
  setFacebook: (v: string) => void
  /** Matches MarketBasicInfoSection — bg-parchment on edit, bg-card on create. */
  inputBg?: 'bg-parchment' | 'bg-card'
}

/**
 * Optional contact/social channels. All five fields accept the relaxed shapes
 * the seller is likely to paste — for Instagram/Facebook the renderer at
 * components/market/social-links.tsx normalises a bare handle, @handle, or
 * full URL into a safe https link. No client-side validation here on purpose;
 * we'd rather store what the seller typed and let the display layer hide
 * anything that doesn't resolve.
 */
export function MarketContactSection({
  website,
  setWebsite,
  phone,
  setPhone,
  email,
  setEmail,
  instagram,
  setInstagram,
  facebook,
  setFacebook,
  inputBg = 'bg-card',
}: MarketContactSectionProps) {
  const inputClass = `w-full h-11 rounded-xl ${inputBg} px-4 text-sm border border-cream-warm outline-none focus:border-rust/40 transition-all placeholder:text-espresso/55`

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-display font-bold text-base">Kontakt &amp; sociala medier</h3>
        <p className="text-sm text-espresso/75 mt-1">
          Frivilligt. Det du fyller i visas på loppisens detaljsida.
        </p>
      </div>
      <div>
        <label htmlFor="market-website" className="text-sm font-semibold text-espresso/75 block mb-1.5">
          Hemsida
        </label>
        <input
          id="market-website"
          type="url"
          inputMode="url"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder="https://min-loppis.se"
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="market-instagram" className="text-sm font-semibold text-espresso/75 block mb-1.5">
          Instagram
        </label>
        <input
          id="market-instagram"
          type="text"
          value={instagram}
          onChange={(e) => setInstagram(e.target.value)}
          placeholder="@dittkonto eller fullständig URL"
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="market-facebook" className="text-sm font-semibold text-espresso/75 block mb-1.5">
          Facebook
        </label>
        <input
          id="market-facebook"
          type="text"
          value={facebook}
          onChange={(e) => setFacebook(e.target.value)}
          placeholder="facebook.com/dinsida eller URL"
          className={inputClass}
        />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="market-phone" className="text-sm font-semibold text-espresso/75 block mb-1.5">
            Telefon
          </label>
          <input
            id="market-phone"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="070-123 45 67"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="market-email" className="text-sm font-semibold text-espresso/75 block mb-1.5">
            E-post
          </label>
          <input
            id="market-email"
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="hej@min-loppis.se"
            className={inputClass}
          />
        </div>
      </div>
    </div>
  )
}
