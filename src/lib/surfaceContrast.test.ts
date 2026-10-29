import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const css = fs.readFileSync(path.join(process.cwd(), 'src/index.css'), 'utf8')

type Rgb = [number, number, number]

/** Declarations of one theme block (`:root` is Day, `.dark` is Night). */
function readTokens(selector: string): Record<string, string> {
  const start = css.indexOf(`\n${selector} {`)
  const end = css.indexOf('\n}', start)
  const tokens: Record<string, string> = {}
  for (const match of css.slice(start, end).matchAll(/^\s+--([\w-]+):\s*(#[0-9a-fA-F]{6});/gm)) tokens[match[1]] = match[2]
  return tokens
}

const hexToRgb = (hex: string): Rgb => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) as Rgb

const luminance = ([r, g, b]: Rgb) => {
  const channel = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

const contrast = (a: Rgb, b: Rgb) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** `fill` painted at `alpha` (0..1) over `parent`. */
const over = (fill: Rgb, alpha: number, parent: Rgb): Rgb =>
  fill.map((v, i) => v * alpha + parent[i] * (1 - alpha)) as Rgb

/**
 * The weakest step the design system already treats as visible structure: its own solid hairline
 * on a sheet in Night (1.185:1). A grouped section has to be at least this easy to see, otherwise
 * the grouping it draws is decoration nobody can perceive.
 */
const VISIBLE_FLOOR = 1.15

describe.each([['Day', ':root'], ['Night', '.dark']] as const)('%s inset surface', (_theme, selector) => {
  const tokens = readTokens(selector)
  const color = (name: string) => {
    expect(tokens[name], `--${name} must be a 6-digit hex in ${selector}`).toBeDefined()
    return hexToRgb(tokens[name])
  }

  it.each(['card', 'popover'])('stays visible on %s', parent => {
    expect(contrast(color('inset'), color(parent))).toBeGreaterThanOrEqual(VISIBLE_FLOOR)
  })

  // `.inset-group` (a section on a card or sheet) draws its edge with --inset-line instead of a fill.
  it.each(['card', 'popover'])('draws a visible outline on %s', parent => {
    expect(contrast(color('inset-line'), color(parent))).toBeGreaterThanOrEqual(VISIBLE_FLOOR)
  })

  it('shows a card-coloured tile nested inside it', () => {
    expect(contrast(color('card'), color('inset'))).toBeGreaterThanOrEqual(VISIBLE_FLOOR)
  })

  it('shows a foreground/10 divider inside it', () => {
    const divider = over(color('foreground'), 0.1, color('inset'))
    expect(contrast(divider, color('inset'))).toBeGreaterThanOrEqual(VISIBLE_FLOOR)
  })

  it('keeps muted text readable on it (AA)', () => {
    expect(contrast(color('muted-foreground'), color('inset'))).toBeGreaterThanOrEqual(4.5)
    expect(contrast(color('foreground'), color('inset'))).toBeGreaterThanOrEqual(4.5)
  })

  // The old recipe, kept as a regression anchor: if this ever passes the floor the token is no
  // longer needed, and if the inset ever drops to it the grouping has vanished again.
  it('is clearly stronger than the surface-2/70 recipe it replaces', () => {
    const old = over(color('surface-2'), 0.7, color('popover'))
    expect(contrast(color('inset'), color('popover'))).toBeGreaterThan(contrast(old, color('popover')) + 0.05)
  })
})
