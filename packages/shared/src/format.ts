export function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

const SLUG_CHAR_MAP: Record<string, string> = {
  å: 'a', ä: 'a', ö: 'o', é: 'e', è: 'e', ü: 'u',
  Å: 'a', Ä: 'a', Ö: 'o', É: 'e', È: 'e', Ü: 'u',
}

export function slugifyCity(city: string): string {
  return city
    .split('')
    .map((c) => SLUG_CHAR_MAP[c] ?? c)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
