/** True once the user has interacted with the page. Browsers without the API are treated as activated so behaviour is unchanged there. */
export function hasUserActivation(): boolean {
  if (typeof navigator === 'undefined') return true
  const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation
  return activation ? activation.hasBeenActive : true
}
