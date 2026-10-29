import type { ReadingSegment } from '../../domain/content/sentences'

export function RubyToken({
  text,
  reading,
  active = false,
}: ReadingSegment & { active?: boolean }) {
  const base = (
    <span className="token-text" aria-current={active ? 'location' : undefined}>
      {text}
    </span>
  )
  return /[一-龯々]/u.test(text) ? (
    <ruby>
      {base}
      <rt>{reading}</rt>
    </ruby>
  ) : (
    base
  )
}
export function RubyText({ segments }: { segments: ReadingSegment[] }) {
  return (
    <>
      {segments.map((segment, index) => (
        <RubyToken key={index} {...segment} />
      ))}
    </>
  )
}
