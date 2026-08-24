import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Settings critical tab loading contract', () => {
  it('does not suspend Investment Plan or Security cards behind runtime chunk imports', () => {
    const source = readFileSync(new URL('./SettingsView.tsx', import.meta.url), 'utf8')
    const criticalModules = [
      './settings/InvestmentPlanSection',
      './settings/ActiveDevicesSection',
      './ChangePasswordSection',
      './TwoFactorSection',
      './settings/FingerprintSection',
    ]

    for (const modulePath of criticalModules) {
      expect(source).toContain(`from '${modulePath}'`)
      expect(source).not.toContain(`import('${modulePath}')`)
    }
  })
})
