/**
 * Panel surface classes, kept beside `Panel.tsx` rather than inside it so the component file only
 * exports a component (see the `react-refresh/only-export-components` rule) and so a plain wrapper
 * can compose the same shell without becoming a `Panel` element. Same split as `controlStyles.ts`.
 */

export const panelClass = 'app-panel rounded-2xl border border-border/60 bg-card/92'

export const panelVariantClasses = {
  default: panelClass,
  subtle: 'rounded-2xl border border-border/50 bg-muted/20',
  dashed: 'rounded-2xl border border-dashed border-border/70 bg-card/75',
} as const

export const panelPaddingClasses = {
  none: '',
  compact: 'p-4',
  default: 'p-4 sm:p-5',
  spacious: 'p-4 sm:p-6',
} as const

/**
 * Border tint for a panel that carries a state rather than plain content: an exception card, a
 * shortfall warning, a retention notice. It sets the border, and for `info` the surface too, and
 * nothing else -- shadow and padding stay the caller's decision because the notice panels that
 * predate this do not agree on either, and folding them in would change what they render.
 *
 * Compose it under `panelClass`, which it overrides last-wins:
 * `cn(panelClass, PANEL_TONES.warning, 'p-4 shadow-xs sm:p-5')`.
 */
export const PANEL_TONES = {
  default: '',
  /** Something needs attention but nothing has gone wrong yet. */
  warning: 'border-amber-500/30',
  /** A limit is already exceeded or a payment is already short. */
  urgent: 'border-orange-500/30',
  /** Neutral explanation of state the reader did not ask about. */
  info: 'border-blue-500/20 bg-blue-500/5',
} as const

export type PanelTone = keyof typeof PANEL_TONES

/**
 * A section that reads as plain content on a compact screen and becomes a card from the medium
 * tier upward, so a phone does not pay for a border and padding it has no room for. Three list
 * sections had spelled this out identically; it carries its own padding, which is why it is a
 * class constant rather than a variant the `padding` prop would fight with.
 */
export const panelFromMediumClass =
  'app-panel rounded-none border-0 bg-transparent p-0 shadow-none sm:rounded-2xl sm:border sm:border-border/60 sm:bg-card/92 sm:p-5'
