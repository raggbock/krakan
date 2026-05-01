import Link from 'next/link'
import { FyndstigenLogo } from '@/components/fyndstigen-logo'

type Props = {
  searchParams: Promise<{ email?: string }>
}

export default async function RouteAnonTackPage({ searchParams }: Props) {
  const { email } = await searchParams

  return (
    <main className="min-h-dvh grid place-items-center p-6">
      <div className="max-w-md text-center">
        <FyndstigenLogo size={36} className="text-rust mx-auto mb-5" />
        <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-forest text-parchment grid place-items-center text-3xl font-bold">
          ✓
        </div>
        <h1 className="font-display text-3xl font-medium tracking-tight mb-3">
          Rundan är sparad!
        </h1>
        <p className="text-espresso-light font-medium leading-relaxed">
          Tack! Vi har skickat en länk till{' '}
          <strong>{email ?? 'din e-post'}</strong> för att aktivera din runda.
          Klicka på länken i mailet för att logga in och se den.
        </p>
        <p className="text-espresso/55 text-sm mt-6">
          Hittar du inget mejl? Kolla skräpposten — det kommer från
          noreply@fyndstigen.se.
        </p>
        <Link
          href="/rundor/skapa"
          className="inline-block mt-8 text-sm text-rust font-semibold underline"
        >
          Skapa en ny runda
        </Link>
      </div>
    </main>
  )
}
