import { useEffect, useMemo, useRef, useState } from 'react'
import { mapKey } from './engine'
import type { Layout } from './engine'
import {
  RtcMatch,
  cpuCharacters,
  cpuPresets,
  migrateCpuPreset,
} from './cpuMatch'
import type { CpuConfig } from './cpuMatch'
import { battleSets, seededBattlePrompts } from './battleSets'
import { freshSeed } from './typewell'
import { DuelRomanGuide } from './DuelRomanGuide'
import { SentenceView } from './SentenceView'
import { KeyboardGuide } from './KeyboardGuide'
import { typingTitle, formatMissRate, scorePoint } from './scoring'
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
  replay,
  onReplayConsumed,
}: {
  settings: Settings
  replay?: RecordEntry | null
  onReplayConsumed?: () => void
  onRecord: (record: RecordEntry) => void
}) {
  const [config, setConfig] = useState<CpuConfig>(
    () => replay?.cpuConfig ?? loadCpu(),
  )
  const [layout, setLayout] = useState<Layout>(
    replay?.layout ?? settings.layout,
  )
  const [selection] = useState(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem('galactype.cpu-prompts.v1') ?? 'null',
      )
      if (
        saved &&
        battleSets.some((s) => s.id === saved.id) &&
        typeof saved.seed === 'string' &&
        saved.seed.length > 0 &&
        saved.seed.length <= 64
      )
        return saved as { id: string; seed: string; fixed: boolean }
    } catch {
      /* Defaults also work without storage. */
    }
    return { id: 'cpu-rtc', seed: freshSeed(), fixed: false }
  })
  const [setId, setSetId] = useState(replay?.passageId ?? selection.id)
  const [seed, setSeed] = useState(replay?.seed ?? selection.seed)
  const [fixed, setFixed] = useState(!!replay || !!selection.fixed)
  const matchSource = useRef({
    id: setId,
    seed,
    title: battleSets.find((s) => s.id === setId)?.title ?? 'RTCオリジナル',
  })
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
      passageId: matchSource.current.id,
      title: `CPU対戦 · ${matchSource.current.title} ${value.roundsPlayer}–${value.roundsCpu} / ${value.config.kpm} KPM`,
      layout: value.layout,
      date: new Date().toISOString(),
      elapsed: value.totalElapsed,
      keys,
      misses,
      rawMisses: value.totalRaw + value.misses.raw,
      kpm: Math.round((keys * 60000) / Math.max(1, value.totalElapsed)),
      accuracy: Number((value.totalAccuracy * 100).toFixed(2)),
      point,
      rank: typingTitle(point, keys, value.totalRaw + value.misses.raw),
      scoreVersion: 3,
      missPenalty: penalty,
      mode: 'cpu',
      seed: matchSource.current.seed,
      replayVersion: 1,
      cpuConfig: { ...value.config },
      trace: value.trace.finish(value.totalElapsed),
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
    onReplayConsumed?.()
    const nextSeed = fixed ? seed.trim() : freshSeed()
    setSeed(nextSeed)
    matchSource.current = {
      id: setId,
      seed: nextSeed,
      title: battleSets.find((s) => s.id === setId)!.title,
    }
    const value = new RtcMatch(seededBattlePrompts(setId, nextSeed), layout, {
      ...config,
    })
    model.current = value
    clock.current = { now: 0, last: performance.now() }
    recorded.current = false
    setMistake(false)
    setMatch(value)
    try {
      localStorage.setItem('yohaku.cpu.v1', JSON.stringify(config))
      localStorage.setItem(
        'galactype.cpu-prompts.v1',
        JSON.stringify({ id: setId, seed: nextSeed, fixed }),
      )
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
    const key = mapKey(event.nativeEvent, value.layout, value.engine.hint[0])
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
  const titleKeys = match ? match.totalKeys + match.keys : 0
  const titleMisses = match ? match.totalRaw + match.misses.raw : 0
  const title = typingTitle(point, titleKeys, titleMisses)
  const guideSentence = match?.sentence
  const guideTyped = match?.typed ?? ''
  const guideHint = match?.engine.hint ?? ''
  const guidePosition = match?.engine.position ?? 0
  const guideKana = match?.layout === 'kana'
  const romanGuide = useMemo(
    () =>
      guideSentence && settings.guide ? (
        <DuelRomanGuide
          sentence={guideSentence}
          typed={guideTyped}
          hint={guideHint}
          playerPosition={guidePosition}
          cpuKeys={cpuTyped}
          kana={guideKana}
        />
      ) : undefined,
    [
      guideSentence,
      guideTyped,
      guideHint,
      guidePosition,
      guideKana,
      settings.guide,
      cpuTyped,
    ],
  )
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
        <label className="battle-set-control">
          文章セット
          <select
            aria-label="対戦の文章セット"
            value={setId}
            onChange={(e) => setSetId(e.target.value)}
          >
            {battleSets.map((s) => (
              <option value={s.id} key={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          対戦シード
          <input
            aria-label="対戦シード"
            maxLength={64}
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
          />
        </label>
        <label className="battle-fixed">
          <span>
            <input
              type="checkbox"
              aria-label="対戦シードを固定する"
              checked={fixed}
              onChange={(e) => setFixed(e.target.checked)}
            />{' '}
            シードを固定する
          </span>
          <button
            type="button"
            disabled={fixed}
            onClick={() => setSeed(freshSeed())}
          >
            シードを更新
          </button>
        </label>
      </fieldset>
      <p className="cpu-config-note">
        反応時間は出題から初打鍵までの待ち時間。KPMは加速後の定常速度です。プリセットは人の反応をイメージしたゲーム内設定です。
      </p>
      {!match ? (
        <button
          className="primary-button"
          disabled={fixed && !seed.trim()}
          onClick={start}
        >
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
          <div className="round-scoreboard" aria-label="このラウンドの得点">
            <div className="round-score-side">
              <span>YOU</span>
              <strong
                key={`you-${match.roundPlayer}`}
                data-testid="player-points"
              >
                {match.roundPlayer}
              </strong>
              <div className="point-lights" aria-hidden="true">
                {Array.from({ length: 10 }, (_, i) => (
                  <i key={i} data-lit={i < match.roundPlayer} />
                ))}
              </div>
            </div>
            <div className="round-score-center">
              <span>このラウンド</span>
              <b>10点先取</b>
              <small role="status">
                {match.roundPlayer === match.roundCpu
                  ? '同点'
                  : match.roundPlayer > match.roundCpu
                    ? 'YOUが先行'
                    : 'CPUが先行'}
              </small>
            </div>
            <div className="round-score-side cpu">
              <span>CPU</span>
              <strong key={`cpu-${match.roundCpu}`} data-testid="cpu-points">
                {match.roundCpu}
              </strong>
              <div className="point-lights" aria-hidden="true">
                {Array.from({ length: 10 }, (_, i) => (
                  <i key={i} data-lit={i < match.roundCpu} />
                ))}
              </div>
            </div>
          </div>
          <p className="battle-seed-info">
            {matchSource.current.title} · シード {matchSource.current.seed} ·
            RTC v1
          </p>
          <div className="word-score">
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
                  romanGuide={romanGuide}
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
                  {point} pt · {title}
                </span>
                <button
                  className="primary-button"
                  disabled={fixed && !seed.trim()}
                  onClick={start}
                >
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
              {point} pt · {title} · 実ミス率{' '}
              {formatMissRate(titleKeys, titleMisses)}
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
