import type { AppTab } from '../types'
import type { PageSkeletonVariant } from '../components/ui/CycleSkeleton'
import { isLoansLocation } from '../lib/appLocation'

export function getPageSkeletonVariant(tab: AppTab): PageSkeletonVariant {
  if (typeof window !== 'undefined') {
    const { pathname, search, hash } = window.location
    if (tab === 'recurring' && isLoansLocation(pathname, search)) return 'loans'
    if (tab === 'budget' && /categor(y|ies)|limits/.test(search + hash)) return 'budget-categories'
  }
  return tab
}
