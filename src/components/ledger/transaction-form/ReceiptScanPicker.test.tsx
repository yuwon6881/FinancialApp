import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ReceiptScanPicker } from './ReceiptScanPicker'

describe('ReceiptScanPicker', () => {
  const defaultProps = {
    isScanning: false,
    showScanPicker: true,
    setShowScanPicker: vi.fn(),
    scanFileInputRef: React.createRef<HTMLInputElement | null>(),
    scanGalleryInputRef: React.createRef<HTMLInputElement | null>(),
    handleScanReceipt: vi.fn(),
    setScanError: vi.fn(),
  }

  it('renders "Take Photo" and "Upload Photo" buttons with whitespace-nowrap and truncate label text when picking receipt scan source', () => {
    render(<ReceiptScanPicker {...defaultProps} />)

    const takePhotoButton = screen.getByRole('button', { name: 'Take Photo' })
    const uploadPhotoButton = screen.getByRole('button', { name: 'Upload Photo' })

    expect(takePhotoButton.className).toContain('whitespace-nowrap')
    expect(uploadPhotoButton.className).toContain('whitespace-nowrap')

    const takePhotoLabel = screen.getByText('Take Photo')
    expect(takePhotoLabel.className).toContain('truncate')

    const uploadPhotoLabel = screen.getByText('Upload Photo')
    expect(uploadPhotoLabel.className).toContain('truncate')
  })

  it('renders "Take Photo" and "Upload Photo" buttons with whitespace-nowrap and truncate label text when picking split scan source', () => {
    render(
      <ReceiptScanPicker
        {...defaultProps}
        showScanPicker={false}
        showSplitPicker={true}
        setShowSplitPicker={vi.fn()}
        handleSplitScan={vi.fn()}
        splitCameraInputRef={React.createRef<HTMLInputElement | null>()}
        splitGalleryInputRef={React.createRef<HTMLInputElement | null>()}
      />,
    )

    const takePhotoButton = screen.getByRole('button', { name: 'Take Photo' })
    const uploadPhotoButton = screen.getByRole('button', { name: 'Upload Photo' })

    expect(takePhotoButton.className).toContain('whitespace-nowrap')
    expect(uploadPhotoButton.className).toContain('whitespace-nowrap')

    const takePhotoLabel = screen.getByText('Take Photo')
    expect(takePhotoLabel.className).toContain('truncate')

    const uploadPhotoLabel = screen.getByText('Upload Photo')
    expect(uploadPhotoLabel.className).toContain('truncate')
  })
})
