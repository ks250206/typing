import { useState } from 'react'

export function usePagination(total: number, size = 20) {
  const [requested, setPage] = useState(0)
  const pages = Math.max(1, Math.ceil(total / size))
  const page = Math.min(requested, pages - 1)
  return { page, setPage, pages, size, start: page * size }
}
