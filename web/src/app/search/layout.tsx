import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sök loppisar',
  description:
    'Sök bland loppisar och loppmarknader i hela Sverige. Hitta second hand-skatter nära dig.',
}

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
