import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Karta – Loppisar i Sverige',
  description:
    'Hitta loppisar och loppmarknader i hela Sverige på kartan. Se öppettider och plats för andrahandsmarknader nära dig.',
}

export default function MapLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
