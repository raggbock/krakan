import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Logga in',
  description: 'Logga in eller skapa konto på Fyndstigen för att publicera loppisar och boka bord.',
  robots: { index: false, follow: false },
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
