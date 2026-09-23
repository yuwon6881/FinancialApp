import { listenForNativePushActions } from '../lib/push/nativeMessaging'
import { isPushNotificationData, type PushNotificationData } from '../lib/push/notificationTag'
import type { NativePushActionHandlers } from './useNativePushActions'

interface CurrentPushActionState {
  eligible: boolean
  handlers: NativePushActionHandlers
}

interface NativePushActionRuntime {
  wake: () => void
  cleanup: () => void
}

/** Buffer taps from terminated starts until both local gate and server auth are clear. */
export async function startNativePushActionRuntime(
  getCurrent: () => CurrentPushActionState,
): Promise<NativePushActionRuntime> {
  const pending: PushNotificationData[] = []
  let busy = false
  let disposed = false

  const drain = async () => {
    if (disposed || !getCurrent().eligible || busy || pending.length === 0) return
    busy = true
    try {
      while (!disposed && getCurrent().eligible && pending.length > 0) {
        const state = getCurrent()
        if (!(await state.handlers.verifySession())) return
        const latest = getCurrent()
        if (!latest.eligible) return
        const data = pending.shift()
        if (!data) continue
        if (data.kind === 'category-limit') latest.handlers.openCategoryAlerts()
        else latest.handlers.openRecurringPayment(data.recurringPaymentId)
      }
    } finally {
      busy = false
    }
  }

  const retry = () => {
    if (document.visibilityState === 'visible') void drain()
  }
  window.addEventListener('online', retry)
  window.addEventListener('pageshow', retry)
  document.addEventListener('visibilitychange', retry)

  const removeListener = await listenForNativePushActions(data => {
    if (!isPushNotificationData(data)) return
    pending.push(data)
    void drain()
  })

  return {
    wake: () => { void drain() },
    cleanup: () => {
      disposed = true
      removeListener()
      window.removeEventListener('online', retry)
      window.removeEventListener('pageshow', retry)
      document.removeEventListener('visibilitychange', retry)
    },
  }
}
