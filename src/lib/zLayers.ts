/**
 * The single ordering of every body-level overlay in the app.
 *
 * These used to be bare `z-[…]` literals scattered across a dozen components,
 * which made the one rule that actually matters — a notification must never be
 * painted behind the modal that produced it — impossible to see, let alone
 * enforce. Anything that stacks above the page content should take its class
 * from here so the ordering is reviewable in one place, and
 * `zLayers.test.ts` fails when a new layer breaks it.
 *
 * Values are whole Tailwind class strings rather than numbers so they stay
 * statically analysable by Tailwind's scanner.
 */
export const Z_LAYERS = {
  /** Floating page furniture inside the app shell (FAB, its scrim, sticky bars). */
  floatingControl: 'z-40',
  /** Anchored menus that belong to page-level content. */
  pagePopover: 'z-[55]',
  /** The default modal/bottom-sheet layer. */
  sheet: 'z-[100]',
  /** Popovers opened from inside a sheet (selects, date pickers). */
  sheetPopover: 'z-[200]',
  /** Popovers opened from inside a sheet popover (currency inside a form row). */
  nestedSheetPopover: 'z-[230]',
  /** Tooltips/hints, which must clear every popover they can be opened over. */
  hint: 'z-[240]',
  /**
   * Notifications. Above every sheet and popover: a failed save must be
   * readable without dismissing the form that caused it, including on mobile
   * where the sheet fills the viewport.
   */
  toast: 'z-[400]',
  /** The lock screen deliberately covers everything, notifications included. */
  lockScreen: 'z-[500]',
} as const

export type ZLayerName = keyof typeof Z_LAYERS

/** Ascending stacking order, used by the guard test and for documentation. */
export const Z_LAYER_ORDER: ZLayerName[] = [
  'floatingControl',
  'pagePopover',
  'sheet',
  'sheetPopover',
  'nestedSheetPopover',
  'hint',
  'toast',
  'lockScreen',
]

/** Parses the numeric z-index out of a layer's Tailwind class. */
export function zLayerValue(name: ZLayerName): number {
  const raw = Z_LAYERS[name]
  const bracketed = raw.match(/^z-\[(\d+)\]$/)
  if (bracketed) return Number(bracketed[1])
  const scale = raw.match(/^z-(\d+)$/)
  if (scale) return Number(scale[1])
  throw new Error(`Unrecognised z-layer class: ${raw}`)
}
