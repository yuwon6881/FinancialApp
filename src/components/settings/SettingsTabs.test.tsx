import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SettingsTabs } from './SettingsTabs'

describe('SettingsTabs in the two-pane layout', () => {
  it('lists the sections vertically with the open one selected', () => {
    const onChange = vi.fn()
    render(<SettingsTabs activeTab="security" onChange={onChange} vertical />)
    const list = screen.getByRole('tablist', { name: 'Settings sections' })
    expect(list.getAttribute('aria-orientation')).toBe('vertical')
    expect(screen.getByRole('tab', { name: /Security & devices/ }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tab', { name: /Security & devices/ }).id).toBe('settings-tab-security')

    fireEvent.click(screen.getByRole('tab', { name: /Investment plan/ }))
    expect(onChange).toHaveBeenCalledWith('investment-plan')
  })

  it('moves between sections with the arrow keys', () => {
    const onChange = vi.fn()
    render(<SettingsTabs activeTab="financial-model" onChange={onChange} vertical />)
    fireEvent.keyDown(screen.getByRole('tab', { name: /Preferences/ }), { key: 'ArrowDown' })
    expect(onChange).toHaveBeenCalledWith('investment-plan')
    fireEvent.keyDown(screen.getByRole('tab', { name: /Preferences/ }), { key: 'ArrowUp' })
    expect(onChange).toHaveBeenLastCalledWith('security')
  })
})
