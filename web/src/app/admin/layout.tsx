'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useIsAdmin } from '@/hooks/use-admin'
import { useAuth } from '@/lib/auth-context'
import { FyndstigenLogo } from '@/components/fyndstigen-logo'

const navItems = [
  { href: '/admin', label: 'Översikt' },
  { href: '/admin/settings/admins', label: 'Admins' },
  { href: '/admin/import', label: 'Import' },
  { href: '/admin/takeover', label: 'Takeover', disabled: true },
  { href: '/admin/social', label: 'Social', disabled: true },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { data: isAdmin, isLoading: adminLoading } = useIsAdmin()

  // Accept-invite page is allowed unauthenticated — it handles its own redirect.
  const isAcceptPage = pathname?.startsWith('/admin/invite/accept')

  // Redirect unauthenticated users to /auth with a next= back to this path.
  useEffect(() => {
    if (isAcceptPage) return
    if (!authLoading && !user) {
      const next = encodeURIComponent(pathname ?? '/admin')
      router.replace(`/auth?next=${next}`)
    }
  }, [authLoading, user, pathname, router, isAcceptPage])

  if (isAcceptPage) {
    return <>{children}</>
  }

  if (authLoading || adminLoading || !user) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <FyndstigenLogo size={40} className="text-rust animate-bob" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <h1 className="font-display text-2xl font-bold">Otillåten</h1>
          <p className="mt-2 text-espresso/65">
            Du är inloggad men har inte admin-behörighet. Kontakta en befintlig
            admin om du behöver åtkomst.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh">
      <nav className="border-b border-cream-warm bg-card px-6 py-3 flex items-center gap-6">
        <Link href="/admin" className="font-display font-bold">Fyndstigen Admin</Link>
        <div className="flex items-center gap-4 text-sm">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.disabled ? '#' : item.href}
              aria-disabled={item.disabled}
              className={`${pathname === item.href ? 'text-rust font-semibold' : 'text-espresso/70'} ${item.disabled ? 'opacity-40 pointer-events-none' : 'hover:text-rust'}`}
            >
              {item.label}
              {item.disabled && ' (snart)'}
            </Link>
          ))}
        </div>
      </nav>
      <div className="max-w-6xl mx-auto p-6">{children}</div>
    </div>
  )
}
