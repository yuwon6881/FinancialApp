import { lazy, Suspense, useCallback, useState, type ReactNode } from 'react'
import { Capacitor } from '@capacitor/core'
import { PermissionSetupContext } from '../contexts/PermissionSetupContext'
import type { PermissionSetupHostProps } from './PermissionSetupHost'

const PermissionSetupHost = lazy(() => import('./PermissionSetupHost'))

type Props = Omit<PermissionSetupHostProps, 'requested' | 'onRequestClosed'> & { children: ReactNode }

/**
 * Mounts the permissions sheet in the native apps, and hands Settings the one way to open it.
 * Placed inside the signed-in shell, so the first unprompted showing can only come after sign-in,
 * the security questions and account setup have all finished.
 */
export function PermissionSetupBoundary({ children, ...host }: Props) {
  const [requested, setRequested] = useState(false)
  const openSetup = useCallback(() => setRequested(true), [])
  const closeSetup = useCallback(() => setRequested(false), [])
  if (!Capacitor.isNativePlatform()) return children
  return (
    <PermissionSetupContext.Provider value={openSetup}>
      {children}
      <Suspense fallback={null}>
        <PermissionSetupHost {...host} requested={requested} onRequestClosed={closeSetup} />
      </Suspense>
    </PermissionSetupContext.Provider>
  )
}
