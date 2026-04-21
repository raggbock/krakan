import Link from 'next/link'
import { FyndstigenLogo } from '@/components/fyndstigen-logo'

export default function NotFound() {
  return (
    <div className="max-w-md mx-auto px-6 py-20 text-center">
      <FyndstigenLogo size={56} className="text-espresso/15 mx-auto mb-6" />
      <h1 className="font-display text-3xl font-bold">Sidan hittades inte</h1>
      <p className="text-sm text-espresso/65 mt-3">
        Stigen tog slut här. Sidan du letar efter finns inte eller har flyttats.
      </p>
      <Link
        href="/"
        className="inline-block mt-8 bg-rust text-white px-6 py-3 rounded-full text-sm font-semibold hover:bg-rust-light transition-colors shadow-sm"
      >
        Tillbaka till start
      </Link>
    </div>
  )
}
