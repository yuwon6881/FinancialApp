import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ReceiptScanStatus } from './ReceiptScanStatus'

describe('ReceiptScanStatus', () => {
  it('announces scan outcomes and gives both banners named touch-friendly dismiss actions', () => {
    const setShowScanBanner = vi.fn()
    const setScanError = vi.fn()
    render(
      <ReceiptScanStatus
        showScanBanner
        setShowScanBanner={setShowScanBanner}
        scanError="The image could not be read."
        setScanError={setScanError}
      />,
    )

    expect(screen.getByRole('status').textContent).toContain('Receipt scanned')
    expect(screen.getByRole('alert').textContent).toContain('The image could not be read.')

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss receipt scan success' }))
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss receipt scan error' }))
    expect(setShowScanBanner).toHaveBeenCalledWith(false)
    expect(setScanError).toHaveBeenCalledWith(null)
  })
})
