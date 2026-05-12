import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Utforska loppisar — bläddra bland Sveriges loppisar',
  description:
    'Bläddra bland alla loppisar och loppmarknader i Sverige. Filtrera på öppet just nu, hitta loppisar nära dig och se öppettider — allt samlat på Fyndstigen.',
  alternates: { canonical: '/utforska' },
  openGraph: {
    title: 'Utforska loppisar — bläddra bland Sveriges loppisar',
    description:
      'Bläddra bland alla loppisar och loppmarknader i Sverige. Filtrera på öppet just nu, hitta loppisar nära dig och se öppettider — allt samlat på Fyndstigen.',
    type: 'website',
    locale: 'sv_SE',
  },
}

export default function UtforskaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
