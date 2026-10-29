import { useState, type CSSProperties, type ReactNode } from 'react'

export function MissionCarousel({
  stage,
  onStage,
  children,
  hasResult = false,
}: {
  stage: number
  onStage: (stage: number) => void
  hasResult?: boolean
  children: ReactNode[]
}) {
  const [motion, setMotion] = useState({ stage, direction: 1 })
  if (motion.stage !== stage) {
    setMotion({ stage, direction: stage > motion.stage ? 1 : -1 })
  }
  return (
    <div className="mission-carousel" data-stage={stage}>
      <nav className="mission-steps" aria-label="練習ステップ">
        {['文章選択', '全文確認', '入力', '結果']
          .slice(0, children.length)
          .map((label, index) => (
            <button
              key={label}
              aria-label={index === 2 ? '入力へ進む' : `${label}へ`}
              disabled={index === 3 && !hasResult}
              aria-current={stage === index ? 'step' : undefined}
              onClick={() => onStage(index)}
            >
              <small>0{index + 1}</small>
              {label}
              <span aria-hidden="true">{stage === index ? '◈' : '◇'}</span>
            </button>
          ))}
      </nav>
      <div
        className="mission-viewport"
        style={{ '--slide-direction': motion.direction } as CSSProperties}
      >
        {children.map((child, index) => (
          <div
            key={index}
            className={`mission-face ${stage === index ? 'is-active' : ''}`}
            data-face={index}
            aria-hidden={stage !== index}
            inert={stage !== index}
            style={{ '--direction': index < stage ? -1 : 1 } as CSSProperties}
          >
            {child}
          </div>
        ))}
      </div>
    </div>
  )
}
