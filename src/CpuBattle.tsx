import { useEffect, useRef, useState } from 'react'
import { mapKey } from './engine'
import type { Layout } from './engine'
import {
  RtcMatch,
  cpuCharacters,
  cpuPresets,
  migrateCpuPreset,
} from './cpuMatch'
import type { CpuConfig } from './cpuMatch'
import { shuffledPrompts } from './battlePrompts'
import { OpponentInput } from './OpponentInput'
import { SentenceView } from './SentenceView'
import { KeyboardGuide } from './KeyboardGuide'
import { animalRank, scorePoint } from './scoring'
import type { RecordEntry, Settings } from './storage'

function loadCpu(): CpuConfig {
  try {
    const value = JSON.parse(localStorage.getItem('yohaku.cpu.v1') ?? 'null')
    if (
      value &&
      Number.isFinite(value.kpm) &&
      value.kpm >= 60 &&
      value.kpm <= 1800 &&
      Number.isFinite(value.reactionMs) &&
      value.reactionMs >= 100 &&
      value.reactionMs <= 1500 &&
      ['constant', 'ease-in'].includes(value.curve)
    )
      return migrateCpuPreset(value)
  } catch {
    /* Defaults also work without storage. */
  }
  return cpuPresets.find((p) => p.name === 'ネコ / 標準')!
}
export function CpuBattle({
  settings,
  onRecord,
}: {
  settings: Settings
  onRecord: (record: RecordEntry) => void
}) {
  const [config, setConfig] = useState<CpuConfig>(loadCpu)
  const [layout, setLayout] = useState<Layout>(settings.layout)
  const [match, setMatch] = useState<RtcMatch | null>(null)
  const [, render] = useState(0)
  const model = useRef<RtcMatch | null>(null)
  const clock = useRef({ now: 0, last: 0 })
  const area = useRef<HTMLDivElement>(null)
  const recorded = useRef(false)
  const [mistake, setMistake] = useState(false)
  const missTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const synchronize = () => {
    const value = model.current
    const now = performance.now()
    if (value && value.phase !== 'paused')
      clock.current.now += Math.max(0, now - clock.current.last)
    clock.current.last = now
    return clock.current.now
  }
  const saveResult = (value: RtcMatch) => {
    if (
      value !== model.current ||
      recorded.current ||
      value.phase !== 'finished'
    )
      return
    recorded.current = true
    const keys = value.totalKeys + value.keys,
      misses = value.totalMisses + value.misses.misses
    const penalty = value.totalPenalty + value.misses.penalty
    const point = scorePoint(keys, penalty, value.totalElapsed)
    onRecord({
      id: crypto.randomUUID(),
      passageId: 'cpu-rtc',
      title: `CPU対戦 ${value.roundsPlayer}–${value.roundsCpu} / ${value.config.kpm} KPM`,
      layout: value.layout,
      date: new Date().toISOString(),
      elapsed: value.totalElapsed,
      keys,
      misses,
      rawMisses: value.totalRaw + value.misses.raw,
      kpm: Math.round((keys * 60000) / Math.max(1, value.totalElapsed)),
      accuracy: Number((value.totalAccuracy * 100).toFixed(2)),
      point,
      rank: animalRank(point),
      scoreVersion: 3,
      missPenalty: penalty,
      mode: 'cpu',
    })
  }
  useEffect(() => {
    if (!match) return
    const tick = () => {
      match.advance(synchronize())
      saveResult(match)
      render((v) => v + 1)
    }
    const timer = setInterval(tick, 33)
    const hidden = () => {
      if (document.hidden) {
        synchronize()
        match.pause()
        render((v) => v + 1)
      }
    }
    document.addEventListener('visibilitychange', hidden)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', hidden)
      clearTimeout(missTimer.current)
    }
    // The mutable match owns timing. A new match installs a fresh clock and callback.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [match])
  const start = () => {
    const value = new RtcMatch(shuffledPrompts(), layout, { ...config })
    model.current = value
    clock.current = { now: 0, last: performance.now() }
    recorded.current = false
    setMistake(false)
    setMatch(value)
    try {
      localStorage.setItem('yohaku.cpu.v1', JSON.stringify(config))
    } catch {
      /* Play without saved preferences. */
    }
    requestAnimationFrame(() => area.current?.focus())
  }
  const pause = () => {
    synchronize()
    model.current?.pause()
    setMistake(false)
    render((v) => v + 1)
  }
  const resume = () => {
    clock.current.last = performance.now()
    model.current?.resume()
    render((v) => v + 1)
    requestAnimationFrame(() => area.current?.focus())
  }
  const accept = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      pause()
      return
    }
    if (
      event.repeat ||
      event.ctrlKey ||
      event.altKey ||
      event.metaKey ||
      event.nativeEvent.isComposing
    )
      return
    const value = model.current
    if (!value) return
    const key = mapKey(event.nativeEvent, value.layout)
    if (!key) return
    event.preventDefault()
    const raw = value.misses.raw
    value.feed(key, synchronize())
    if (value.misses.raw > raw) {
      setMistake(true)
      clearTimeout(missTimer.current)
      missTimer.current = setTimeout(() => setMistake(false), 260)
    }
    saveResult(value)
    render((v) => v + 1)
  }
  const phase = match?.phase
  const preset =
    cpuPresets.find(
      (p) =>
        p.kpm === config.kpm &&
        p.reactionMs === config.reactionMs &&
        p.curve === config.curve,
    )?.name ?? 'カスタム'
  const progress = match
    ? Math.min(
        1,
        cpuCharacters(match.elapsedInWord(clock.current.now), match.config) /
          match.cpuLength,
      )
    : 0
  const cpuTyped = match
    ? Math.min(
        match.cpuLength,
        Math.floor(
          cpuCharacters(match.elapsedInWord(clock.current.now), match.config) +
            1e-8,
        ),
      )
    : 0
  const point = match
    ? scorePoint(
        match.totalKeys + match.keys,
        match.totalPenalty + match.misses.penalty,
        match.totalElapsed +
          (phase === 'playing'
            ? Math.max(0, clock.current.now - match.wordStart)
            : 0),
      )
    : 0
  return (
    <section className="cpu-battle">
      <div className="battle-brief">
        <span className="eyebrow">CPU DUEL / BO7</span>
        <h2>同じ言葉で、先へ。</h2>
        <p>
          先に打ち切ると1点。10点先取でラウンド獲得、4ラウンドで勝利。正確率95%未満は逆転判定。
        </p>
      </div>
      <fieldset
        className="cpu-config"
        disabled={!!match && phase !== 'finished'}
      >
        <label>
          CPUプリセット
          <select
            aria-label="CPUプリセット"
            value={preset}
            onChange={(e) => {
              const p = cpuPresets.find((p) => p.name === e.target.value)
              if (p) setConfig({ ...p })
            }}
          >
            {cpuPresets.map((p) => (
              <option key={p.name}>{p.name}</option>
            ))}
            <option value="カスタム" disabled>
              カスタム
            </option>
          </select>
        </label>
        <label>
          CPU速度 (KPM)
          <input
            aria-label="CPU速度 (KPM)"
            type="number"
            min={60}
            max={1800}
            value={config.kpm}
            onChange={(e) =>
              setConfig((c) => ({
                ...c,
                kpm: Math.min(1800, Math.max(60, Number(e.target.value) || 60)),
              }))
            }
          />
        </label>
        <label>
          反応時間 (ms)
          <input
            aria-label="CPU反応時間 (ms)"
            type="number"
            min={100}
            max={1500}
            step={10}
            value={config.reactionMs}
            onChange={(e) =>
              setConfig((c) => ({
                ...c,
                reactionMs: Math.min(
                  1500,
                  Math.max(100, Number(e.target.value) || 100),
                ),
              }))
            }
          />
        </label>
        <label>
          打ち方
          <select
            aria-label="CPUの打ち方"
            value={config.curve}
            onChange={(e) =>
              setConfig((c) => ({
                ...c,
                curve: e.target.value as CpuConfig['curve'],
              }))
            }
          >
            <option value="constant">一定速度</option>
            <option value="ease-in">イーズイン（徐々に加速）</option>
          </select>
        </label>
        <label>
          入力方式
          <select
            aria-label="対戦の入力方式"
            value={layout}
            onChange={(e) => setLayout(e.target.value as Layout)}
          >
            <option value="jis">QWERTY JIS</option>
            <option value="us">QWERTY US</option>
            <option value="dvorak">Dvorak</option>
            <option value="kana">JISかな</option>
          </select>
        </label>
      </fieldset>
      <p className="cpu-config-note">
        反応時間は出題から初打鍵までの待ち時間。KPMは加速後の定常速度です。プリセットは人の反応をイメージしたゲーム内設定です。
      </p>
      {!match ? (
        <button className="primary-button" onClick={start}>
          CPUと対戦する
        </button>
      ) : (
        <>
          <div className="battle-score">
            <div>
              YOU{' '}
              <strong data-testid="player-rounds">{match.roundsPlayer}</strong>
              <span>ROUND</span>
            </div>
            <span>BO7</span>
            <div>
              CPU <strong data-testid="cpu-rounds">{match.roundsCpu}</strong>
              <span>ROUND</span>
            </div>
          </div>
          <div className="word-score">
            <span>
              このラウンド{' '}
              <b data-testid="player-points">{match.roundPlayer}</b> :{' '}
              <b data-testid="cpu-points">{match.roundCpu}</b> / 10点先取
            </span>
            <span>
              正確率 <b>{(match.accuracy * 100).toFixed(1)}%</b> · ミス{' '}
              {match.misses.misses}（実打 {match.misses.raw}）
            </span>
          </div>
          <div
            className="battle-arena"
            ref={area}
            tabIndex={0}
            role="region"
            aria-label="CPU対戦の入力領域"
            onKeyDown={accept}
            onBlur={pause}
          >
            {mistake && <div className="damage-overlay" aria-hidden="true" />}
            {match.awaitingStart ? (
              <div className="battle-countdown" role="status">
                {Math.max(
                  1,
                  Math.ceil((match.deadline - clock.current.now) / 1000),
                )}
                <small>同時スタート</small>
              </div>
            ) : (
              <>
                <SentenceView
                  current={match.sentence}
                  position={match.engine.position}
                  kana={match.layout === 'kana'}
                  done={match.engine.done}
                  target={match.engine.target}
                  typed={match.typed}
                  hint={match.engine.hint}
                  guide={settings.guide}
                  wordColors={settings.wordColors}
                  consumeTyped={settings.consumeTyped}
                  showNext={false}
                />
                <OpponentInput
                  reading={match.sentence.reading}
                  keys={cpuTyped}
                  kana={match.layout === 'kana'}
                />
                <div className="cpu-progress">
                  <span>
                    CPU · {cpuTyped}/{match.cpuLength} keys ·{' '}
                    {phase === 'playing' &&
                    clock.current.now - match.wordStart < config.reactionMs
                      ? '反応待ち'
                      : config.curve === 'ease-in'
                        ? '加速走行'
                        : '定速走行'}
                  </span>
                  <div>
                    <i style={{ width: `${progress * 100}%` }} />
                  </div>
                </div>
                <KeyboardGuide
                  layout={match.layout}
                  nextCharacter={
                    match.layout === 'kana'
                      ? (match.engine.target[match.engine.position] ?? '')
                      : (match.engine.hint[0] ?? '')
                  }
                  enabled={phase === 'playing'}
                />
              </>
            )}
          </div>
          <div className="battle-status" role="status">
            {phase === 'word-result' && (
              <span>
                {match.lastWord === 'player' ? 'YOU +1' : 'CPU +1'} · 次の問題へ
              </span>
            )}
            {phase === 'round-result' && (
              <>
                <strong>
                  {match.lastRound === 'player'
                    ? 'ラウンド獲得'
                    : 'CPUがラウンド獲得'}
                </strong>
                {match.accuracyReversal && (
                  <span>正確率95%ルールによる逆転</span>
                )}
                <button
                  className="primary-button"
                  onClick={() => {
                    match.nextRound(synchronize())
                    render((v) => v + 1)
                    requestAnimationFrame(() => area.current?.focus())
                  }}
                >
                  次のラウンド
                </button>
              </>
            )}
            {phase === 'finished' && (
              <>
                <strong>
                  {match.roundsPlayer >= 4
                    ? 'VICTORY / 勝利'
                    : 'CPU WINS / 敗北'}
                </strong>
                <span>
                  {point} pt · {animalRank(point)}
                </span>
                <button className="primary-button" onClick={start}>
                  再戦する
                </button>
              </>
            )}
            {phase === 'paused' && (
              <button className="primary-button" onClick={resume}>
                対戦を再開する
              </button>
            )}
          </div>
          <div className="battle-actions">
            <span>
              {point} pt · {animalRank(point)}
            </span>
            <button
              onClick={pause}
              disabled={
                !['playing', 'countdown', 'word-result'].includes(phase ?? '')
              }
            >
              対戦を一時停止
            </button>
            <button
              onClick={() => {
                model.current = null
                setMatch(null)
                clearTimeout(missTimer.current)
                setMistake(false)
              }}
            >
              対戦をリセット
            </button>
          </div>
        </>
      )}
    </section>
  )
}
