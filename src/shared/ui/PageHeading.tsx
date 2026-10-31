import type { ReactNode } from 'react'

export function PageHeading({
  eyebrow,
  title,
  actions,
  children,
  className = '',
}: {
  eyebrow: string
  title: string
  actions?: ReactNode
  children?: ReactNode
  className?: string
}) {
  return (
    <header className={`section-heading page-heading ${className}`}>
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        {children}
      </div>
      {actions && <div className="page-heading-actions">{actions}</div>}
    </header>
  )
}
