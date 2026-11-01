import type { ReactNode } from 'react'
import type { Passage } from '../../domain/content/passages'

export function PassageSummary({
  passage,
  meta,
  subtitle = passage.subtitle,
}: {
  passage: Passage
  meta?: ReactNode
  subtitle?: string | null
}) {
  return (
    <div className="passage-header">
      <div>
        <span className="tag">{passage.genre}</span>
        {meta && <span className="muted small">{meta}</span>}
        <h2>{passage.title}</h2>
        {subtitle && <p>{subtitle}</p>}
        {passage.source?.url ? (
          <a
            className="text-button"
            href={passage.source.url}
            target="_blank"
            rel="noreferrer"
          >
            出典：{passage.source.label}
          </a>
        ) : passage.source ? (
          <p className="small muted">出典：{passage.source.label}</p>
        ) : null}
      </div>
      <span className="passage-symbol">{passage.accent}</span>
    </div>
  )
}
