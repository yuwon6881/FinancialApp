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
})
