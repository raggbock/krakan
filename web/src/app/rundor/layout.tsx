import type { Metadata } from 'next'

const rundorTitle = 'Loppisrundor'
const rundorDescription =
  'Upptäck och skapa loppisrundor. Planera din second hand-tur med Fyndstigen — välj loppisar, optimera rutten och dela med vänner.'

export const metadata: Metadata = {
  title: rundorTitle,
  description: rundorDescription,
  alternates: { canonical: '/rundor' },
  openGraph: {
    title: rundorTitle,
    description: rundorDescription,
    type: 'website',
    locale: 'sv_SE',
    url: '/rundor',
    images: [{ url: '/logo-512.png', width: 512, height: 512, alt: 'Fyndstigen' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: rundorTitle,
    description: rundorDescription,
    images: ['/logo-512.png'],
  },
}

export default function RundorLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
