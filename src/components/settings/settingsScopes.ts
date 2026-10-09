export type SettingsTabId = 'financial-model' | 'investment-plan' | 'categories-preferences' | 'accounts' | 'security'

/**
 * Which of the settings panels a surface shows. Settings itself keeps app behaviour; the money
 * model and category limits are Plan › Budget; accounts are Wealth › Accounts.
 */
export type SettingsScope = 'settings' | 'budget' | 'accounts'

export const SETTINGS_TABS_BY_SCOPE: Record<SettingsScope, ReadonlyArray<readonly [SettingsTabId, string]>> = {
  settings: [
    ['financial-model', 'Preferences'],
    ['investment-plan', 'Investment plan'],
    ['security', 'Security & devices'],
  ],
  budget: [
    ['financial-model', 'Allocation & rules'],
    ['categories-preferences', 'Categories & limits'],
  ],
  accounts: [['accounts', 'Accounts']],
}
