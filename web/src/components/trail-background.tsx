/**
 * A winding trail SVG that sits behind page content.
 * Small treasure icons are scattered along the path.
 * Pure SVG — rendered as a Server Component to avoid hydration cost.
 */
export function TrailBackground({ className = '' }: { className?: string }) {
  return (
    <div
      className={`pointer-events-none fixed inset-0 z-0 overflow-hidden ${className}`}
      aria-hidden
    >
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 1440 3000"
        preserveAspectRatio="xMidYMin slice"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Main winding trail */}
        <path
          d="M-20 80 C200 120, 300 60, 500 140 C700 220, 600 320, 800 380 C1000 440, 1100 360, 1200 480 C1300 600, 1000 640, 900 760 C800 880, 1000 920, 1100 1040 C1200 1160, 900 1200, 700 1280 C500 1360, 600 1440, 800 1520 C1000 1600, 1200 1560, 1300 1680 C1400 1800, 1100 1880, 900 1960 C700 2040, 500 2000, 400 2120 C300 2240, 500 2320, 700 2400 C900 2480, 1100 2440, 1200 2560 C1300 2680, 1000 2760, 800 2840 L600 3000"
          stroke="var(--color-cream-warm)"
          strokeWidth="3"
          strokeDasharray="12 8"
          strokeLinecap="round"
          opacity="0.4"
          className="trail-path"
        />

        {/* Secondary subtle trail */}
        <path
          d="M1460 200 C1200 260, 1100 200, 900 300 C700 400, 800 500, 600 580 C400 660, 300 600, 200 720 C100 840, 300 920, 400 1040 C500 1160, 300 1240, 200 1360"
          stroke="var(--color-cream-warm)"
          strokeWidth="2"
          strokeDasharray="6 10"
          strokeLinecap="round"
          opacity="0.2"
        />

        {/* Trail stop dots */}
        {[
          [500, 140],
          [800, 380],
          [900, 760],
          [1100, 1040],
          [700, 1280],
          [800, 1520],
          [900, 1960],
          [700, 2400],
        ].map(([cx, cy], i) => (
          <g key={i}>
            <circle
              cx={cx}
              cy={cy}
              r="6"
              fill="var(--color-rust)"
              opacity="0.08"
            />
            <circle
              cx={cx}
              cy={cy}
              r="2.5"
              fill="var(--color-rust)"
              opacity="0.15"
            />
          </g>
        ))}

        {/* Tiny treasure icons scattered along */}
        {/* Vase */}
        <g transform="translate(520, 160)" opacity="0.06">
          <path d="M-4 0 C-4 -8, 4 -8, 4 0 L3 10 C3 12, -3 12, -3 10Z" fill="var(--color-rust)" />
        </g>
        {/* Book */}
        <g transform="translate(780, 400)" opacity="0.06">
          <rect x="-5" y="-4" width="10" height="8" rx="1" fill="var(--color-forest)" />
          <line x1="0" y1="-4" x2="0" y2="4" stroke="var(--color-parchment)" strokeWidth="0.5" />
        </g>
        {/* Lamp */}
        <g transform="translate(1120, 1060)" opacity="0.06">
          <path d="M-3 0 L-6 -10 L6 -10 L3 0Z" fill="var(--color-mustard)" />
          <rect x="-2" y="0" width="4" height="3" fill="var(--color-mustard)" />
        </g>
        {/* Cup */}
        <g transform="translate(680, 1300)" opacity="0.06">
          <path d="M-4 -4 L-3 4 L3 4 L4 -4Z" fill="var(--color-lavender)" />
          <path d="M4 -2 C7 -2, 7 2, 4 2" stroke="var(--color-lavender)" strokeWidth="1" fill="none" />
        </g>
        {/* Shoe */}
        <g transform="translate(920, 1980)" opacity="0.06">
          <path d="M-6 0 L-4 -4 L4 -4 L6 -2 L8 -2 L8 0Z" fill="var(--color-espresso)" />
        </g>
        {/* Record */}
        <g transform="translate(710, 2420)" opacity="0.06">
          <circle cx="0" cy="0" r="6" fill="var(--color-espresso)" />
          <circle cx="0" cy="0" r="2" fill="var(--color-parchment)" />
        </g>
      </svg>
    </div>
  )
}
