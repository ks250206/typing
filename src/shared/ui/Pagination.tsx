export function Pagination({
  total,
  page,
  size,
  onPage,
  label,
}: {
  total: number
  page: number
  size: number
  onPage: (page: number) => void
  label: string
}) {
  const pages = Math.max(1, Math.ceil(total / size))
  return (
    <nav className="pagination" aria-label={label}>
      <span role="status" aria-live="polite">
        {total ? page * size + 1 : 0}–{Math.min(total, (page + 1) * size)} /{' '}
        {total}件 · {page + 1} / {pages}ページ
      </span>
      <div>
        <button disabled={page === 0} onClick={() => onPage(0)}>
          最初
        </button>
        <button disabled={page === 0} onClick={() => onPage(page - 1)}>
          前へ
        </button>
        <button disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>
          次へ
        </button>
        <button disabled={page >= pages - 1} onClick={() => onPage(pages - 1)}>
          最後
        </button>
      </div>
    </nav>
  )
}
