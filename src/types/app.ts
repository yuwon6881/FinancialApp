export const APP_TABS = ['dashboard', 'reports', 'recurring', 'ledger', 'wishlist', 'drafts', 'settings', 'investments', 'documents'] as const
export type AppTab = typeof APP_TABS[number]
