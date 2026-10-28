import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DataTablePagination } from './DataTable'

describe('DataTablePagination', () => {
  const defaultProps = {
    currentPage: 1,
    pageSize: 10,
    totalItems: 5,
    totalPages: 1,
    onPageChange: vi.fn(),
    onPageSizeChange: vi.fn(),
  }

  it('renders nothing for totalItems: 5, totalPages: 1, pageSize: 10', () => {
    const { container } = render(
      <DataTablePagination
        {...defaultProps}
        totalItems={5}
        totalPages={1}
        pageSize={10}
      />,
    )
    expect(container.firstChild).toBeNull()
    expect(screen.queryByText(/Showing/)).toBeNull()
    expect(screen.queryByText(/Rows per page/)).toBeNull()
  })

  it('renders the footer for totalItems: 30, totalPages: 3', () => {
    render(
      <DataTablePagination
        {...defaultProps}
        totalItems={30}
        totalPages={3}
        pageSize={10}
      />,
    )
    expect(screen.getByText(/Showing/)).toBeTruthy()
    expect(screen.getByText(/Rows per page/)).toBeTruthy()
  })

  it('renders the footer for totalItems: 5, totalPages: 1, serverIsFetching: true', () => {
    render(
      <DataTablePagination
        {...defaultProps}
        totalItems={5}
        totalPages={1}
        pageSize={10}
        serverIsFetching
      />,
    )
    expect(screen.getByText(/Loading entries/)).toBeTruthy()
  })

  it('renders the footer for totalItems: 20, totalPages: 1, pageSize: 50 (20 > smallest option 10, so the size picker stays)', () => {
    render(
      <DataTablePagination
        {...defaultProps}
        totalItems={20}
        totalPages={1}
        pageSize={50}
        pageSizeOptions={[10, 25, 50]}
      />,
    )
    expect(screen.getByText(/Showing/)).toBeTruthy()
    expect(screen.getByText(/Rows per page/)).toBeTruthy()
  })
})
