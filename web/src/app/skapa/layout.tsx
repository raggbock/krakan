import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Skapa er loppis-sida — Fyndstigen',
  description:
    'Lägg till er loppis på Fyndstigen på 30 sekunder. Helt gratis. Vi mejlar en länk så du kan slutföra och publicera när du är klar.',
  alternates: { canonical: '/skapa' },
  openGraph: {
    title: 'Skapa er loppis-sida på Fyndstigen',
    description:
      'Tar 30 sekunder. Inget konto krävs — vi mejlar en länk så du kan slutföra.',
    type: 'website',
    locale: 'sv_SE',
  },
}

export default function SkapaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
