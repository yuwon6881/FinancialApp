import { describe, expect, it } from 'vitest'
import { FIELD_WEIGHTS, normalizeSearchText, scoreSearchFields, tokenizeQuery } from './searchMatch'

const title = (value: string) => [{ kind: 'title' as const, value }]

describe('normalizeSearchText', () => {
  it('lowercases and collapses whitespace', () => {
    expect(normalizeSearchText('  Coffee   Beans ')).toBe('coffee beans')
  })
})

describe('tokenizeQuery', () => {
  it('splits into tokens and drops empty input', () => {
    expect(tokenizeQuery('coffee  beans')).toEqual(['coffee', 'beans'])
    expect(tokenizeQuery('   ')).toEqual([])
  })
})

describe('scoreSearchFields', () => {
  it('returns 0 for an empty query so nothing is filtered out', () => {
    expect(scoreSearchFields(title('anything'), [])).toBe(0)
  })

  it('returns null when any token matches nothing, since tokens are ANDed', () => {
    expect(scoreSearchFields(title('coffee beans'), ['coffee', 'tea'])).toBeNull()
  })

  it('ranks exact above prefix above word-prefix above substring', () => {
    const score = (value: string) => scoreSearchFields(title(value), ['car'])
    const exact = score('car')!
    const prefix = score('carrefour')!
    const wordPrefix = score('my car fund')!
    const substring = score('oscar')!
    expect(exact).toBeGreaterThan(prefix)
    expect(prefix).toBeGreaterThan(wordPrefix)
    expect(wordPrefix).toBeGreaterThan(substring)
  })

  it('treats punctuation as a word boundary', () => {
    const punctuated = scoreSearchFields(title('netflix/spotify'), ['spotify'])!
    const buried = scoreSearchFields(title('xspotify'), ['spotify'])!
    expect(punctuated).toBeGreaterThan(buried)
  })

  it('weights a title hit above the same hit in a keyword field', () => {
    const inTitle = scoreSearchFields([{ kind: 'title', value: 'food' }], ['food'])!
    const inKeyword = scoreSearchFields([{ kind: 'keyword', value: 'food' }], ['food'])!
    expect(inTitle).toBeGreaterThan(inKeyword)
    expect(FIELD_WEIGHTS.title).toBeGreaterThan(FIELD_WEIGHTS.keyword)
  })

  it('lets a whole-word subtitle hit beat a mid-word title hit', () => {
    // Why this matters: "car" must not rank "Groceries at Carrefour" above an account
    // whose own name is the word being typed.
    const midWordTitle = scoreSearchFields([{ kind: 'title', value: 'oscars night out' }], ['car'])!
    const wholeWordSubtitle = scoreSearchFields([{ kind: 'subtitle', value: 'car fund' }], ['car'])!
    expect(wholeWordSubtitle).toBeGreaterThan(midWordTitle)
  })

  it('takes the best field per token rather than summing duplicates', () => {
    const once = scoreSearchFields([{ kind: 'title', value: 'food' }], ['food'])!
    const twice = scoreSearchFields(
      [{ kind: 'title', value: 'food' }, { kind: 'keyword', value: 'food' }],
      ['food'],
    )!
    expect(twice).toBe(once)
  })
})
