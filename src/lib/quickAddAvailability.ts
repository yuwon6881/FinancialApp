import type { SensitivePreferenceStatus } from '../app/useAppPreferences'

/** Blank bill, reward, investment, and scan-triggered forms only open before privacy resolves on. */
export function canOpenBlankMutationForm(
  hideSensitive: boolean,
  sensitivePreferenceStatus: SensitivePreferenceStatus = 'resolved',
): boolean {
  return !hideSensitive || sensitivePreferenceStatus === 'pending'
}

/**
 * Entering a brand-new transaction exposes no stored balances, so transaction creation
 * can always open pre-wake and under sensitive mode.
 */
export function canOpenTransactionForm(
  _hideSensitive = false,
  _sensitivePreferenceStatus: SensitivePreferenceStatus = 'resolved',
): boolean {
  return true
}
