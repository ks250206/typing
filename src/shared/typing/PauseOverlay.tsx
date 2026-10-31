import { Play } from 'lucide-react'

/** Shared paused state for practice and CPU play. */
export function PauseOverlay({
  onResume,
  description = 'Space / Esc / Enter で再開 · R でやり直す',
}: {
  onResume: () => void
  description?: string
}) {
  return (
    <div
      className="practice-overlay"
      data-phase="paused"
      role="group"
      aria-label="一時停止中"
    >
      <span className="practice-pause-label">PAUSED</span>
      <button className="practice-start-button" onClick={onResume}>
        <Play size={24} />
        再開する
      </button>
      <p>{description}</p>
    </div>
  )
}
