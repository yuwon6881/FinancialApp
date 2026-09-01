import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Save } from 'lucide-react'
import { MutationButtonContent } from './MutationButtonContent'

describe('MutationButtonContent', () => {
  it('keeps idle and busy variants in one intrinsic-size grid', () => {
    const { container, rerender } = render(
      <MutationButtonContent state={null} entityLabel="targets" idleLabel="Save targets" idleIcon={<Save />} />,
    )
    const content = container.querySelector('[data-mutation-button-content]')
    expect(content?.className).toContain('inline-grid')
    expect(content?.getAttribute('data-mutation-state')).toBe('idle')

    rerender(
      <MutationButtonContent state="saving" entityLabel="targets" idleLabel="Save targets" busyLabel="Saving…" idleIcon={<Save />} />,
    )
    expect(container.querySelector('[data-mutation-button-content]')).toBe(content)
    expect(content?.getAttribute('data-mutation-state')).toBe('saving')
    expect(screen.getByRole('status').textContent).toContain('Saving targets…')
  })

  it('keeps a text-only action compact and replaces its busy label with a centered icon', () => {
    const { container, rerender } = render(
      <MutationButtonContent state={null} entityLabel="bill" idleLabel="Confirm Paid" busyLabel="Confirming…" />,
    )

    const visibleContent = container.querySelector('[data-mutation-visible-content]')
    expect(visibleContent?.querySelector('[data-mutation-visible-icon]')).toBeNull()
    expect(visibleContent?.textContent).toBe('Confirm Paid')

    rerender(
      <MutationButtonContent state="syncing" entityLabel="bill" idleLabel="Confirm Paid" busyLabel="Confirming…" />,
    )
    expect(visibleContent?.querySelector('[data-mutation-visible-icon]')).not.toBeNull()
    expect(visibleContent?.textContent).toBe('')
    expect(screen.getByRole('status').textContent).toContain('Confirming bill…')
  })
})
