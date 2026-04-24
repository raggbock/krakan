'use client'

/**
 * Self-contained Fyndstigen logo SVG. Inlined (no <use href>) so
 * html-to-image can serialise it into the PNG export.
 */
export function FsLogo({ className }: { className?: string }) {
  return (
    <svg className={`fs-logo ${className ?? ''}`} viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <marker id="fs-logo-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 Z" fill="#2C241D" />
        </marker>
      </defs>
      <circle cx="200" cy="200" r="196" fill="#F8F4ED" />
      <circle cx="115" cy="272" r="26" fill="#A84B2A" />
      <path
        d="M 145 262 C 180 248, 180 230, 198 200 C 215 168, 240 160, 265 155 C 300 148, 305 135, 320 108"
        stroke="#2C241D"
        strokeWidth="8"
        strokeDasharray="0.01 22"
        strokeLinecap="round"
        fill="none"
        markerEnd="url(#fs-logo-arrow)"
      />
      <circle cx="198" cy="200" r="12" fill="#D4A043" />
      <circle cx="198" cy="200" r="12" fill="none" stroke="#2C241D" strokeWidth="2" />
      <circle cx="265" cy="155" r="12" fill="#5B7352" />
      <circle cx="265" cy="155" r="12" fill="none" stroke="#2C241D" strokeWidth="2" />
    </svg>
  )
}
