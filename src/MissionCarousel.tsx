import type { ReactNode } from 'react'

export function MissionCarousel({
  stage,
  onStage,
  children,
}: {
  stage: number
  onStage: (stage: number) => void
  children: ReactNode[]
}) {
  return (
    <div className="mission-carousel" data-stage={stage}>
      <nav className="mission-steps" aria-label="練習ステップ">
        {['文章選択', '全文確認', '入力'].map((label, index) => (
          <button
            key={label}
            aria-label={index === 2 ? '入力へ進む' : `${label}へ`}
            aria-current={stage === index ? 'step' : undefined}
            onClick={() => onStage(index)}
          >
            <small>0{index + 1}</small>
            {label}
            <span aria-hidden="true">{stage === index ? '◈' : '◇'}</span>
          </button>
        ))}
      </nav>
      <div className="mission-viewport">
        <div className="mission-sweep" key={stage} aria-hidden="true" />
        {children.map((child, index) => (
          <div
            key={index}
            className={`mission-face ${stage === index ? 'is-active' : ''}`}
            data-face={index}
            aria-hidden={stage !== index}
            inert={stage !== index}
            style={
              { '--direction': index < stage ? -1 : 1 } as React.CSSProperties
            }
          >
            {child}
          </div>
        ))}
      </div>
    </div>
  )
}
