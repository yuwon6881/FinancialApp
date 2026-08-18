/**
 * Query matching for the app-wide search overlay.
 *
 * Deliberately free of React and of domain types: `searchSources.ts` decides *what* text a
 * record contributes, this module decides *whether and how well* it matches. That split is
 * what lets the ranking rules be pinned by tests without constructing a Transaction.
 */

/** Relative pull of the field a token hit. A name match must outrank a category match. */
export const FIELD_WEIGHTS = {
  title: 100,
  subtitle: 45,
  keyword: 30,
  amount: 20,
} as const

export type SearchFieldKind = keyof typeof FIELD_WEIGHTS

export interface SearchField {
  kind: SearchFieldKind
  value: string
}

/**
 * How well one token sat in one field. Multiplied by the field weight, so a whole-word hit in a
 * subtitle can still beat a mid-word hit in a title -- which is what stops "car" ranking
 * "Groceries at Carrefour" above the account literally named "Car fund".
 */
const HIT_STRENGTH = {
  exact: 4,
  prefix: 3,
  wordPrefix: 2,
  substring: 1,
} as const

/**
 * Accents are folded as well as case, so "cafe rio" finds "Café Rio". The fold is applied to the
 * haystack and the query alike, so it can only ever add matches an accent was hiding — a plain
 * ASCII name scores exactly as it did before. Merchant names carry accents that phone keyboards
 * do not offer, which made the record impossible to find by typing what is on the receipt.
 */
export const normalizeSearchText = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Tokens are ANDed, because a two-word query is a narrowing intent: someone typing
 * "coffee jan" wants the rows matching both, not every row matching either. The month and year
 * behind that example are contributed as fields by `searchSources`, which owns every domain
 * decision; this module stays date-agnostic.
 */
export const tokenizeQuery = (query: string): string[] => {
  const normalized = normalizeSearchText(query)
  if (!normalized) return []
  return normalized.split(' ').filter(Boolean)
}

const strengthOf = (haystack: string, token: string): number | null => {
  if (!haystack) return null
  if (haystack === token) return HIT_STRENGTH.exact
  if (haystack.startsWith(token)) return HIT_STRENGTH.prefix
  // A word the token opens. Any non-alphanumeric counts as the boundary, so
  // punctuation-separated words ("Netflix/Spotify", "Car-Fund") behave like spaced ones.
  for (let index = 1; index < haystack.length; index += 1) {
    if (!/[a-z0-9]/.test(haystack[index - 1]) && haystack.startsWith(token, index)) {
      return HIT_STRENGTH.wordPrefix
    }
  }
  if (haystack.includes(token)) return HIT_STRENGTH.substring
  return null
}

/**
 * Score one record against one query.
 *
 * Returns `null` when any token matches nothing, so absence is a distinct answer rather than a
 * zero that would sort alongside a genuine weak match.
 */
export const scoreSearchFields = (fields: readonly SearchField[], tokens: readonly string[]): number | null => {
  if (tokens.length === 0) return 0
  let total = 0
  for (const token of tokens) {
    let best = 0
    for (const field of fields) {
      const strength = strengthOf(normalizeSearchText(field.value), token)
      if (strength === null) continue
      best = Math.max(best, strength * FIELD_WEIGHTS[field.kind])
    }
    if (best === 0) return null
    total += best
  }
  return total
}
