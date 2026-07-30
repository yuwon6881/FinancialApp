import { useEffect, type ReactNode } from 'react'
import { finishLaunchHandoff } from './launchHandoff'

export function LaunchReady({ children }: { children: ReactNode }) {
  useEffect(() => {
    void finishLaunchHandoff()
  }, [])

  return <>{children}</>
}
