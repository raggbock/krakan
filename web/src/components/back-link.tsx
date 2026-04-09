import Link from 'next/link'

export function BackLink({ href, label = 'Tillbaka' }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-sm text-espresso/40 hover:text-espresso transition-colors duration-200 mb-8"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path
          d="M9 3L5 7L9 11"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {label}
    </Link>
  )
}
