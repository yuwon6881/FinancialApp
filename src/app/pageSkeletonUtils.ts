import type { AppTab } from '../types'
import type { PageSkeletonVariant } from '../components/ui/CycleSkeleton'

/** Budget and Accounts were Settings sections and still render through the settings layout. */
export const getPageSkeletonVariant = (tab: AppTab): PageSkeletonVariant =>
  tab === 'budget' || tab === 'accounts' ? 'settings' : tab
