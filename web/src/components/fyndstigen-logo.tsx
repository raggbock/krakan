export function FyndstigenLogo({
  size = 40,
  className = '',
}: {
  size?: number
  className?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Fyndstigen"
    >
      {/* Start — filled circle */}
      <circle cx="10" cy="52" r="5" fill="currentColor" opacity="0.85" />

      {/* Winding trail path */}
      <path
        d="M14 48 C20 38, 28 36, 24 26 C20 16, 32 12, 38 10 C44 8, 48 14, 52 8"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeDasharray="5 4"
        strokeLinecap="round"
        fill="none"
        opacity="0.35"
      />

      {/* Trail stop dots */}
      <circle cx="24" cy="26" r="2.2" fill="var(--color-rust, #C45B35)" opacity="0.5" />
      <circle cx="38" cy="10" r="2.2" fill="var(--color-rust, #C45B35)" opacity="0.5" />

      {/* Arrow pointing outward */}
      <path
        d="M50 10 L58 4"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.55"
      />
      <path
        d="M53 2 L59 3 L57 9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity="0.55"
      />
    </svg>
  )
}
