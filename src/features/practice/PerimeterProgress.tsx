import { useLayoutEffect, useRef, useState } from 'react'

/** Four equal rounded paths run from the side midpoints to the top/bottom midpoint. */
export function PerimeterProgress({
  progress,
  animate,
}: {
  progress: number
  animate: boolean
}) {
  const svg = useRef<SVGSVGElement>(null)
  const [frame, setFrame] = useState({ width: 0, height: 0, radius: 0 })
  useLayoutEffect(() => {
    const element = svg.current
    const host = element?.parentElement
    if (!element || !host) return
    const measure = () => {
      // Computed dimensions stay in CSS pixels, including when display zoom changes.
      const style = getComputedStyle(element)
      const next = {
        width: parseFloat(style.width) || 0,
        height: parseFloat(style.height) || 0,
        radius: parseFloat(getComputedStyle(host).borderTopLeftRadius) || 0,
      }
      setFrame((previous) =>
        previous.width === next.width &&
        previous.height === next.height &&
        previous.radius === next.radius
          ? previous
          : next,
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(host)
    return () => observer.disconnect()
  }, [])
  const value = Number.isFinite(progress)
    ? Math.max(0, Math.min(100, progress))
    : 0
  const { width, height } = frame
  const inset = 0.5
  const radius = Math.max(
    0,
    Math.min(frame.radius - 1 - inset, width / 2 - inset, height / 2 - inset),
  )
  const path = `M ${inset} ${height / 2} V ${inset + radius} A ${radius} ${radius} 0 0 1 ${inset + radius} ${inset} H ${width / 2}`
  const mirrors = [
    undefined,
    `translate(${width} 0) scale(-1 1)`,
    `translate(0 ${height}) scale(1 -1)`,
    `translate(${width} ${height}) scale(-1 -1)`,
  ]
  return (
    <svg
      ref={svg}
      className="perimeter-progress"
      viewBox={`0 0 ${width || 1} ${height || 1}`}
      preserveAspectRatio="none"
      role="progressbar"
      aria-label="練習の進捗"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.floor(value)}
      data-animate={(animate && value > 0) || undefined}
      data-progress={value}
    >
      {width > 0 && height > 0 && (
        <g aria-hidden="true" opacity={value > 0 ? 1 : 0}>
          {mirrors.map((transform, index) => (
            <g key={index} transform={transform}>
              {['glow', 'line'].map((layer) => (
                <path
                  key={layer}
                  className={`perimeter-progress-${layer}`}
                  d={path}
                  pathLength={1}
                  strokeDasharray="1 1"
                  style={{ strokeDashoffset: 1 - value / 100 }}
                />
              ))}
            </g>
          ))}
        </g>
      )}
    </svg>
  )
}
