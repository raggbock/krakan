export function AddressCard({
  street,
  zipCode,
  city,
  country,
}: {
  street: string
  zipCode: string
  city: string
  country?: string | null
}) {
  return (
    <div className="vintage-card p-6 animate-fade-up delay-1">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-rust/10 flex items-center justify-center shrink-0 mt-0.5">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-rust">
            <path
              d="M8 1C5.2 1 3 3.2 3 6c0 4 5 9 5 9s5-5 5-9c0-2.8-2.2-5-5-5z"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
            />
            <circle cx="8" cy="6" r="1.5" fill="currentColor" />
          </svg>
        </div>
        <div>
          <h2 className="font-display font-bold text-lg mb-1">Adress</h2>
          <p className="text-espresso/70">
            {street}, {zipCode} {city}
          </p>
          {country && (
            <p className="text-espresso/40 text-sm mt-0.5">{country}</p>
          )}
        </div>
      </div>
    </div>
  )
}
