import type { ToastAction } from '../components/ui/ToastViewport'
import type { AppTab } from '../types'

export function scanReviewAction(
  setActiveTab: (tab: AppTab) => void,
  setAutoOpen: (open: boolean) => void,
  tab: AppTab,
): ToastAction {
  return {
    label: 'Review',
    onAction: () => {
      setActiveTab(tab)
      setAutoOpen(true)
    },
  }
}
