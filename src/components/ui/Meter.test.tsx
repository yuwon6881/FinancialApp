import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Meter } from './Meter'

describe('Meter', () => {
  it('exposes the value to assistive tech and matches the fill width', () => {
    render(<Meter percent={9} label="RM 32.21 of RM 350.00 set aside" />)

    const meter = screen.getByRole('progressbar', { name: 'RM 32.21 of RM 350.00 set aside' })
    expect(meter.getAttribute('aria-valuenow')).toBe('9')
    expect((meter.firstElementChild as HTMLElement).style.width).toBe('9%')
  })

  it('clamps a value outside 0-100 rather than overflowing its track', () => {
    render(<Meter percent={150} label="over" />)
    render(<Meter percent={-20} label="under" />)

    expect(screen.getByRole('progressbar', { name: 'over' }).getAttribute('aria-valuenow')).toBe('100')
    expect(screen.getByRole('progressbar', { name: 'under' }).getAttribute('aria-valuenow')).toBe('0')
  })

  it('renders an empty bar for a non-finite percentage instead of NaN%', () => {
    // A caller dividing by a zero target must not produce a broken style attribute.
    render(<Meter percent={Number.NaN} label="unknown" />)

    const meter = screen.getByRole('progressbar', { name: 'unknown' })
    expect(meter.getAttribute('aria-valuenow')).toBe('0')
    expect((meter.firstElementChild as HTMLElement).style.width).toBe('0%')
  })
})
