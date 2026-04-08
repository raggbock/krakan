import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Karta',
  description:
    'Se loppisar och loppmarknader nära dig på kartan. Hitta öppna loppisar i ditt område.',
}

export default function MapLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
