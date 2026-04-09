'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { FyndstigenLogo } from './fyndstigen-logo'

export function Nav() {
  const { user, loading } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 bg-parchment/85 backdrop-blur-md border-b border-cream-warm">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-6 h-16">
        {/* Brand */}
        <Link href="/" className="inline-flex items-center gap-2.5 group">
          <FyndstigenLogo
            size={32}
            className="text-espresso group-hover:text-rust transition-colors duration-300"
          />
          <span className="font-display font-bold text-lg tracking-tight text-espresso">
            Fyndstigen
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden sm:flex items-center gap-1">
          <NavLink href="/utforska">Utforska</NavLink>
          <NavLink href="/search">Sök</NavLink>
          <NavLink href="/map">Karta</NavLink>
          <NavLink href="/rundor">Rundor</NavLink>

          <div className="w-px h-5 bg-cream-warm mx-2" />

          {!loading && (
            <>
              {user ? (
                <Link
                  href="/profile"
                  className="ml-1 bg-espresso text-parchment px-5 py-2 rounded-full text-sm font-semibold hover:bg-espresso-light transition-colors duration-200"
                >
                  Min profil
                </Link>
              ) : (
                <Link
                  href="/auth"
                  className="ml-1 bg-rust text-white px-5 py-2 rounded-full text-sm font-semibold hover:bg-rust-light transition-colors duration-200"
                >
                  Logga in
                </Link>
              )}
            </>
          )}
        </nav>

        {/* Mobile hamburger */}
        <button
          className="flex flex-col justify-center items-center w-12 h-12 -mr-3 sm:hidden"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-label="Meny"
          type="button"
          style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
        >
          <span
            className={`block w-5 h-[2px] rounded-full bg-espresso transition-all duration-300 ${menuOpen ? 'rotate-45 translate-y-[7px]' : ''}`}
          />
          <span
            className={`block w-5 h-[2px] rounded-full bg-espresso transition-all duration-300 mt-[5px] ${menuOpen ? 'opacity-0' : ''}`}
          />
          <span
            className={`block w-5 h-[2px] rounded-full bg-espresso transition-all duration-300 mt-[5px] ${menuOpen ? '-rotate-45 -translate-y-[7px]' : ''}`}
          />
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="sm:hidden bg-parchment border-t border-cream-warm animate-fade-in">
          <div className="px-6 py-4 flex flex-col gap-1">
            <MobileNavLink href="/utforska" onClick={() => setMenuOpen(false)}>
              Utforska
            </MobileNavLink>
            <MobileNavLink href="/search" onClick={() => setMenuOpen(false)}>
              Sök
            </MobileNavLink>
            <MobileNavLink href="/map" onClick={() => setMenuOpen(false)}>
              Karta
            </MobileNavLink>
            <MobileNavLink href="/rundor" onClick={() => setMenuOpen(false)}>
              Rundor
            </MobileNavLink>

            <div className="h-px bg-cream-warm my-2" />

            {!loading && (
              <>
                {user ? (
                  <MobileNavLink
                    href="/profile"
                    onClick={() => setMenuOpen(false)}
                  >
                    Min profil
                  </MobileNavLink>
                ) : (
                  <Link
                    href="/auth"
                    onClick={() => setMenuOpen(false)}
                    className="mt-2 bg-rust text-white text-center px-5 py-3 rounded-xl text-sm font-semibold hover:bg-rust-light transition-colors"
                  >
                    Logga in
                  </Link>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}

function NavLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="px-3.5 py-2 rounded-lg text-sm font-medium text-espresso/70 hover:text-espresso hover:bg-cream-warm/60 transition-all duration-200"
    >
      {children}
    </Link>
  )
}

function MobileNavLink({
  href,
  onClick,
  children,
}: {
  href: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="px-4 py-3 rounded-xl text-sm font-medium text-espresso/80 hover:bg-cream-warm/50 transition-colors"
    >
      {children}
    </Link>
  )
}
