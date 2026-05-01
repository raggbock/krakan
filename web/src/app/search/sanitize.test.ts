import { describe, it, expect } from 'vitest'
import { safeFilterValue } from '@/lib/postgrest-utils'

describe('safeFilterValue', () => {
  it('leaves a plain search term unchanged', () => {
    expect(safeFilterValue('hello')).toBe('hello')
  })

  it('strips leading comma (PostgREST or-separator injection)', () => {
    expect(safeFilterValue(',published_at.is.null')).toBe('published_at.is.null')
  })

  it('strips percent sign (ilike wildcard)', () => {
    expect(safeFilterValue('Café % $50')).toBe('Café  $50')
  })

  it('strips parentheses (PostgREST grouping)', () => {
    expect(safeFilterValue('foo(bar)')).toBe('foobar')
  })

  it('strips backslash (escape char)', () => {
    expect(safeFilterValue('foo\\bar')).toBe('foobar')
  })

  it('strips asterisk (wildcard)', () => {
    expect(safeFilterValue('foo*bar')).toBe('foobar')
  })

  it('passes through Swedish characters and digits', () => {
    expect(safeFilterValue('Åre Loppis 2025')).toBe('Åre Loppis 2025')
  })
})
