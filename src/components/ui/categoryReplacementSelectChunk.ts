// The dynamic import for CategoryReplacementSelect, kept out of the lazy wrapper so that file can
// export only components (react-refresh). See CategoryReplacementSelectLazy for why the picker is
// deferred at all.
export const loadCategoryReplacementSelect = () =>
  import('./CategoryReplacementSelect').then(m => ({ default: m.CategoryReplacementSelect }))

/**
 * Start the chunk fetch before the modal mounts. The delete confirmation already awaits a usage
 * lookup first, so warming it there means the picker is normally resolved by the time it renders
 * and the wrapper's fallback never appears -- it used to be the whole control on a first open.
 */
export const preloadCategoryReplacementSelect = () => { void loadCategoryReplacementSelect() }
