import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PortfolioManagementRow } from './PortfolioManagementRow'

const props = {
  name: 'Broker', details: 'USD', entityLabel: 'account', isArchived: false,
  isSyncing: false, mutationsDisabled: false,
  onArchive: vi.fn(), onDelete: vi.fn(), onUnarchive: vi.fn(),
}

describe('portfolio archive actions', () => {
  it('shows the server restriction without hover and associates it with the disabled action', () => {
    render(<PortfolioManagementRow {...props} canDelete={false} canArchive={false} archiveUnavailableReason="Withdraw remaining cash first." />)
    const button = screen.getByRole('button', { name: 'Archive Broker' }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(document.getElementById(button.getAttribute('aria-describedby')!)?.textContent).toContain('Withdraw remaining cash first.')
    fireEvent.click(button)
    expect(props.onArchive).not.toHaveBeenCalled()
  })

  it.each([
    [{ canDelete: true, canArchive: true }, 'Delete Broker', props.onDelete],
    [{ canDelete: false, canArchive: true }, 'Archive Broker', props.onArchive],
    [{ isArchived: true, canArchive: false }, 'Unarchive Broker', props.onUnarchive],
  ])('dispatches the permitted action', (flags, label, callback) => {
    callback.mockClear()
    render(<PortfolioManagementRow {...props} {...flags} />)
    fireEvent.click(screen.getByRole('button', { name: label }))
    expect(callback).toHaveBeenCalledOnce()
    expect(screen.queryByText('Before archiving:')).toBeNull()
  })

  it('keeps syncing rows unavailable even if eligibility is true', () => {
    render(<PortfolioManagementRow {...props} canArchive isSyncing />)
    expect((screen.getByRole('button', { name: 'Archive Broker' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('does not invent a financial restriction when cached eligibility is missing', () => {
    render(<PortfolioManagementRow {...props} />)
    expect(screen.getByText(/Archive availability is not yet confirmed/)).toBeTruthy()
  })
})
