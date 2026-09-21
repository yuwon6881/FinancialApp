import { describe, expect, it } from 'vitest'
import { getInstallInstructions, getWorkerActivationAction, hasUncommittedFormEdits, isStandaloneDisplayMode } from './pwaSafety'

describe('PWA safety helpers', () => {
  it('blocks update reloads while a dialog or changed form value is open', () => {
    document.body.innerHTML = '<form><input value="saved"></form>'
    const input = document.querySelector('input')!
    expect(hasUncommittedFormEdits(document)).toBe(false)

    input.value = 'unfinished'
    expect(hasUncommittedFormEdits(document)).toBe(true)

    document.body.innerHTML = '<div role="dialog"></div>'
    expect(hasUncommittedFormEdits(document)).toBe(true)
  })

  it('recognizes standalone display mode and the iOS standalone property', () => {
    expect(isStandaloneDisplayMode(
      { matchMedia: () => ({ matches: true }) } as unknown as Window,
      { standalone: false } as unknown as Navigator,
    )).toBe(true)
    expect(isStandaloneDisplayMode(
      { matchMedia: () => ({ matches: false }) } as unknown as Window,
      { standalone: true } as unknown as Navigator,
    )).toBe(true)
  })

  it('reloads only the tab that requested activation and offers a safe reload elsewhere', () => {
    expect(getWorkerActivationAction(true, true)).toBe('reload-requesting-tab')
    expect(getWorkerActivationAction(false, true)).toBe('offer-safe-reload')
    expect(getWorkerActivationAction(false, false, true)).toBe('offer-safe-reload')
    expect(getWorkerActivationAction(false, false)).toBe('ignore')
  })

  it('keeps platform detection limited to install instructions', () => {
    expect(getInstallInstructions('Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X)'))
      .toMatch(/Safari.*Share.*Add to Home Screen.*Open as Web App/i)
    expect(getInstallInstructions('Mozilla/5.0 (Linux; Android 16)'))
      .toMatch(/browser menu.*Install app/i)
    expect(getInstallInstructions('Desktop browser'))
      .toMatch(/Install or Add to Home Screen/i)
  })
})
