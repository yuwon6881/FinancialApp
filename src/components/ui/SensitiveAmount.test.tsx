import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SensitiveAmount } from './SensitiveAmount'

describe('SensitiveAmount', () => {
  it('renders an unmasked first frame without a blur dependency', () => {
    const { container } = render(<SensitiveAmount value={4312} formatFn={value => `RM ${value.toFixed(2)}`} />)
    expect(screen.getByText('RM 4312.00')).toBeTruthy()
    expect(container.querySelector('[style*="blur"]')).toBeNull()
  })

  it('switches atomically between a mask and the real amount', () => {
    const { container, rerender } = render(<SensitiveAmount value={3001.53} isMasked />)
    expect(screen.getByRole('img', { name: 'Sensitive amount hidden' })).toBeTruthy()
    rerender(<SensitiveAmount value={3001.53} isMasked={false} formatFn={value => `RM ${value.toFixed(2)}`} />)
    expect(screen.getByText('RM 3001.53')).toBeTruthy()
    expect(container.querySelector('[style*="blur"]')).toBeNull()
  })
})
