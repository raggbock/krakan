import { describe, expect, it } from 'vitest'
import { loppisRoute } from './loppis-routing'

describe('loppisRoute', () => {
  it('sends an anonymous visitor to the cached copy', () => {
    expect(loppisRoute('/loppis/retrolyckan-uppsala', false)).toEqual({
      kind: 'rewrite',
      pathname: '/loppis-publik/retrolyckan-uppsala',
    })
  })

  it('keeps a signed-in visitor on the session route, so drafts still preview', () => {
    expect(loppisRoute('/loppis/mitt-utkast', true)).toEqual({ kind: 'pass' })
  })

  it('tolerates a trailing slash', () => {
    expect(loppisRoute('/loppis/retrolyckan-uppsala/', false)).toEqual({
      kind: 'rewrite',
      pathname: '/loppis-publik/retrolyckan-uppsala',
    })
  })

  it('leaves percent-encoded slugs encoded', () => {
    expect(loppisRoute('/loppis/sm%C3%A5land', false)).toEqual({
      kind: 'rewrite',
      pathname: '/loppis-publik/sm%C3%A5land',
    })
  })

  it('redirects a direct hit on the internal path back to the public URL', () => {
    // Otherwise every market would exist at two addresses.
    expect(loppisRoute('/loppis-publik/retrolyckan-uppsala', false)).toEqual({
      kind: 'redirect',
      pathname: '/loppis/retrolyckan-uppsala',
    })
    expect(loppisRoute('/loppis-publik/retrolyckan-uppsala', true)).toEqual({
      kind: 'redirect',
      pathname: '/loppis/retrolyckan-uppsala',
    })
  })

  it('does not touch other routes', () => {
    for (const p of ['/', '/loppisar', '/loppisar/uppsala', '/loppis', '/loppis/a/b', '/admin', '/utforska']) {
      expect(loppisRoute(p, false)).toEqual({ kind: 'pass' })
    }
  })
})
