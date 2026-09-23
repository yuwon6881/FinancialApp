/** Native Capacitor builds deliberately ship no service-worker registration. */
export function registerSW(): () => Promise<void> {
  return async () => undefined
}
