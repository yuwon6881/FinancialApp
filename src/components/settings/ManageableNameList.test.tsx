import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ManageableNameList } from './ManageableNameList'

describe('ManageableNameList', () => {
  const items = [
    { id: '1', name: 'Receipt', count: 2 },
    { id: '2', name: 'Invoice', count: 0 },
  ]

  it('filters items and prevents duplicate names', () => {
    render(
      <ManageableNameList
        items={items}
        itemLabel="Document type"
        addPlaceholder="New Document Type"
        onAdd={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'inv' } })
    expect(screen.getByText('Invoice')).toBeTruthy()
    expect(screen.queryByText('Receipt')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Clear document type search' }))
    expect(screen.getByText('Receipt')).toBeTruthy()

    fireEvent.change(screen.getByPlaceholderText('New Document Type'), { target: { value: 'invoice' } })
    expect(screen.getByText('Document type already exists.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add Document type' }).hasAttribute('disabled')).toBe(true)
  })

  it('renders a stable empty state for an empty list', () => {
    render(
      <ManageableNameList
        items={[]}
        itemLabel="Category"
        addPlaceholder="New Category Name"
        onAdd={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    expect(screen.getByText('No categories yet.')).toBeTruthy()
    expect(screen.getByRole('searchbox')).toBeTruthy()
  })
})
