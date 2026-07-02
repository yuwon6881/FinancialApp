export const CATEGORY_BADGE_FALLBACK = 'bg-slate-500/10 text-slate-500 border-slate-500/20'
export const CATEGORY_DOT_FALLBACK = 'bg-slate-500'
export const CATEGORY_CHART_FALLBACK = 'var(--color-slate-500, #5d6978)'
export const CATEGORY_FILTER_FALLBACK = 'bg-background/50 border-border hover:bg-muted text-muted-foreground'

function normalizeCategoryName(category: string): string {
  if (category.startsWith('Transfer:')) return 'Transfer'
  if (category.startsWith('IncomeSplit:')) return 'Income'
  return category
}

const categoryBadgeClassMap: Record<string, string> = {
  Salary: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  Income: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  Transfer: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  Essentials: 'bg-sky-500/10 text-sky-500 border-sky-500/20',
  Social: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
  Food: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  Hobbies: 'bg-teal-500/10 text-teal-500 border-teal-500/20',
  Software: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
  Growth: 'bg-violet-500/10 text-violet-500 border-violet-500/20',
  Investment: 'bg-violet-500/10 text-violet-500 border-violet-500/20',
  Stability: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  Entertainment: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  Rewards: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
  Transport: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  Adjustment: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  Discarded: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
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
  Transport: 'var(--color-purple-500, #7e6dc9)',
  Adjustment: 'var(--color-amber-500, #e69f00)',
  Discarded: CATEGORY_CHART_FALLBACK,
  Other: CATEGORY_CHART_FALLBACK,
}

export function getCategoryBadgeClass(category: string | null | undefined): string {
  if (!category) return CATEGORY_BADGE_FALLBACK
  return categoryBadgeClassMap[normalizeCategoryName(category)] || CATEGORY_BADGE_FALLBACK
}

export function getCategoryDotClass(category: string | null | undefined): string {
  return getCategoryBadgeClass(category).split(' ')[0] || CATEGORY_DOT_FALLBACK
}

export function getCategoryChartColor(category: string | null | undefined): string {
  if (!category) return CATEGORY_CHART_FALLBACK
  return categoryChartColorMap[normalizeCategoryName(category)] || CATEGORY_CHART_FALLBACK
}

export function getCategoryFilterClass(category: string | null | undefined, selected: boolean): string {
  if (!selected) return CATEGORY_FILTER_FALLBACK
  return `${getCategoryBadgeClass(category)} font-semibold`
}
