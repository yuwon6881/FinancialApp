import { createContext, useContext } from 'react'

/**
 * Opens the one permissions sheet. Null where there is nothing for the sheet to manage — the web
 * app, whose browser asks for each permission itself at the moment a feature needs it.
 */
export const PermissionSetupContext = createContext<(() => void) | null>(null)
export const usePermissionSetupLauncher = () => useContext(PermissionSetupContext)
