import type { ReactNode } from 'react'
import { AppContext, type AppContextValue } from './AppContext'

export function AppProvider({ value, children }: { value: AppContextValue; children: ReactNode }) {
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
