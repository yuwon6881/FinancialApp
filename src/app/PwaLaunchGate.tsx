import type { AppContextValue } from '../contexts/AppContext'
import { AppProvider } from '../contexts/AppProvider'
import { LockScreen } from '../components/LockScreen'
import { ToastViewport, type ToastMessage } from '../components/ui/ToastViewport'
import { LaunchReady } from './LaunchReady'

interface PwaLaunchGateProps {
  appContextValue: AppContextValue
  toasts: ToastMessage[]
  onDismissToast: (id: string) => void
  username: string
  onTryDeviceUnlock: () => Promise<void>
  onUnlocked: () => void
  onSignOut: () => void | Promise<void>
}

export function PwaLaunchGate({
  appContextValue,
  toasts,
  onDismissToast,
  username,
  onTryDeviceUnlock,
  onUnlocked,
  onSignOut,
}: PwaLaunchGateProps) {
  'use no memo'
  return (
    <LaunchReady>
      <AppProvider value={appContextValue}>
        <div className="app-shell min-h-screen text-foreground flex flex-col selection:bg-primary/25 selection:text-foreground">
          <ToastViewport toasts={toasts} onDismiss={onDismissToast} />
          <LockScreen
            mode="pwa-launch"
            isOpen
            username={username}
            onTryDeviceUnlock={onTryDeviceUnlock}
            onUnlocked={onUnlocked}
            onSignOut={onSignOut}
          />
        </div>
      </AppProvider>
    </LaunchReady>
  )
}
