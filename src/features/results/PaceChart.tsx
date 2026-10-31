import type { analyzeTrace } from '../../domain/records/telemetry'
type Bucket = ReturnType<typeof analyzeTrace>['buckets'][number]
export function ChartYAxis({
  max,
  unit = 'KPM',
}: {
  max: number
  unit?: string
}) {
  return (
    <g className="chart-y-axis">
      <text x="8" y="14">
        {unit}
      </text>
      {[0, 0.25, 0.5, 0.75, 1].map((scale) => (
        <g key={scale}>
          <line
            x1="58"
            x2="618"
            y1={140 - scale * 115}
            y2={140 - scale * 115}
          />
          <text x="50" y={144 - scale * 115} textAnchor="end">
            {Number((max * scale).toFixed(1))}
          </text>
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
  const max = Math.max(
    60,
    Math.ceil(Math.max(0, ...samples.map((b) => b.kpm)) / 60) * 60,
  )
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
      {[0, 0.25, 0.5, 0.75, 1].map((scale) => (
        <g key={scale} className="pace-axis">
          <line x1="58" x2="618" y1={y(max * scale)} y2={y(max * scale)} />
          <text x="50" y={y(max * scale) + 4} textAnchor="end">
            {Number((max * scale).toFixed(1))}
          </text>
        </g>
      ))}
      <line className="pace-axis" x1="58" x2="58" y1="28" y2="144" />
      <polyline
        points={samples.map((b) => `${x(b.time)},${y(b.kpm)}`).join(' ')}
      />
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
      <text x="58" y="168">
        0秒
      </text>
      <text x="618" y="168" textAnchor="end">
        {(elapsed / 1000).toFixed(2)}秒
      </text>
    </svg>
  )
}
