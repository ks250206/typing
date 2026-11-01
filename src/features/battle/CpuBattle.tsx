import {
  isTypewellBattle,
  normalizeCpuWordsPerPrompt,
} from '../../domain/battle/cpuPromptSettings'
import { Pause, Play } from 'lucide-react'
import { PauseOverlay } from '../../shared/typing/PauseOverlay'
import { PageHeading } from '../../shared/ui/PageHeading'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { BattleSidebar } from './BattleSidebar'
import { CpuResults } from './CpuResults'
import { CpuConfigForm } from './CpuConfigForm'
import { mapKey, isTypingShortcut } from '../../domain/typing/engine'
import type { Layout } from '../../domain/typing/engine'
import { RtcMatch, cpuCharacters } from '../../domain/battle/cpuMatch'
import type { CpuConfig } from '../../domain/battle/cpuMatch'
import {
  battleSets,
  battlePromptVersion,
  seededBattlePrompts,
} from '../../domain/content/battleSets'
import { isEnglish } from '../../domain/content/english'
import { freshSeed } from '../../domain/content/typewell'
import { DuelRomanGuide } from './DuelRomanGuide'
import { SentenceView } from '../../shared/typing/SentenceView'
import { KeyboardGuide } from '../../shared/typing/KeyboardGuide'
import {
  typingTitle,
  rawAccuracy,
  scorePoint,
} from '../../domain/typing/scoring'
import type { RecordEntry, Settings } from '../../domain/records/types'

import { useKeyFeedback } from '../../shared/typing/useKeyFeedback'
import { useGameShortcuts } from '../../shared/typing/useGameShortcuts'
import type { Favorite } from '../../domain/records/favorites'
import { FavoriteButton } from '../favorites/FavoriteButton'
import {
  readCpuConfig,
  readCpuPromptSelection,
  saveCpuConfig,
  saveCpuPromptSelection,
} from '../../infrastructure/persistence/cpuSettings'

export function CpuBattle({
  settings,
  historyRecords = [],
  setSettings,
  onRecord,
  replay,
  onReplayConsumed,
  favorite,
  isFavorite,
  onToggleFavorite,
}: {
  settings: Settings
  historyRecords?: RecordEntry[]
  setSettings: Dispatch<SetStateAction<Settings>>
  replay?: RecordEntry | null
  onReplayConsumed?: () => void
  onRecord: (record: RecordEntry) => void
  favorite?: Extract<Favorite, { kind: 'cpu' }> | null
  isFavorite: (favorite: Favorite) => boolean
  onToggleFavorite: (favorite: Favorite) => void
}) {
  const keyFeedback = useKeyFeedback()
  const [config, setConfig] = useState<CpuConfig>(
    () => favorite?.cpuConfig ?? replay?.cpuConfig ?? readCpuConfig(),
  )
  const [layout, setLayout] = useState<Layout>(
    favorite?.layout ?? replay?.layout ?? settings.layout,
  )
  const [selection] = useState(readCpuPromptSelection)
  const [setId, setSetId] = useState(
    favorite?.passageId ?? replay?.passageId ?? selection.id,
  )
  const [wordsPerPrompt, setWordsPerPrompt] = useState(() =>
    favorite && isTypewellBattle(favorite.passageId)
      ? normalizeCpuWordsPerPrompt(favorite.wordsPerPrompt)
      : replay && isTypewellBattle(replay.passageId)
        ? (replay.replayVersion ?? 1) === 1
          ? 1
          : normalizeCpuWordsPerPrompt(replay.cpuWordsPerPrompt)
        : normalizeCpuWordsPerPrompt(selection.wordsPerPrompt),
  )
  useEffect(() => {
    if (isEnglish(setId) && layout === 'kana') setLayout('jis')
  }, [setId, layout])
  const [seed, setSeed] = useState(() =>
    favorite ? freshSeed() : (replay?.seed ?? selection.seed),
  )
  const [fixed, setFixed] = useState(
    !favorite && (!!replay || !!selection.fixed),
  )
  const promptVersion = useRef<1 | 2>(replay?.replayVersion ?? (replay ? 1 : 2))
  const matchSource = useRef({
    id: setId,
    seed,
    wordsPerPrompt,
    title: battleSets.find((s) => s.id === setId)?.title ?? 'RTCオリジナル',
  })
  const [result, setResult] = useState<RecordEntry | null>(null)
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
    const record: RecordEntry = {
      id: crypto.randomUUID(),
      passageId: matchSource.current.id,
      title: `CPU対戦 · ${matchSource.current.title}${isTypewellBattle(matchSource.current.id) ? ` · ${matchSource.current.wordsPerPrompt}語/問` : ''} ${value.roundsPlayer}–${value.roundsCpu} / ${value.config.kpm} KPM`,
      layout: value.layout,
      date: new Date().toISOString(),
      elapsed: value.totalElapsed,
      keys,
      misses,
      rawMisses: value.totalRaw + value.misses.raw,
      kpm: Math.round((keys * 60000) / Math.max(1, value.totalElapsed)),
      accuracy: Number(
        rawAccuracy(
          value.totalKeys + value.keys,
          value.totalRaw + value.misses.raw,
        ).toFixed(2),
      ),
      point,
      rank: typingTitle(point, keys, value.totalRaw + value.misses.raw),
      scoreVersion: 3,
      missPenalty: penalty,
      mode: 'cpu',
      seed: matchSource.current.seed,
      replayVersion: battlePromptVersion(
        matchSource.current.id,
        promptVersion.current,
      ),
      cpuConfig: { ...value.config },
      ...(isTypewellBattle(matchSource.current.id)
        ? { cpuWordsPerPrompt: matchSource.current.wordsPerPrompt }
        : {}),
      trace: value.trace.finish(value.totalElapsed),
    }
    setResult(record)
    onRecord(record)
  }
  useEffect(() => {
    if (!match) return
    const tick = () => {
      if (['round-result', 'finished', 'paused'].includes(match.phase)) return
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
    keyFeedback.clearKeyFeedback()
    onReplayConsumed?.()
    const nextSeed = fixed ? seed.trim() : freshSeed()
    setSeed(nextSeed)
    matchSource.current = {
      id: setId,
      seed: nextSeed,
      wordsPerPrompt: promptVersion.current === 1 ? 1 : wordsPerPrompt,
      title: battleSets.find((s) => s.id === setId)!.title,
    }
    const value = new RtcMatch(
      seededBattlePrompts(
        setId,
        nextSeed,
        promptVersion.current,
        wordsPerPrompt,
      ),
      layout,
      {
        ...config,
      },
    )
    model.current = value
    clock.current = { now: 0, last: performance.now() }
    recorded.current = false
    setResult(null)
    setMistake(false)
    setMatch(value)
    saveCpuConfig(config)
    saveCpuPromptSelection({ id: setId, seed: nextSeed, fixed, wordsPerPrompt })
    requestAnimationFrame(() => area.current?.focus())
  }
  const pause = () => {
    keyFeedback.clearKeyFeedback()
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
  const resetMatch = () => {
    keyFeedback.clearKeyFeedback()
    model.current = null
    promptVersion.current = 2
    setMatch(null)
    setResult(null)
    clearTimeout(missTimer.current)
    setMistake(false)
  }
  const accept = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      pause()
      return
    }
    if (
      event.repeat ||
      isTypingShortcut(event.nativeEvent, layout) ||
      event.nativeEvent.isComposing
    )
      return
    const value = model.current
    if (!value) return
    const key = mapKey(
      event.nativeEvent,
      value.layout,
      value.engine.hint[0],
      value.sentence.language === 'en',
    )
    if (!key) return
    event.preventDefault()
    const raw = value.misses.raw
    value.feed(key, synchronize())
    if (value.misses.raw > raw) {
      keyFeedback.reportMiss(event.code)
      setMistake(true)
      clearTimeout(missTimer.current)
      missTimer.current = setTimeout(() => setMistake(false), 260)
    }
    saveResult(value)
    render((v) => v + 1)
  }
  const phase = match?.phase
  const favoriteEntry: Favorite = {
    kind: 'cpu',
    passageId: setId,
    layout,
    cpuConfig: config,
    ...(isTypewellBattle(setId) ? { wordsPerPrompt } : {}),
  }
  const nextRound = () => {
    model.current?.nextRound(synchronize())
    render((v) => v + 1)
    requestAnimationFrame(() => area.current?.focus())
  }
  useGameShortcuts((event) => {
    const key = event.key.toLowerCase()
    const currentPhase = model.current?.phase
    if (
      key === 'c' &&
      ['paused', 'round-result', 'finished'].includes(currentPhase ?? '')
    )
      return resetMatch
    if (
      currentPhase === 'round-result' &&
      ['n', 's', ' ', 'enter'].includes(key)
    )
      return nextRound
    if (currentPhase === 'finished' && key === 'r') return start
    if (currentPhase === 'paused') {
      if ([' ', 'escape', 'enter'].includes(key)) return resume
      if (key === 'r') return start
    }
  })
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
        match.activeElapsed(clock.current.now),
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
      guideSentence ? (
        <DuelRomanGuide
          sentence={guideSentence}
          typed={guideTyped}
          hint={guideHint}
          playerPosition={guidePosition}
          cpuKeys={cpuTyped}
          kana={guideKana}
        />
      ) : undefined,
    [guideSentence, guideTyped, guideHint, guidePosition, guideKana, cpuTyped],
  )
  return (
    <div className="practice-grid battle-grid">
      <section className="cpu-battle practice-main" data-match-active={!!match}>
        <PageHeading
          className="battle-brief"
          eyebrow="CPU DUEL / BO7"
          title="CPU対戦"
          actions={
            !match ? (
              <FavoriteButton
                active={isFavorite(favoriteEntry)}
                onClick={() => onToggleFavorite(favoriteEntry)}
              />
            ) : undefined
          }
        >
          <p>
            先に打ち切ると1点。10点先取でラウンド獲得、4ラウンドで勝利。正確率95%未満は逆転判定。
          </p>
        </PageHeading>
        {!match && (
          <CpuConfigForm
            config={config}
            setConfig={setConfig}
            layout={layout}
            setLayout={setLayout}
            setId={setId}
            onSetChange={(id) => {
              setSetId(id)
              promptVersion.current = 2
              if (isEnglish(id) && layout === 'kana') setLayout('jis')
            }}
            wordsPerPrompt={wordsPerPrompt}
            onWordsPerPromptCommit={(value) => {
              setWordsPerPrompt(value)
              saveCpuPromptSelection({
                id: setId,
                seed,
                fixed,
                wordsPerPrompt: value,
              })
              if (value !== wordsPerPrompt) promptVersion.current = 2
            }}
            seed={seed}
            setSeed={setSeed}
            fixed={fixed}
            setFixed={setFixed}
          />
        )}
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
                <strong data-testid="player-rounds">
                  {match.roundsPlayer}
                </strong>
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
              RTC v
              {battlePromptVersion(
                matchSource.current.id,
                promptVersion.current,
              )}
            </p>
            <div className="word-score">
              <span>
                正確率{' '}
                <b>{rawAccuracy(match.keys, match.misses.raw).toFixed(1)}%</b> ·
                ミス {match.misses.misses}（実打 {match.misses.raw}）
              </span>
            </div>
            {phase === 'round-result' || phase === 'finished' ? (
              <CpuResults
                history={historyRecords}
                match={match}
                result={result}
                onNext={nextRound}
                onRematch={start}
                onConfigure={resetMatch}
              />
            ) : (
              <>
                <div
                  className="battle-arena"
                  ref={area}
                  tabIndex={0}
                  role="region"
                  aria-label="CPU対戦の入力領域"
                  onKeyDown={accept}
                  onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget))
                      pause()
                  }}
                >
                  {mistake && (
                    <div className="damage-overlay" aria-hidden="true" />
                  )}
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
                        wordColors={settings.wordColors}
                        consumeTyped={settings.consumeTyped}
                        showNext={false}
                        romanGuide={romanGuide}
                      />
                      <KeyboardGuide
                        missedKey={keyFeedback.missedKey}
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
                  {phase === 'paused' && (
                    <PauseOverlay
                      onResume={resume}
                      description="Space / Esc / Enter で再開 · R でやり直す · C で対戦設定"
                    />
                  )}
                </div>
                <div className="battle-status" role="status">
                  {phase === 'word-result' && (
                    <span>
                      {match.lastWord === 'player' ? 'YOU +1' : 'CPU +1'} ·
                      次の問題へ
                    </span>
                  )}
                </div>
              </>
            )}
            <div
              className="battle-actions"
              onMouseDown={(event) => event.preventDefault()}
            >
              <span>
                {point} pt · {title}
              </span>
              <button
                className="battle-pause-button"
                onClick={phase === 'paused' ? resume : pause}
                aria-keyshortcuts="Escape"
                disabled={
                  !['playing', 'countdown', 'word-result', 'paused'].includes(
                    phase ?? '',
                  )
                }
              >
                {phase === 'paused' ? <Play size={14} /> : <Pause size={14} />}
                {phase === 'paused' ? '再開' : '一時停止'}
              </button>
              <button onClick={resetMatch}>対戦をリセット</button>
            </div>
          </>
        )}
      </section>
      <BattleSidebar
        settings={settings}
        setSettings={setSettings}
        layout={match?.layout ?? layout}
        keys={titleKeys}
        misses={titleMisses}
        point={point}
        elapsed={match?.activeElapsed(clock.current.now) ?? 0}
        rounds={`${match?.roundsPlayer ?? 0} : ${match?.roundsCpu ?? 0}`}
        cpu={`${config.kpm} KPM · ${config.reactionMs}ms · ${config.curve === 'constant' ? '一定速度' : 'イーズイン'}`}
      />
    </div>
  )
}
