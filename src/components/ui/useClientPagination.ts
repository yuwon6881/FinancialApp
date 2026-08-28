import { useEffect, useMemo, useState } from 'react'

export function useClientPagination(totalItems: number, pageSize = 9, revealIndex = -1) {
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))

  useEffect(() => {
    setPage(current => Math.min(current, totalPages))
  }, [totalPages])

  useEffect(() => {
    if (revealIndex >= 0) setPage(Math.floor(revealIndex / pageSize) + 1)
  }, [pageSize, revealIndex])

  return useMemo(() => ({
    page,
    setPage,
    pageSize,
    totalPages,
    start: (page - 1) * pageSize,
    end: page * pageSize,
  }), [page, pageSize, totalPages])
}
