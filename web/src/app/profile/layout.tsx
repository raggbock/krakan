import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Min profil',
  description: 'Hantera dina loppisar, rundor och bokningar på Fyndstigen.',
  alternates: { canonical: '/profile' },
  robots: { index: false, follow: false },
}

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
