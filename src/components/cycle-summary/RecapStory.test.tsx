import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { RecapStory, type RecapStep } from './RecapStory'

const steps: RecapStep[] = [
  { id: 'net', title: 'The bottom line', node: <p>Net figures</p> },
  { id: 'buckets', title: 'Your buckets', node: <p>Bucket figures</p> },
  { id: 'where', title: 'Where it went', node: <p>Category figures</p> },
]

function Harness() {
  const [step, setStep] = useState(0)
  return <RecapStory steps={steps} step={step} onStepChange={setStep} />
}

describe('RecapStory', () => {
  it('shows one chapter at a time and moves with Next and Back', () => {
    render(<Harness />)
    expect(screen.getByRole('heading', { name: 'The bottom line' })).toBeTruthy()
    expect(screen.queryByText('Bucket figures')).toBeNull()
    expect((screen.getByRole('button', { name: /Back/ }) as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: /^Your buckets/ }))
    expect(screen.getByText('Bucket figures')).toBeTruthy()
    expect(screen.getByText('2 of 3')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Back/ }))
    expect(screen.getByText('Net figures')).toBeTruthy()
  })

  it('jumps from the chapter segments and turns pages with the arrow keys', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Chapter 3: Where it went' }))
    expect(screen.getByRole('button', { name: 'Chapter 3: Where it went' }).getAttribute('aria-current')).toBe('step')
    // The last chapter has nowhere further to go.
    expect(screen.queryByRole('button', { name: /^Where it went/ })).toBeNull()

    fireEvent.keyDown(screen.getByText('Category figures'), { key: 'ArrowLeft' })
    expect(screen.getByText('Bucket figures')).toBeTruthy()
    fireEvent.keyDown(screen.getByText('Bucket figures'), { key: 'ArrowRight' })
    expect(screen.getByText('Category figures')).toBeTruthy()
  })

  it('turns the page on a sideways swipe but not on a vertical scroll', () => {
    render(<Harness />)
    const content = screen.getByText('Net figures')
    fireEvent.touchStart(content, { touches: [{ clientX: 300, clientY: 400 }] })
    fireEvent.touchEnd(content, { changedTouches: [{ clientX: 290, clientY: 200 }] })
    expect(screen.getByText('Net figures')).toBeTruthy()

    fireEvent.touchStart(content, { touches: [{ clientX: 300, clientY: 400 }] })
    fireEvent.touchEnd(content, { changedTouches: [{ clientX: 180, clientY: 410 }] })
    expect(screen.getByText('Bucket figures')).toBeTruthy()
  })
})
