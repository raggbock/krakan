'use client'

import { openCookieSettings } from './cookie-consent'

export function CookieSettingsLink() {
  return (
    <button
      type="button"
      onClick={openCookieSettings}
      className="hover:text-espresso transition-colors"
    >
      Cookie-inställningar
    </button>
  )
}
