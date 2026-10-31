import type { analyzeTrace } from '../../domain/records/telemetry'
import { chartAxis } from '../../domain/records/chartAxis'
import { movingPace } from '../../domain/records/pace'
type Bucket = ReturnType<typeof analyzeTrace>['buckets'][number]
export function ChartYAxis({
  max,
  unit = 'KPM',
}: {
  max: number
  unit?: string
}) {
  const axis = chartAxis(max)
  return (
    <g className="chart-y-axis">
      <text x="8" y="14">
        {unit}
      </text>
      {axis.ticks.map(({ value, major }) => (
        <g key={value} data-tick={major ? 'major' : 'minor'}>
          <line
            x1="58"
            x2="618"
            y1={140 - (value / axis.max) * 115}
            y2={140 - (value / axis.max) * 115}
          />
          {major && (
            <text x="50" y={144 - (value / axis.max) * 115} textAnchor="end">
              {value}
            </text>
          )}
        </g>
      ))}
      <line x1="58" x2="58" y1="25" y2="140" />
    </g>
  )
}
export function PaceChart({
  buckets,
  elapsed,
}: {
  buckets: Bucket[]
  elapsed: number
}) {
  const samples = buckets.filter((b) => b.time * 1000 <= elapsed)
  const axis = chartAxis(Math.max(0, ...samples.map((b) => b.kpm)))
  const max = axis.max
  const average = movingPace(samples.map((b) => b.kpm))
  const x = (time: number) => 58 + (time * 1000 * 560) / Math.max(1, elapsed)
  const y = (kpm: number) => 144 - (kpm / max) * 116
  return (
    <svg
      className="result-pace"
      viewBox="0 0 640 180"
      role="img"
      aria-label="1秒ごとのKPMとミス"
    >
      <text x="8" y="14">
        KPM
      </text>
      {axis.ticks.map(({ value, major }) => (
        <g
          key={value}
          className="pace-axis"
          data-tick={major ? 'major' : 'minor'}
        >
          <line x1="58" x2="618" y1={y(value)} y2={y(value)} />
          {major && (
            <text x="50" y={y(value) + 4} textAnchor="end">
              {value}
            </text>
          )}
        </g>
      ))}
      <line className="pace-axis" x1="58" x2="58" y1="28" y2="144" />
      <polyline
        points={samples.map((b) => `${x(b.time)},${y(b.kpm)}`).join(' ')}
      />
      <polyline
        className="pace-moving"
        points={average.map((b) => `${x(b.time)},${y(b.kpm)}`).join(' ')}
      >
        <title>5秒移動平均</title>
      </polyline>
      {!samples.length && (
        <text x="338" y="88" textAnchor="middle">
          1秒未満のため速度区間なし
        </text>
      )}
      {samples.map((b, i) => (
        <circle
          key={i}
          cx={x(b.time)}
          cy={y(b.kpm)}
          r={b.misses ? Math.min(8, 3 + b.misses) : 2}
          data-miss={b.misses > 0}
        >
          <title>
            {b.time}秒: {b.kpm.toFixed(1)}KPM / {b.misses}ミス
          </title>
        </circle>
      ))}
      <text x="338" y="14" textAnchor="middle">
        シアン：1秒KPM / 紫：5秒移動平均
      </text>
      <text x="58" y="168">
        0秒
      </text>
      <text x="618" y="168" textAnchor="end">
        {(elapsed / 1000).toFixed(2)}秒
      </text>
    </svg>
  )
}
