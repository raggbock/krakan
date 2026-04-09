import Link from 'next/link'

export function OrganizerCard({
  organizerId,
  organizerName,
}: {
  organizerId: string
  organizerName: string
}) {
  return (
    <div className="vintage-card p-6 animate-fade-up delay-3">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-mustard/15 flex items-center justify-center shrink-0 mt-0.5">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-mustard">
            <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.5" />
            <path d="M2 14C2 11.2 4.7 9 8 9s6 2.2 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <div>
          <h2 className="font-display font-bold text-lg mb-1">Arrangör</h2>
          <Link
            href={`/arrangorer/${organizerId}`}
            className="text-rust hover:text-rust-light transition-colors font-medium"
          >
            {organizerName}
          </Link>
        </div>
      </div>
    </div>
  )
}
