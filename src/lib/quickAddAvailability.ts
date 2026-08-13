import type { SensitivePreferenceStatus } from '../app/useAppPreferences'

/** Blank add forms may mount while privacy is still being resolved, but never after it resolves on. */
export function canOpenBlankMutationForm(
  hideSensitive: boolean,
  sensitivePreferenceStatus: SensitivePreferenceStatus = 'resolved',
): boolean {
  return !hideSensitive || sensitivePreferenceStatus === 'pending'
}
