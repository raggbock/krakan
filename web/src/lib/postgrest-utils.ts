// PostgREST or() uses commas as filter separators and parens for grouping.
// Asterisk and percent are wildcards in ilike; backslash is escape.
// Strip all of them to prevent predicate injection via user-supplied input.
export function safeFilterValue(s: string): string {
  return s.replace(/[,()*%\\]/g, '')
}
