import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Skapa loppis',
  description: 'Skapa en ny loppis på Fyndstigen.',
  robots: { index: false, follow: false },
}

export default function CreateMarketLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
