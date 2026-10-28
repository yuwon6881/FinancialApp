import { fireEvent, render, screen } from '@testing-library/react'
import { useContext, useState } from 'react'
import { describe, expect, it } from 'vitest'
import { FormField } from './FormField'
import { FormFieldContext } from './formFieldControl'
import { Input } from './Input'

describe('FormField', () => {
  it('renders a real <label htmlFor> when a control child is mounted, and screen.getByLabelText finds the input', () => {
    const { container } = render(
      <FormField label="Email address" required>
        <Input />
      </FormField>,
    )

    const label = container.querySelector('label')
    expect(label).not.toBeNull()
    const input = screen.getByLabelText(/Email address/)
    expect(input).toBeDefined()
    expect(label?.getAttribute('for')).toBe(input.getAttribute('id'))
    expect(label?.getAttribute('id')).toMatch(/-label$/)
  })

  it('associates label.htmlFor and label.control with the input control so clicking it targets the control', () => {
    const { container } = render(
      <FormField label="Full Name">
        <Input />
      </FormField>,
    )

    const label = container.querySelector('label') as HTMLLabelElement
    const input = screen.getByRole('textbox') as HTMLInputElement
    expect(label).not.toBeNull()
    expect(label.htmlFor).toBe(input.id)
    expect(label.control).toBe(input)
  })

  it('renders no <label> element when children are a group without a control carrying the field id', () => {
    function GroupChild() {
      const field = useContext(FormFieldContext)
      return (
        <div role="radiogroup" aria-labelledby={field?.labelledBy}>
          <button type="button" role="radio" aria-checked="false">
            Option A
          </button>
          <button type="button" role="radio" aria-checked="false">
            Option B
          </button>
        </div>
      )
    }

    const { container } = render(
      <FormField label="Category" required>
        <GroupChild />
      </FormField>,
    )

    // FormField must NOT render any orphan <label>
    expect(container.querySelector('label')).toBeNull()

    // The text must be rendered in a span whose id ends with -label
    const span = container.querySelector('span[id$="-label"]')
    expect(span).not.toBeNull()
    expect(span?.textContent).toContain('Category')
    expect(span?.className).toContain('text-label')

    // The group's aria-labelledby references the span's id
    const group = screen.getByRole('radiogroup')
    expect(group.getAttribute('aria-labelledby')).toBe(span?.getAttribute('id'))
  })

  it('switches from span to <label htmlFor> when a control appears later', () => {
    function DynamicField() {
      const [hasInput, setHasInput] = useState(false)
      return (
        <FormField label="Dynamic Field">
          <button type="button" onClick={() => setHasInput(true)}>
            Show Input
          </button>
          {hasInput && <Input />}
        </FormField>
      )
    }

    const { container } = render(<DynamicField />)

    // Before input is mounted: rendered as span, no label
    expect(container.querySelector('label')).toBeNull()
    const span = container.querySelector('span[id$="-label"]')
    expect(span).not.toBeNull()
    expect(span?.textContent).toBe('Dynamic Field')

    // Mount the input control
    fireEvent.click(screen.getByRole('button', { name: 'Show Input' }))

    // Now it should switch to a <label htmlFor>
    expect(container.querySelector('span[id$="-label"]')).toBeNull()
    const label = container.querySelector('label')
    expect(label).not.toBeNull()
    const input = screen.getByRole('textbox')
    expect(label?.getAttribute('for')).toBe(input.getAttribute('id'))
    expect(screen.getByLabelText('Dynamic Field')).toBe(input)
  })

  it('switches from <label htmlFor> back to span when a control is unmounted', () => {
    function ToggleField() {
      const [showControl, setShowControl] = useState(true)
      return (
        <FormField label="Toggle Field">
          <button type="button" onClick={() => setShowControl(prev => !prev)}>
            Toggle
          </button>
          {showControl && <Input />}
        </FormField>
      )
    }

    const { container } = render(<ToggleField />)

    expect(container.querySelector('label')).not.toBeNull()

    // Unmount the control
    fireEvent.click(screen.getByRole('button', { name: 'Toggle' }))

    expect(container.querySelector('label')).toBeNull()
    const span = container.querySelector('span[id$="-label"]')
    expect(span).not.toBeNull()
    expect(span?.textContent).toBe('Toggle Field')
  })

  it('renders labelAction beside the label element without nesting it inside the label', () => {
    const { container } = render(
      <FormField
        label="Account"
        labelAction={<button type="button" aria-label="Info">Info</button>}
      >
        <Input />
      </FormField>,
    )

    const label = container.querySelector('label')
    expect(label).not.toBeNull()
    const actionButton = screen.getByRole('button', { name: 'Info' })
    expect(actionButton).toBeDefined()
    expect(label?.contains(actionButton)).toBe(false)
  })

  it('renders required indicator with aria-hidden asterisk and sr-only required text', () => {
    const { container } = render(
      <FormField label="Required Field" required>
        <div role="radiogroup">
          <button type="button">Group option</button>
        </div>
      </FormField>,
    )

    const span = container.querySelector('span[id$="-label"]')
    expect(span).not.toBeNull()
    const star = span?.querySelector('span[aria-hidden="true"]')
    expect(star?.textContent).toBe('*')
    const srOnly = span?.querySelector('span.sr-only')
    expect(srOnly?.textContent).toBe(' (required)')
  })
})
