import type { Metadata } from 'next'

const searchTitle = 'Sök loppisar'
const searchDescription =
  'Sök bland loppisar och loppmarknader i hela Sverige. Hitta second hand-skatter nära dig.'

export const metadata: Metadata = {
  title: searchTitle,
  description: searchDescription,
  openGraph: {
    title: searchTitle,
    description: searchDescription,
    type: 'website',
    locale: 'sv_SE',
    url: '/search',
    images: [{ url: '/logo-512.png', width: 512, height: 512, alt: 'Fyndstigen' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: searchTitle,
    description: searchDescription,
    images: ['/logo-512.png'],
  },
}

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
