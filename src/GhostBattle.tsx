import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { RecordEntry, Settings } from './storage'
import type { SessionTrace } from './telemetry'
import { readTrace } from './traceStore'
import { GhostRace } from './ghost'
import { mapKey } from './engine'
import { SentenceView } from './SentenceView'
import { KeyboardGuide } from './KeyboardGuide'
import { SessionResult } from './SessionResult'
import { formatMissRate } from './scoring'

export default function GhostBattle({
  record,
  settings,
  onClose,
  onRecord,
}: {
  record: RecordEntry
  settings: Settings
  onClose: () => void
  onRecord: (record: RecordEntry) => void
}) {
  const [loaded, setLoaded] = useState<{ trace?: RecordEntry['trace'] } | null>(
    record.trace ? { trace: record.trace } : null,
  )
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (record.trace) return
    let cancelled = false
    void readTrace(record.id).then((trace) => {
      if (!cancelled) setLoaded({ trace })
    })
    return () => {
      cancelled = true
    }
  }, [record.id, record.trace])
  return (
    <section className="ghost-battle" aria-label="ゴースト対戦">
      <div className="detail-heading">
        <div>
          <span className="eyebrow">RACE YOUR PAST</span>
          <h2>ゴースト対戦</h2>
          <p>
            {record.title} · {record.layout} ·{' '}
            {new Date(record.date).toLocaleString('ja-JP')}
          </p>
          {record.seed && (
            <p>
              固定シード: {record.seed} / v{record.replayVersion ?? 1}
            </p>
          )}
        </div>
        <button className="text-button" onClick={onClose}>
          記録へ戻る
        </button>
      </div>
      {!loaded ? (
        <p role="status">ゴーストの打鍵ログを読み込み中…</p>
      ) : !loaded.trace ? (
        <p role="status">
          この記録には打鍵ログがないため、ゴースト対戦できません。
        </p>
      ) : (
        <GhostAttempt
          key={attempt}
          record={record}
          trace={loaded.trace}
          settings={settings}
          onRecord={onRecord}
          onRetry={() => setAttempt((n) => n + 1)}
        />
      )}
    </section>
  )
}
function GhostAttempt({
  record,
  trace,
  settings,
  onRecord,
  onRetry,
}: {
  record: RecordEntry
  trace: SessionTrace
  settings: Settings
  onRecord: (record: RecordEntry) => void
  onRetry: () => void
}) {
  const [prepared] = useState(() => {
    try {
      return { race: new GhostRace(record, trace) }
    } catch (error) {
      return {
        error:
          error instanceof Error ? error.message : '対戦を準備できません。',
      }
    }
  })
  return prepared.race ? (
    <GhostSession
      race={prepared.race}
      settings={settings}
      onRecord={onRecord}
      onRetry={onRetry}
    />
  ) : (
    <p role="status">{prepared.error}</p>
  )
}
function GhostSession({
  race,
  settings,
  onRecord,
  onRetry,
}: {
  race: GhostRace
  settings: Settings
  onRecord: (record: RecordEntry) => void
  onRetry: () => void
}) {
  const [status, setStatus] = useState<'ready' | 'running' | 'paused' | 'done'>(
    'ready',
  )
  const [result, setResult] = useState<RecordEntry | null>(null)
  const [, render] = useState(0)
  const phase = useRef(status)
  const area = useRef<HTMLDivElement>(null)
  const clock = useRef({ accumulated: 0, started: 0 })
  const saved = useRef(false)
  const synchronize = () => {
    const { accumulated, started } = clock.current
    const now =
      accumulated +
      (phase.current === 'running' ? performance.now() - started : 0)
    race.advance(now)
    return now
  }
  const pause = () => {
    if (phase.current !== 'running') return
    clock.current.accumulated = synchronize()
    phase.current = 'paused'
    setStatus('paused')
  }
  useEffect(() => {
    const timer = setInterval(() => {
      if (phase.current === 'running') {
        synchronize()
        render((n) => n + 1)
      }
    }, 16)
    const hidden = () => {
      if (document.hidden) pause()
    }
    document.addEventListener('visibilitychange', hidden)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', hidden)
    }
    // The race and clock are owned by this keyed attempt; no settings are captured.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [race])
  const resume = () => {
    if (phase.current === 'paused') {
      clock.current.started = performance.now()
      phase.current = 'running'
      setStatus('running')
    }
    area.current?.focus()
  }
  const accept = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      pause()
      return
    }
    if (
      event.repeat ||
      event.nativeEvent.isComposing ||
      event.ctrlKey ||
      event.altKey ||
      event.metaKey ||
      phase.current === 'paused' ||
      phase.current === 'done'
    )
      return
    const key = mapKey(
      event.nativeEvent,
      race.source.layout,
      race.engine.target[race.engine.position],
    )
    if (!key) return
    event.preventDefault()
    if (phase.current === 'ready') {
      clock.current.started = performance.now()
      phase.current = 'running'
      setStatus('running')
    }
    race.feed(key, synchronize())
    if (race.finished) {
      phase.current = 'done'
      setStatus('done')
      if (!saved.current) {
        saved.current = true
        const record = race.record()
        setResult(record)
        onRecord(record)
      }
    }
    render((n) => n + 1)
  }
  if (result)
    return (
      <SessionResult
        record={result}
        heading={race.result}
        variant={
          race.result === 'YOU WIN'
            ? 'win'
            : race.result === 'GHOST WIN'
              ? 'loss'
              : 'neutral'
        }
        message={`ゴースト到達 ${(race.finishTime / 1000).toFixed(2)}秒`}
        actions={
          <button className="primary-button" onClick={onRetry}>
            同じゴーストと再挑戦
          </button>
        }
      />
    )
  const frame = race.ghost(race.elapsed, status === 'ready')
  const player = race.playerDistance
  const ghost = status === 'ready' ? 0 : race.ghostDistance()
  const lead =
    player === ghost
      ? '同じ位置'
      : player > ghost
        ? 'YOU が先行'
        : 'GHOST が先行'
  const playerMiss =
    status === 'running' && race.elapsed - race.lastMistake <= 180
  return (
    <>
      <p className="small muted">
        保存時と同じ文章順・配列で、ログの到達地点までを競います。最初の打鍵で同時にスタート。途中終了の文は保存時の到達地点で次へ進みます。休止・CPU幕間は除き、ミスを含む打鍵時刻をそのまま再現します。
      </p>
      <div className="ghost-scoreboard">
        <strong role="status">{status === 'done' ? race.result : lead}</strong>
        <span>
          {(race.elapsed / 1000).toFixed(2)}秒 · ゴースト到達{' '}
          {(race.finishTime / 1000).toFixed(2)}秒
        </span>
        <label>
          YOU{' '}
          <progress
            aria-label="あなたの進捗"
            max={race.distance}
            value={player}
          />
          {((player / race.distance) * 100).toFixed(1)}%
        </label>
        <label>
          GHOST{' '}
          <progress
            aria-label="ゴーストの進捗"
            max={race.distance}
            value={ghost}
          />
          {((ghost / race.distance) * 100).toFixed(1)}%
        </label>
      </div>
      <div className="replay-controls">
        {status === 'running' ? (
          <button
            onPointerDown={(event) => event.preventDefault()}
            onClick={pause}
          >
            対戦を一時停止
          </button>
        ) : (
          status !== 'done' && (
            <button onClick={resume}>
              {status === 'paused' ? '対戦を再開' : '入力にフォーカス'}
            </button>
          )
        )}
        <button onClick={onRetry}>同じゴーストと再挑戦</button>
        <span role="status">
          {
            {
              ready: '入力待ち',
              running: '対戦中',
              paused: '一時停止中',
              done: '対戦終了・記録保存',
            }[status]
          }
        </span>
      </div>
      <div
        ref={area}
        tabIndex={0}
        role="region"
        aria-label="ゴースト対戦の入力領域。IMEをオフにして入力"
        className={`ghost-player ${playerMiss ? 'replay-mistake' : ''}`}
        onKeyDown={accept}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) pause()
        }}
      >
        <h3>
          YOU · 問題 {race.goal.prompt + 1} / {race.timeline.sentences.length}
          {!race.goal.complete && ' · 保存時の到達地点まで'}
        </h3>
        <p className="small">
          実ミス {race.misses.raw} ·{' '}
          {formatMissRate(race.correct, race.misses.raw)} ·{' '}
          {race.elapsed > 0
            ? ((race.correct * 60000) / race.elapsed).toFixed(1)
            : '0.0'}{' '}
          KPM
        </p>
        <SentenceView
          current={race.sentence}
          position={race.engine.position}
          kana={recordKana(race)}
          done={race.finished}
          target={race.engine.target}
          typed={race.typed}
          hint={race.engine.hint}
          wordColors={settings.wordColors}
          consumeTyped={settings.consumeTyped}
          showNext={false}
          partialRoman={!!race.source.strokeLimit}
        />
      </div>
      <div
        className={`ghost-opponent ${frame.mistake && status === 'running' ? 'replay-mistake' : ''}`}
        aria-label="ゴーストの入力"
        role="region"
      >
        <h3>
          GHOST · 問題 {frame.prompt + 1} / {race.timeline.sentences.length}
        </h3>
        <p className="small" data-ghost-event>
          実ミス {frame.misses} · {frame.kpm.toFixed(1)} KPM ·{' '}
          {frame.last
            ? `入力 ${frame.last.key === ' ' ? 'Space' : frame.last.key} / ${frame.last.correct ? '正解' : 'ミス'}`
            : '入力前'}
        </p>
        <SentenceView
          current={frame.sentence}
          position={frame.position}
          kana={recordKana(race)}
          done={frame.done}
          target={frame.target}
          typed={frame.typed}
          hint={frame.hint}
          wordColors={false}
          consumeTyped={false}
          showNext={false}
          partialRoman={!!race.source.strokeLimit}
        />
      </div>
      <KeyboardGuide
        layout={race.source.layout}
        nextCharacter={
          recordKana(race)
            ? (race.engine.target[race.engine.position] ?? '')
            : (race.engine.hint[0] ?? '')
        }
        enabled={status === 'running' || status === 'ready'}
      />
    </>
  )
}
const recordKana = (race: GhostRace) => race.source.layout === 'kana'
