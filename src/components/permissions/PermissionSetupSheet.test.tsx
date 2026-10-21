import { fireEvent, render, screen, within } from '@testing-library/react'
import { BellRing, Camera } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'
import { PermissionSetupSheet, type PermissionRow } from './PermissionSetupSheet'

const allow = vi.fn()
const rows: PermissionRow[] = [
  { id: 'notifications', icon: BellRing, title: 'Notifications', description: 'Reminders.', status: 'needed', action: { label: 'Allow', onClick: allow } },
  { id: 'camera', icon: Camera, title: 'Camera', description: 'Receipts.', status: 'allowed' },
]

describe('PermissionSetupSheet', () => {
  it('lists every permission with its own state and action, and counts what is allowed', () => {
    const onAllowAll = vi.fn(), onClose = vi.fn()
    render(<PermissionSetupSheet isOpen rows={rows} onAllowAll={onAllowAll} allowAllBusy={false} onClose={onClose} firstRun />)
    const list = screen.getByRole('list', { name: 'Permissions' })
    expect(within(list).getByRole('listitem', { name: 'Notifications' }).textContent).toContain('Not allowed')
    expect(within(list).getByRole('listitem', { name: 'Camera' }).textContent).toContain('Allowed')
    expect(screen.getByText('1 of 2 allowed')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Allow: Notifications' }))
    expect(allow).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'Allow all' }))
    expect(onAllowAll).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('says Close when opened from Settings, and Done once nothing is left to allow', () => {
    const { rerender } = render(<PermissionSetupSheet isOpen rows={rows} onAllowAll={vi.fn()} allowAllBusy={false} onClose={vi.fn()} firstRun={false} />)
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy()
    rerender(<PermissionSetupSheet isOpen rows={rows.map(row => ({ ...row, status: 'allowed', action: undefined }))} allowAllBusy={false} onClose={vi.fn()} firstRun={false} />)
    expect(screen.queryByRole('button', { name: 'Allow all' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy()
    expect(screen.getByText('2 of 2 allowed')).toBeTruthy()
  })

  it('leaves optional steps out of the count', () => {
    render(<PermissionSetupSheet isOpen rows={[...rows, { id: 'battery', icon: Camera, title: 'Battery', description: 'Keep running.', status: 'optional' }]} onAllowAll={vi.fn()} allowAllBusy={false} onClose={vi.fn()} firstRun />)
    expect(screen.getByText('1 of 2 allowed')).toBeTruthy()
  })
})
