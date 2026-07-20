export const CATEGORY_BADGE_FALLBACK = 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20'
export const CATEGORY_DOT_FALLBACK = 'bg-slate-500'
export const CATEGORY_CHART_FALLBACK = 'var(--color-slate-500, #5d6978)'
export const CATEGORY_FILTER_FALLBACK = 'bg-background/50 border-border hover:bg-muted text-muted-foreground'

function normalizeCategoryName(category: string): string {
  if (category.startsWith('Transfer:')) return 'Transfer'
  if (category.startsWith('IncomeSplit:')) return 'Income'
  return category
}

const categoryBadgeClassMap: Record<string, string> = {
  Salary: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  Income: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  Transfer: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  Essentials: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
  Social: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20',
  Food: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  Hobbies: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
  Software: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
  Growth: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
  Investment: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
  Stability: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  Entertainment: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
  Rewards: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20',
  Transport: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  Adjustment: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  Discarded: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
  Other: CATEGORY_BADGE_FALLBACK,
}

const categoryChartColorMap: Record<string, string> = {
  Salary: 'var(--color-blue-500, #0072b2)',
  Income: 'var(--color-blue-500, #0072b2)',
  Transfer: 'var(--color-blue-500, #0072b2)',
  Essentials: 'var(--color-sky-500, #56b4e9)',
  Social: 'var(--color-pink-500, #cc79a7)',
  Food: 'var(--color-amber-500, #e69f00)',
  Hobbies: 'var(--color-teal-500, #009e73)',
  Software: 'var(--color-indigo-500, #6366f1)',
  Growth: 'var(--color-violet-500, #7e6dc9)',
  Investment: 'var(--color-violet-500, #7e6dc9)',
  Stability: 'var(--color-emerald-500, #009e73)',
  Entertainment: 'var(--color-orange-500, #d55e00)',
  Rewards: 'var(--color-pink-500, #cc79a7)',
  // Sky, not purple: purple-500 resolves to the same hex as Investment's violet, which made
  // the two indistinguishable in the outflow doughnut. Sky is unused by other spend categories.
  Transport: 'var(--color-sky-500, #56b4e9)',
  Adjustment: 'var(--color-amber-500, #e69f00)',
  Discarded: CATEGORY_CHART_FALLBACK,
  Other: CATEGORY_CHART_FALLBACK,
}

// Distinct, colorblind-aware fallback colors for user-defined categories that aren't in the
// curated map above. Without this, every custom category collapsed to the single slate
// CATEGORY_CHART_FALLBACK, so a user with many categories saw the same grey repeated.
// Each category name is hashed to a stable slot, so a category keeps its color across renders
// and chart ranges. Validated (light + dark) with the dataviz palette checker: all pass the
// lightness band, chroma floor, and CVD separation; sub-3:1 contrast is relieved by the chart's
// always-present legend labels and the 2px card-stroke gaps between slices.
const CHART_CUSTOM_PALETTE: string[] = [
  '#d1495b', // red
  '#66a61e', // olive-green
  '#b5179e', // magenta
  '#2f8f6f', // deep teal
  '#b5651d', // ochre
  '#984ea3', // plum
]

// Small deterministic string hash (djb2) so the same category name always maps to the same slot.
function hashCategoryName(name: string): number {
  let hash = 5381
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) + hash + name.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

const categoryDotClassMap: Record<string, string> = {
  Salary: 'bg-blue-500',
  Income: 'bg-blue-500',
  Transfer: 'bg-blue-500',
  Essentials: 'bg-sky-500',
  Social: 'bg-pink-500',
  Food: 'bg-amber-500',
  Hobbies: 'bg-teal-500',
  Software: 'bg-indigo-500',
  Growth: 'bg-violet-500',
  Investment: 'bg-violet-500',
  Stability: 'bg-emerald-500',
  Entertainment: 'bg-orange-500',
  Rewards: 'bg-pink-500',
  Transport: 'bg-purple-500',
  Adjustment: 'bg-amber-500',
  Discarded: 'bg-slate-500',
  Other: CATEGORY_DOT_FALLBACK,
}

export function getCategoryBadgeClass(category: string | null | undefined): string {
  if (!category) return CATEGORY_BADGE_FALLBACK
  return categoryBadgeClassMap[normalizeCategoryName(category)] || CATEGORY_BADGE_FALLBACK
}

export function getCategoryDotClass(category: string | null | undefined): string {
  if (!category) return CATEGORY_DOT_FALLBACK
  return categoryDotClassMap[normalizeCategoryName(category)] || CATEGORY_DOT_FALLBACK
}

export function getCategoryChartColor(category: string | null | undefined): string {
  if (!category) return CATEGORY_CHART_FALLBACK
  const normalized = normalizeCategoryName(category)
  const curated = categoryChartColorMap[normalized]
  if (curated) return curated
  // Custom category: give it a stable, distinct color instead of collapsing everything to grey.
  return CHART_CUSTOM_PALETTE[hashCategoryName(normalized) % CHART_CUSTOM_PALETTE.length]
}

export function getCategoryFilterClass(category: string | null | undefined, selected: boolean): string {
  if (!selected) return CATEGORY_FILTER_FALLBACK
  return `${getCategoryBadgeClass(category)} font-semibold`
}
