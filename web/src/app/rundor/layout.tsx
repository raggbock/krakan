import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Loppisrundor',
  description:
    'Upptäck och skapa loppisrundor. Planera din second hand-tur med Fyndstigen — välj loppisar, optimera rutten och dela med vänner.',
}

export default function RundorLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
