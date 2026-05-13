import type { Metadata } from 'next'

const mapTitle = 'Karta – Loppisar i Sverige'
const mapDescription =
  'Hitta loppisar och loppmarknader i hela Sverige på kartan. Se öppettider och plats för andrahandsmarknader nära dig.'

export const metadata: Metadata = {
  title: mapTitle,
  description: mapDescription,
  alternates: { canonical: '/map' },
  openGraph: {
    title: mapTitle,
    description: mapDescription,
    type: 'website',
    locale: 'sv_SE',
    url: '/map',
    images: [{ url: '/logo-512.png', width: 512, height: 512, alt: 'Fyndstigen' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: mapTitle,
    description: mapDescription,
    images: ['/logo-512.png'],
  },
}

export default function MapLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
