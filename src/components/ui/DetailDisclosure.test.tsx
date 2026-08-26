import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DetailDisclosure } from './DetailDisclosure'

describe('DetailDisclosure', () => {
  it('stays a native details element so open state is exposed without extra wiring', () => {
    render(
      <DetailDisclosure label="Details" open={false} onOpenChange={vi.fn()}>
        <p>Per cycle</p>
      </DetailDisclosure>,
    )

    const summary = screen.getByText('Details')
    expect(summary.closest('details')?.open).toBe(false)
  })

  it('reports a toggle to the caller rather than owning the state', () => {
    const onOpenChange = vi.fn()
    render(
      <DetailDisclosure label="Details" open={false} onOpenChange={onOpenChange}>
        <p>Per cycle</p>
      </DetailDisclosure>,
    )

    const details = screen.getByText('Details').closest('details') as HTMLDetailsElement
    details.open = true
    fireEvent(details, new Event('toggle'))

    expect(onOpenChange).toHaveBeenCalledWith(true)
  })

  it('reflects the controlled open prop', () => {
    const { rerender } = render(
      <DetailDisclosure label="Details" open={false} onOpenChange={vi.fn()}>
        <p>Per cycle</p>
      </DetailDisclosure>,
    )
    expect(screen.getByText('Details').closest('details')?.open).toBe(false)

    rerender(
      <DetailDisclosure label="Details" open onOpenChange={vi.fn()}>
        <p>Per cycle</p>
      </DetailDisclosure>,
    )
    expect(screen.getByText('Details').closest('details')?.open).toBe(true)
  })

  it('hides only the summary at lg so desktop shows the body without a toggle', () => {
    render(
      <DetailDisclosure label="Details" open expandedFrom="lg" onOpenChange={vi.fn()}>
        <p>Per cycle</p>
      </DetailDisclosure>,
    )

    const summary = screen.getByText('Details').closest('summary') as HTMLElement
    expect(summary.className).toContain('lg:hidden')
    expect(screen.getByText('Per cycle')).toBeTruthy()
  })

  it('keeps a 44px summary target on phones', () => {
    render(
      <DetailDisclosure label="Details" open={false} onOpenChange={vi.fn()}>
        <p>Per cycle</p>
      </DetailDisclosure>,
    )

    const summary = screen.getByText('Details').closest('summary') as HTMLElement
    expect(summary.className).toContain('min-h-11')
  })

  it('renders an aside chip beside the label', () => {
    render(
      <DetailDisclosure label="Schedule" aside={<span>120</span>} open={false} onOpenChange={vi.fn()}>
        <p>Rows</p>
      </DetailDisclosure>,
    )

    expect(screen.getByText('120')).toBeTruthy()
  })
})
