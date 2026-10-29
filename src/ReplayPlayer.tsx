import { useEffect, useMemo, useRef, useState } from 'react'
import type { SessionTrace } from './telemetry'
import type { Layout } from './engine'
import { ReplayTimeline } from './replay'
import { SentenceView } from './SentenceView'
import { KeyboardGuide } from './KeyboardGuide'
import { formatMissRate } from './scoring'
const keyLabel = (key: string) =>
  key === ' '
    ? 'Space'
    : key === '\u3099'
      ? '゛'
      : key === '\u309a'
        ? '゜'
        : key
export default function ReplayPlayer({
  trace,
  layout,
  strokeLimit,
}: {
  trace: SessionTrace
  layout: Layout
  strokeLimit?: number
}) {
  const prepared = useMemo(() => {
    try {
      return { timeline: new ReplayTimeline(trace, layout, strokeLimit) }
    } catch (e) {
      return { error: e instanceof Error ? e.message : '再生できません。' }
    }
  }, [trace, layout, strokeLimit])
  const [time, setTime] = useState(0),
    [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState(1),
    [count, setCount] = useState<number | undefined>(0)
  const playhead = useRef(0)
  const timeline = prepared.timeline
  useEffect(() => {
    if (!playing || !timeline) return
    const start = performance.now(),
      base = playhead.current
    const timer = setInterval(() => {
      const next = Math.min(
        trace.elapsed,
        base + (performance.now() - start) * speed,
      )
      playhead.current = next
      setTime(next)
      setCount(undefined)
      if (next >= trace.elapsed) setPlaying(false)
    }, 16)
    const hidden = () => {
      if (document.hidden) setPlaying(false)
    }
    document.addEventListener('visibilitychange', hidden)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', hidden)
    }
  }, [playing, speed, timeline, trace.elapsed])
  if (!timeline) return <p role="status">{prepared.error}</p>
  const frame = timeline.at(time, count)
  const seek = (at: number, exact?: number) => {
    setPlaying(false)
    playhead.current = at
    setTime(at)
    setCount(exact)
  }
  const step = (delta: number) => {
    const next = Math.max(
      0,
      Math.min(trace.strokes.length, frame.count + delta),
    )
    seek(next ? trace.strokes[next - 1].t : 0, next)
  }
  return (
    <section className="replay-player" aria-label="記録リプレイ">
      <div className="replay-controls">
        <button
          onClick={() => {
            if (time >= trace.elapsed) seek(0, 0)
            setPlaying((v) => !v)
          }}
          disabled={!trace.elapsed}
        >
          {playing ? '一時停止' : '再生'}
        </button>
        <button onClick={() => seek(0, 0)}>先頭へ</button>
        <button onClick={() => step(-1)} disabled={!frame.count}>
          前の1打鍵
        </button>
        <button
          onClick={() => step(1)}
          disabled={frame.count === trace.strokes.length}
        >
          次の1打鍵
        </button>
        <label>
          再生速度
          <select
            aria-label="リプレイ速度"
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
          >
            {[0.25, 0.5, 1, 1.5, 2, 4].map((v) => (
              <option value={v} key={v}>
                {v}倍
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="replay-seek">
        再生位置 {(time / 1000).toFixed(2)} /{' '}
        {(trace.elapsed / 1000).toFixed(2)}秒
        <input
          type="range"
          aria-label="リプレイ再生位置"
          min={0}
          max={trace.elapsed}
          step="any"
          value={time}
          onChange={(e) => seek(Number(e.target.value))}
        />
      </label>
      <div className="replay-metrics">
        <span>正打鍵 {frame.correct}</span>
        <span>実ミス {frame.misses}</span>
        <span>累計 {frame.kpm.toFixed(1)} KPM</span>
        <span>直近1秒 {frame.recentKpm.toFixed(1)} KPM</span>
        <span>実ミス率 {formatMissRate(frame.correct, frame.misses)}</span>
      </div>
      <div className={`replay-stage ${frame.mistake ? 'replay-mistake' : ''}`}>
        <p className="replay-event" aria-live="off">
          {frame.count} / {trace.strokes.length} 打鍵 · 問題 {frame.prompt + 1}{' '}
          / {trace.prompts.length} ·{' '}
          {frame.last
            ? `入力 ${keyLabel(frame.last.key)} / ${frame.last.correct ? '正解' : 'ミス'}`
            : '入力前'}
        </p>
        <SentenceView
          current={frame.sentence}
          position={frame.position}
          kana={layout === 'kana'}
          done={frame.done}
          target={frame.target}
          typed={frame.typed}
          hint={frame.hint}
          guide
          wordColors
          consumeTyped={false}
          showNext={false}
          partialRoman={!!strokeLimit}
        />
        <KeyboardGuide
          layout={layout}
          nextCharacter={
            layout === 'kana'
              ? (frame.target[frame.position] ?? '')
              : (frame.hint[0] ?? '')
          }
          enabled={!frame.done && time < trace.elapsed}
        />
      </div>
      <p className="small muted">
        保存された計測時間を再生します。休止・CPU幕間は含みません。KPMは実打鍵数で計算し、再生の倍速には左右されません。リプレイから記録が追加されることはありません。
      </p>
    </section>
  )
}
