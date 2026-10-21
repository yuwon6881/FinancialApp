import { ChevronRight, ShieldCheck } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { usePermissionSetupLauncher } from '../../contexts/PermissionSetupContext'
import { cn } from '../../lib/utils'
import { Button } from '../ui/Button'
import { panelClass } from '../ui/panelStyles'

/**
 * The one way into every permission the app uses on this phone. Notifications, the camera and
 * transaction detection each used to be asked for from wherever the feature lived; this opens the
 * same sheet a fresh installation is offered after sign-in.
 */
export function PermissionsCard() {
  const openSetup = usePermissionSetupLauncher()
  if (!openSetup) return null
  const scope = Capacitor.getPlatform() === 'android'
    ? 'Notifications, camera and transaction detection on this phone.'
    : 'Notifications and camera on this phone.'
  return (
    <section aria-labelledby="settings-permissions-heading" className={cn(panelClass, 'mb-4 space-y-3 p-4 sm:p-5')}>
      <div className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true"><ShieldCheck className="size-4" /></span>
        <div className="min-w-0 space-y-1">
          <h3 id="settings-permissions-heading" className="text-subsection text-foreground">App permissions</h3>
          <p className="text-caption text-muted-foreground">{scope}</p>
        </div>
      </div>
      <div className="flex justify-end">
        <Button variant="secondary" size="sm" onClick={openSetup}>
          Manage permissions <ChevronRight className="size-3.5" aria-hidden="true" />
        </Button>
      </div>
    </section>
  )
}
