export function KrakanLogo({
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
      aria-label="Kråkan"
    >
      {/* Body — chunky folk art crow */}
      <path
        d="M22 44 C14 42, 10 36, 12 30 C14 24, 20 20, 28 18 C32 17, 36 18, 38 20 L40 22 C44 20, 48 22, 48 26 C48 30, 44 34, 40 36 L36 38 C34 42, 28 46, 22 44Z"
        fill="currentColor"
      />
      {/* Head */}
      <circle cx="44" cy="22" r="8" fill="currentColor" />
      {/* Eye */}
      <circle cx="46" cy="20" r="2.5" fill="var(--color-parchment, #F2EBE0)" />
      <circle cx="46.5" cy="19.5" r="1" fill="currentColor" />
      {/* Beak */}
      <path
        d="M50 19 L61 16 L59 22 L50 24Z"
        fill="var(--color-mustard, #D4A043)"
      />
      {/* Coin in beak — tilted perspective, scaled up */}
      {/* Coin edge/thickness */}
      <ellipse cx="59.2" cy="19.2" rx="5" ry="2.5" fill="var(--color-espresso, #2C241D)" opacity="0.2" />
      {/* Coin body — tilted ellipse */}
      <ellipse cx="59" cy="18" rx="5" ry="5.6" fill="var(--color-mustard, #D4A043)" transform="rotate(-15 59 18)" />
      {/* Coin rim */}
      <ellipse cx="59" cy="18" rx="5" ry="5.6" fill="none" stroke="var(--color-espresso, #2C241D)" strokeWidth="0.5" opacity="0.15" transform="rotate(-15 59 18)" />
      <ellipse cx="59" cy="18" rx="4" ry="4.5" fill="none" stroke="var(--color-mustard-light, #E3BC6A)" strokeWidth="0.5" transform="rotate(-15 59 18)" />
      {/* Coin ridges along edge — pre-computed to avoid hydration mismatch */}
      <g stroke="var(--color-espresso, #2C241D)" strokeWidth="0.4" opacity="0.12">
        <line x1="63.2" y1="19.1" x2="63.8" y2="19.2" />
        <line x1="62.1" y1="21.6" x2="62.5" y2="22" />
        <line x1="59.7" y1="23" x2="59.8" y2="23.6" />
        <line x1="56.8" y1="22.8" x2="56.5" y2="23.3" />
        <line x1="55" y1="21.2" x2="54.6" y2="21.5" />
        <line x1="54.8" y1="18.5" x2="54.2" y2="18.4" />
        <line x1="55.9" y1="14.8" x2="55.5" y2="14.4" />
        <line x1="57.8" y1="13.2" x2="57.7" y2="12.6" />
        <line x1="60.5" y1="13.3" x2="60.8" y2="12.8" />
        <line x1="62.5" y1="14.9" x2="62.9" y2="14.6" />
      </g>
      {/* Coin highlight/sheen */}
      <ellipse cx="57.5" cy="16.5" rx="2.5" ry="3" fill="var(--color-mustard-light, #E3BC6A)" opacity="0.4" transform="rotate(-15 57.5 16.5)" />
      {/* Sparkle — large */}
      <path
        d="M62.5 13 L63 11 L63.5 13 L65.5 13.5 L63.5 14 L63 16 L62.5 14 L60.5 13.5Z"
        fill="var(--color-mustard-light, #E3BC6A)"
      >
        <animate attributeName="opacity" values="0.9;0.3;0.9" dur="2s" repeatCount="indefinite" />
      </path>
      {/* Sparkle — small */}
      <path
        d="M56.5 14 L56.8 13 L57.1 14 L58.1 14.3 L57.1 14.6 L56.8 15.6 L56.5 14.6 L55.5 14.3Z"
        fill="var(--color-mustard, #D4A043)"
      >
        <animate attributeName="opacity" values="0.4;0.9;0.4" dur="2.5s" repeatCount="indefinite" />
      </path>
      {/* Sparkle — tiny */}
      <circle cx="61.5" cy="15.5" r="0.5" fill="var(--color-parchment-light, #F8F4ED)">
        <animate attributeName="opacity" values="0;0.8;0" dur="1.8s" repeatCount="indefinite" />
      </circle>
      {/* Wing detail */}
      <path
        d="M20 32 C24 28, 30 26, 36 28"
        stroke="var(--color-parchment, #F2EBE0)"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        opacity="0.3"
      />
      <path
        d="M18 36 C22 32, 28 30, 34 32"
        stroke="var(--color-parchment, #F2EBE0)"
        strokeWidth="1"
        fill="none"
        strokeLinecap="round"
        opacity="0.2"
      />
      {/* Tail feathers */}
      <path
        d="M12 32 L6 28 L8 32 L4 30 L8 34 L6 36 L12 34"
        fill="currentColor"
      />
      {/* Legs */}
      <line
        x1="26"
        y1="44"
        x2="24"
        y2="52"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="32"
        y1="44"
        x2="31"
        y2="52"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Feet */}
      <path
        d="M21 52 L24 52 L27 52"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M28 52 L31 52 L34 52"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function KrakanWordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`font-display font-bold tracking-tight ${className}`}>
      Kråkan
    </span>
  )
}

export function KrakanBrand({
  logoSize = 36,
  className = '',
}: {
  logoSize?: number
  className?: string
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <KrakanLogo size={logoSize} />
      <KrakanWordmark className="text-xl" />
    </span>
  )
}
