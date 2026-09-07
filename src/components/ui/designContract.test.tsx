import fs from 'node:fs'
import path from 'node:path'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Button, type ButtonSize, type ButtonVariant } from './Button'
import { controlClassName, controlTriggerClassName, type ControlSize } from './controlStyles'
import { PANEL_TONES, panelClass, panelFromMediumClass, panelVariantClasses, type PanelTone } from './panelStyles'
import { cn } from '../../lib/utils'
import { Badge, type BadgeTone } from './Badge'
import { Meter } from './Meter'
import { PageHeader } from './PageHeader'
import { SectionHeader } from './SectionHeader'

/**
 * These assert the contract *between* primitives, not the look of any one of them.
 *
 * Single-component tests could not have caught the defect this file was written for: `Button`
 * rounded its small size with `rounded-xl` while `controlClassName` used `rounded-lg`, so a small
 * button and a small input sitting together in a `Toolbar` did not match. Each component was
 * internally consistent and every existing test passed. What was missing was a test that the two
 * families agree.
 *
 * The rule of thumb for adding here: if two primitives have to make the *same* decision, assert it
 * once, in terms of the shared token rather than the resolved value.
 */

const VARIANTS: ButtonVariant[] = ['primary', 'secondary', 'tertiary', 'destructive']
const BUTTON_SIZES: ButtonSize[] = ['sm', 'md', 'lg', 'icon']
const CONTROL_SIZES: ControlSize[] = ['sm', 'md', 'lg']

/** Any t-shirt radius in a primitive means the semantic token was bypassed. */
const TSHIRT_RADIUS = /\brounded-(?:sm|md|lg|xl|2xl|3xl|4xl)\b/

function buttonClasses(variant: ButtonVariant, size: ButtonSize) {
  const { unmount } = render(<Button variant={variant} size={size}>Label</Button>)
  const className = screen.getByRole('button').className
  unmount()
  return className
}

describe('radius contract', () => {
  it('declares the semantic radii the primitives reference', () => {
    const css = fs.readFileSync(path.join(process.cwd(), 'src/index.css'), 'utf8')
    expect(css).toMatch(/--radius-control:/)
    expect(css).toMatch(/--radius-panel:/)
  })

  it.each(VARIANTS.flatMap(variant => BUTTON_SIZES.map(size => [variant, size] as const)))(
    'Button %s/%s uses the control radius',
    (variant, size) => {
      expect(buttonClasses(variant, size)).toContain('rounded-control')
    },
  )

  it.each(CONTROL_SIZES)('form control %s uses the control radius', size => {
    expect(controlClassName({ size })).toContain('rounded-control')
    expect(controlTriggerClassName({ size })).toContain('rounded-control')
  })

  // The point of the two blocks above: a button and a field of the same size must agree. Asserting
  // it directly means a change to one that forgets the other fails here rather than in review.
  it.each(CONTROL_SIZES)('a %s button and a %s field round identically', size => {
    const button = buttonClasses('secondary', size)
    const field = controlClassName({ size })
    const radiusOf = (value: string) => value.split(/\s+/).find(token => token.startsWith('rounded-'))
    expect(radiusOf(button)).toBe(radiusOf(field))
  })

  it.each(Object.entries(panelVariantClasses))('panel variant %s uses the panel radius', (_name, classes) => {
    expect(classes).toContain('rounded-panel')
  })

  it('keeps primitive surfaces off the t-shirt radius scale', () => {
    for (const [name, value] of [
      ['panelClass', panelClass],
      ['panelFromMediumClass', panelFromMediumClass],
      ...Object.entries(panelVariantClasses),
      ...CONTROL_SIZES.map(size => [`control:${size}`, controlClassName({ size })] as const),
    ] as Array<[string, string]>) {
      expect(value, `${name} should use rounded-control/rounded-panel`).not.toMatch(TSHIRT_RADIUS)
    }
  })
})

describe('type role contract', () => {
  const ROLES = ['eyebrow', 'caption', 'label', 'body', 'subsection', 'section', 'title', 'display']

  it.each(ROLES)('declares the %s role', role => {
    const css = fs.readFileSync(path.join(process.cwd(), 'src/index.css'), 'utf8')
    expect(css).toMatch(new RegExp(`--text-${role}:`))
  })

  // A hyphenated key in the `--text-*` namespace collides with Tailwind's
  // `--text-{name}--{property}` convention and resolves to nothing: no utility is emitted, the
  // class is inert, and the text silently falls back to whatever it inherits. That is exactly what
  // `--text-page-title` did -- it shrank every page heading from 24px to 20px above the medium tier
  // and passed the type check, the unit suite and all 324 visual snapshots, because a 4px change on
  // one line of text sits under the 2% pixel tolerance. Declaring the token is not evidence the
  // utility exists, so the shape that guarantees it is asserted here instead.
  it.each(ROLES)('names the %s role with a single word so Tailwind emits it', role => {
    expect(role, `--text-${role} must not contain a hyphen`).not.toContain('-')
  })

  it('gives a section heading its role rather than a size and a weight', () => {
    render(<SectionHeader title="Accounts" />)
    const heading = screen.getByRole('heading', { level: 2, name: 'Accounts' })
    expect(heading.className).toContain('text-section')
    // The role carries the weight, so re-specifying one is how the five different
    // heading treatments this replaced came about.
    expect(heading.className).not.toMatch(/\bfont-(?:bold|semibold|black|extrabold)\b/)
    expect(heading.className).not.toMatch(/\btext-(?:xs|sm|base|lg|xl|2xl)\b/)
  })

  it('gives a page heading the page-title role at every tier', () => {
    render(<PageHeader title="Vault" />)
    const heading = screen.getByRole('heading', { level: 1, name: 'Vault' })
    expect(heading.className).toContain('text-title')
    expect(heading.className).toContain('sm:text-display')
    expect(heading.className).not.toMatch(/\btext-(?:xs|sm|base|lg|xl|2xl)\b/)
  })
})

describe('class-merge contract', () => {
  // The semantic scales are invisible to a stock tailwind-merge, and it does not fail safe: it read
  // `text-eyebrow` as a `text-*` colour, so `cn('text-eyebrow', 'text-muted-foreground')` treated the
  // two as one conflict and DELETED the role, dropping the size and weight wherever a colour arrived
  // in a different argument. 206 class lists in this codebase were exposed to that. `cn` now declares
  // the scales; these assertions are what stop a future edit to `cn` from silently undoing it.
  const ROLES = ['eyebrow', 'caption', 'label', 'body', 'subsection', 'section', 'title', 'display']

  it.each(ROLES)('cn keeps text-%s when a text colour is merged alongside it', role => {
    expect(cn(`text-${role} uppercase`, 'text-muted-foreground')).toContain(`text-${role}`)
    expect(cn(`text-${role}`, 'text-foreground')).toContain(`text-${role}`)
  })

  it.each([['rounded-control'], ['rounded-panel']])('cn keeps %s alongside a border colour', radius => {
    expect(cn(radius, 'border-border/60 bg-card/92')).toContain(radius)
  })

  // The other half of declaring a scale: same-group classes must still resolve last-wins, or a
  // composed surface silently keeps two radii and stylesheet order picks the winner.
  it('resolves one role against another, last one winning', () => {
    expect(cn('text-caption', 'text-body')).toBe('text-body')
    expect(cn('rounded-panel', 'rounded-control')).toBe('rounded-control')
  })

  it('resolves a role against a t-shirt class in both directions', () => {
    expect(cn('text-sm', 'text-caption')).toBe('text-caption')
    expect(cn('text-caption', 'text-sm')).toBe('text-sm')
    expect(cn('rounded-xl', 'rounded-panel')).toBe('rounded-panel')
    expect(cn('rounded-panel', 'rounded-xl')).toBe('rounded-xl')
  })
})

describe('tone vocabulary contract', () => {
  // A reader should not have to learn "orange means already over" twice. Where a badge and a panel
  // name the same state, they must reach for the same colour family -- hand-rolled pills had used
  // amber and orange on sibling elements with nothing recording which meant what.
  const SHARED: Array<[BadgeTone & PanelTone, string]> = [
    ['warning', 'amber'],
    ['urgent', 'orange'],
    ['info', 'blue'],
  ]

  it.each(SHARED)('the %s tone is %s in both a badge and a panel', (tone, family) => {
    render(<Badge tone={tone}>Label</Badge>)
    const badge = screen.getByText('Label').className
    expect(badge, `Badge ${tone}`).toContain(`-${family}-`)
    expect(PANEL_TONES[tone], `PANEL_TONES.${tone}`).toContain(`-${family}-`)
  })

  it('keeps every badge tone on a rounded-full pill', () => {
    for (const tone of ['neutral', 'accent', 'info', 'success', 'warning', 'urgent', 'danger'] as BadgeTone[]) {
      const { unmount } = render(<Badge tone={tone}>{tone}</Badge>)
      expect(screen.getByText(tone).className).toContain('rounded-full')
      unmount()
    }
  })
})

describe('interaction floor contract', () => {
  it.each(VARIANTS.flatMap(variant => BUTTON_SIZES.map(size => [variant, size] as const)))(
    'Button %s/%s keeps a 44px target at compact and medium',
    (variant, size) => {
      const classes = buttonClasses(variant, size)
      // `icon` is square, the rest are height-constrained; either way the authored floor is 44px and
      // any step down must be keyed to `lg:` (the expanded tier), never `sm:` (the medium tier).
      expect(classes).toMatch(size === 'icon' ? /\bsize-11\b/ : /\bmin-h-1[123]\b/)
      expect(classes).not.toMatch(/\bsm:(?:min-h|size|h)-(?:[0-9]|10)\b/)
    },
  )

  it.each(CONTROL_SIZES)('form control %s keeps a 44px target at compact and medium', size => {
    const classes = controlClassName({ size })
    expect(classes).toMatch(/\bh-1[12]\b/)
    expect(classes).not.toMatch(/\bsm:h-(?:[0-9]|10)\b/)
  })
})

describe('masked-value contract', () => {
  // A figure derived from a masked amount must not reach a screen reader. This lived only in one
  // feature's test, which is why consolidating that feature's hand-rolled bar onto `Meter` broke it:
  // the primitive had no way to express "draw the width, announce nothing". Asserting it here means
  // the next consolidation cannot reintroduce the leak.
  it('announces a progress value by default', () => {
    render(<Meter percent={42} label="Growth funded" />)
    const bar = screen.getByRole('progressbar', { name: 'Growth funded' })
    expect(bar.getAttribute('aria-valuenow')).toBe('42')
    expect(bar.getAttribute('aria-valuemin')).toBe('0')
    expect(bar.getAttribute('aria-valuemax')).toBe('100')
  })

  it('omits every value when the figure behind it is masked', () => {
    render(<Meter percent={42} valueHidden label="Growth funded, amount hidden" />)
    const bar = screen.getByRole('progressbar', { name: 'Growth funded, amount hidden' })
    expect(bar.getAttribute('aria-valuenow')).toBeNull()
    expect(bar.getAttribute('aria-valuemin')).toBeNull()
    expect(bar.getAttribute('aria-valuemax')).toBeNull()
  })
})

describe('focus contract', () => {
  it.each(VARIANTS)('Button %s uses the action outline and never cancels it', variant => {
    const classes = buttonClasses(variant, 'md')
    expect(classes).toContain('focus-visible:outline-2')
    expect(classes).toContain('focus-visible:outline-ring')
    expect(classes).not.toMatch(/\boutline-none\b|\boutline-hidden\b|\bring-0\b/)
  })

  it.each(CONTROL_SIZES)('form control %s uses the text-entry ring and never cancels it', size => {
    const classes = controlClassName({ size })
    expect(classes).toContain('focus:ring-2')
    expect(classes).toContain('focus:border-ring')
    expect(classes).not.toMatch(/\bring-0\b/)
  })

  it('marks an invalid control without dropping its focus treatment', () => {
    const invalid = controlClassName({ size: 'md', invalid: true })
    expect(invalid).toContain('border-destructive')
    expect(invalid).toContain('focus:ring-2')
  })
})
