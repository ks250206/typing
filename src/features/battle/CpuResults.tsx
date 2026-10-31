import type { RecordEntry } from '../../domain/records/types'
import type { RtcMatch } from '../../domain/battle/cpuMatch'
import { scorePoint } from '../../domain/typing/scoring'
import { SessionResult } from '../results/SessionResult'
export function CpuResults({
  match,
  history,
  result,
  onNext,
  onRematch,
}: {
  match: RtcMatch
  history: RecordEntry[]
  result: RecordEntry | null
  onNext: () => void
  onRematch: () => void
}) {
  const complete = match.phase === 'finished'
  const round = match.roundResults.at(-1)!
  const record: RecordEntry = result ?? {
    id: `round-${match.roundResults.length}`,
    passageId: 'cpu-round',
    title: `ROUND ${match.roundResults.length}`,
    date: match.startedAt,
    layout: match.layout,
    mode: 'cpu',
    keys: round.keys,
    actualKeys: round.keys,
    misses: round.misses,
    rawMisses: round.raw,
    missPenalty: round.penalty,
    elapsed: round.elapsed,
    kpm: Math.round((round.keys * 60000) / Math.max(1, round.elapsed)),
    accuracy: round.accuracy * 100,
    trace: round.trace,
  }
  const win = complete ? match.roundsPlayer >= 4 : round.winner === 'player'
  return (
    <div
      className="cpu-results"
      data-result={complete ? (win ? 'victory' : 'defeat') : 'round'}
    >
      <SessionResult
        key={complete ? 'final' : match.roundResults.length}
        record={record}
        history={history}
        variant={win ? 'win' : 'loss'}
        heading={
          complete
            ? win
              ? 'VICTORY / 勝利'
              : 'CPU WINS / 敗北'
            : `ROUND ${match.roundResults.length} · ${win ? 'ラウンド獲得' : 'CPUがラウンド獲得'}`
        }
        message={
          complete
            ? `ラウンド ${match.roundsPlayer} : ${match.roundsCpu} / BO7 終了`
            : `${round.player} : ${round.cpu} / 10点先取${round.reversal ? ' · 正確率95%ルールによる逆転' : ''}`
        }
        actions={
          complete ? (
            <button
              className="primary-button"
              aria-keyshortcuts="r"
              onClick={onRematch}
            >
              再戦する
            </button>
          ) : (
            <button
              className="primary-button"
              aria-keyshortcuts="n s Space Enter"
              onClick={onNext}
            >
              次のラウンド
            </button>
          )
        }
      />
      <div className="round-reports" aria-label="ラウンド別の結果">
        <h3>ラウンド別の結果</h3>
        {match.roundResults.map((r, index) => (
          <details key={index}>
            <summary>
              ROUND {index + 1} · {r.player} : {r.cpu} ·{' '}
              {r.winner === 'player' ? 'YOU WIN' : 'CPU WIN'}
              {r.reversal ? ' · 正確率逆転' : ''}
            </summary>
            <p>
              {scorePoint(r.keys, r.penalty, r.elapsed)} pt ·{' '}
              {(r.accuracy * 100).toFixed(2)}% · 実ミス {r.raw} ·{' '}
              {(r.elapsed / 1000).toFixed(2)}秒
            </p>
          </details>
        ))}
      </div>
    </div>
  )
}
