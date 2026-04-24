'use client'

/**
 * Self-contained Fyndstigen logo SVG. The arrowhead is an inline
 * <polygon> rather than a <marker url(#…)> reference so html-to-image
 * can serialise it into the PNG export without losing the marker via
 * cross-instance ID resolution.
 */
export function FsLogo({ className }: { className?: string }) {
  return (
    <svg className={`fs-logo ${className ?? ''}`} viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
      <circle cx="200" cy="200" r="196" fill="#F8F4ED" />
      <circle cx="115" cy="272" r="26" fill="#A84B2A" />
      <path
        d="M 145 262 C 180 248, 180 230, 198 200 C 215 168, 240 160, 265 155 C 300 148, 305 135, 320 108"
        stroke="#2C241D"
        strokeWidth="8"
        strokeDasharray="0.01 22"
        strokeLinecap="round"
        fill="none"
      />
      {/* Arrowhead at path end (320,108), pointing along the path tangent */}
      <polygon points="320,100 312,118 332,114" fill="#2C241D" />
      <circle cx="198" cy="200" r="12" fill="#D4A043" />
      <circle cx="198" cy="200" r="12" fill="none" stroke="#2C241D" strokeWidth="2" />
      <circle cx="265" cy="155" r="12" fill="#5B7352" />
      <circle cx="265" cy="155" r="12" fill="none" stroke="#2C241D" strokeWidth="2" />
    </svg>
  )
}
