import { useEffect, useMemo, useRef, useState } from 'react'
import { isConstitutionArticles } from '../../domain/content/constitutionArticles'
import { isEtyping } from '../../domain/content/etyping'
import {
  isEnglishTypewell,
  isSeededEnglish,
} from '../../domain/content/english'
import { sentenceEngine } from '../../domain/typing/sentenceEngine'
import {
  practiceDocument,
  practicePassages,
} from '../../domain/content/practiceDocument'
import { practicePreview } from '../../domain/content/practicePreview'
import { isRtc } from '../../domain/content/rtcWords'
import { isRtcOriginal } from '../../domain/content/rtcOriginal'
import { createTrainerOrder, isTrainer } from '../../domain/content/sakusaku'
import {
  sentencesByPassage,
  type Sentence,
} from '../../domain/content/sentences'
import {
  freshSeed,
  isTypewell,
  strokeLimit,
  typewellEngine,
} from '../../domain/content/typewell'
import { practiceResult } from '../../domain/records/practiceResult'
import { TypingTrace } from '../../domain/records/telemetry'
import type { RecordEntry, Settings } from '../../domain/records/types'
import type { Layout } from '../../domain/typing/engine'
import {
  mapKey,
  RomanEngine,
  isTypingShortcut,
} from '../../domain/typing/engine'
import {
  MissEpisodes,
  scorePoint,
  rawAccuracy,
} from '../../domain/typing/scoring'
import { useKeyFeedback } from '../../shared/typing/useKeyFeedback'
import type { PracticeStatus } from './usePracticeClock'
import { usePracticeClock } from './usePracticeClock'
import { usePracticeFocus } from './usePracticeFocus'
import { usePracticeSeed } from './usePracticeSeed'

export function usePracticeSession(
  settings: Settings,
  onRecord: (record: RecordEntry) => void,
  setNotice: (message: string) => void,
  customDocument?: ReturnType<typeof practiceDocument>,
  options?: {
    startOnFirstKey: boolean
    onTrialComplete?: (record: RecordEntry) => boolean
    onMiss?: (record: RecordEntry, totalMisses: number) => boolean
    countEveryMiss?: boolean
  },
) {
  const trial = useRef({
    trace: new TypingTrace(),
    misses: new MissEpisodes(),
    keys: 0,
    started: 0,
  })
  const keyFeedback = useKeyFeedback()
  const currentLayout = useRef(settings.layout)
  const {
    seed,
    setSeed,
    replayVersion,
    setReplayVersion,
    seedDraft,
    setSeedDraft,
    fixedSeed,
    setFixedSeed,
  } = usePracticeSeed()
  const [selected, setSelected] = useState(
    customDocument?.passage.id ?? practicePassages[0].id,
  )
  const [finishedResult, setFinishedResult] = useState<RecordEntry | null>(null)
  const [status, setStatus] = useState<PracticeStatus>('ready'),
    [sentenceIndex, setSentenceIndex] = useState(0),
    [keys, setKeys] = useState(0),
    [misses, setMisses] = useState(0),
    [rawMisses, setRawMisses] = useState(0),
    [missPenalty, setMissPenalty] = useState(0),
    [snapshot, setSnapshot] = useState(() => {
      const initial = sentenceEngine(
        customDocument?.sentences[0] ??
          sentencesByPassage[practicePassages[0].id][0],
        settings.layout,
      )
      return {
        position: 0,
        target: initial.target,
        hint: initial.hint,
        typed: '',
        naturalKeys: 0,
      }
    }),
    [mistake, setMistake] = useState(false),
    [practiceStage, setPracticeStage] = useState(customDocument ? 2 : 0)
  const practice = useMemo(
    () =>
      customDocument ??
      practiceDocument(selected, seed, settings.layout, replayVersion),
    [customDocument, selected, seed, settings.layout, replayVersion],
  )
  const { passage } = practice
  const sentences: Sentence[] = practice.sentences
  const english = sentences[sentenceIndex]?.language === 'en'
  const typewell = isTypewell(selected) || isEnglishTypewell(selected)
  const etyping =
    isEtyping(selected) || (isSeededEnglish(selected) && !typewell)
  const rtc = isRtc(selected) || isRtcOriginal(selected)
  const trainer = isTrainer(selected)
  const articles = isConstitutionArticles(selected)
  const seeded = typewell || etyping || rtc || trainer || articles
  const limit = english ? 400 : strokeLimit(settings.layout)
  const durationMs = passage.durationMs ?? 0
  const engine = useRef(sentenceEngine(sentences[0], settings.layout)),
    missTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    missEpisodes = useRef(new MissEpisodes()),
    liveKeys = useRef(0),
    trace = useRef(new TypingTrace()),
    trainerOrder = useRef(
      createTrainerOrder(seed, sentences.length, replayVersion),
    ),
    recorded = useRef(false),
    finishTimer = useRef<(duration: number) => void>(() => {})
  const { previewParagraphs, paragraphSegments } = useMemo(
    () => practicePreview(practice, seed, replayVersion),
    [practice, seed, replayVersion],
  )
  const { area, focus } = usePracticeFocus()
  const clock = usePracticeClock({
    status,
    setStatus,
    durationMs,
    area,
    onStarted: () =>
      trace.current.begin(sentences[sentenceIndex], 0, settings.layout),
    onDeadline: (duration) => finishTimer.current(duration),
  })
  const { elapsed, startCount, beginCountdown, elapsedNow } = clock
  const handleStageChange = (stage: number) => {
    if (stage !== 2) pause()
    setPracticeStage(stage)
    if (stage === 2) focus()
  }
  const reset = (
    id = selected,
    layout = settings.layout,
    stage = practiceStage === 3 ? 2 : practiceStage,
    nextSeed = fixedSeed ? seed : freshSeed(),
    version: 1 | 2 = fixedSeed && id === selected ? replayVersion : 2,
  ) => {
    if (
      isTypewell(id) ||
      isSeededEnglish(id) ||
      isEtyping(id) ||
      isRtc(id) ||
      isRtcOriginal(id) ||
      isTrainer(id) ||
      isConstitutionArticles(id)
    ) {
      setReplayVersion(isConstitutionArticles(id) ? 1 : version)
      setSeed(nextSeed)
      setSeedDraft(nextSeed)
    }
    currentLayout.current = layout
    keyFeedback.clearKeyFeedback()
    clock.reset()
    const doc =
      customDocument ?? practiceDocument(id, nextSeed, layout, version)
    trainerOrder.current = createTrainerOrder(
      nextSeed,
      doc.sentences.length,
      version,
    )
    const initialIndex = doc.passage.durationMs ? trainerOrder.current() : 0
    engine.current = doc.plan
      ? typewellEngine(doc.plan)
      : sentenceEngine(doc.sentences[initialIndex], layout)
    setSelected(id)
    setSentenceIndex(initialIndex)
    liveKeys.current = 0
    trace.current = new TypingTrace()
    trial.current = {
      trace: new TypingTrace(),
      misses: new MissEpisodes(),
      keys: 0,
      started: 0,
    }
    recorded.current = false
    setStatus('ready')
    setFinishedResult(null)
    setPracticeStage(stage)
    setKeys(0)
    setMisses(0)
    setRawMisses(0)
    setMissPenalty(0)
    missEpisodes.current = new MissEpisodes()
    setSnapshot({
      position: engine.current.position,
      target: engine.current.target,
      hint: engine.current.hint,
      typed: '',
      naturalKeys: 0,
    })
    clearTimeout(missTimer.current)
    setMistake(false)
  }
  // A layout can also change in the independent weak-word session's sidebar.
  useEffect(() => {
    if (currentLayout.current !== settings.layout)
      reset(selected, settings.layout)
  })
  const pause = () => {
    keyFeedback.clearKeyFeedback()
    if (clock.isCountingDown()) {
      clock.reset()
      setStatus('ready')
      return
    }
    if (status === 'running') {
      if (durationMs && elapsedNow() >= durationMs) {
        finishTimer.current(durationMs)
        return
      }
      clearTimeout(missTimer.current)
      setMistake(false)
      clock.stop(elapsedNow())
      setStatus('paused')
    }
  }
  const resume = () => {
    if (status === 'paused') {
      clock.start()
      setStatus('running')
      area.current?.focus()
    }
    focus()
  }
  useEffect(() => {
    const hidden = () => {
      if (document.hidden) pause()
    }
    document.addEventListener('visibilitychange', hidden)
    return () => document.removeEventListener('visibilitychange', hidden)
  })
  useEffect(() => () => clearTimeout(missTimer.current), [])
  const finishSession = (nextKeys: number, sampledDuration = elapsedNow()) => {
    if (recorded.current) return
    recorded.current = true
    keyFeedback.clearKeyFeedback()
    const duration = durationMs
      ? Math.min(durationMs, sampledDuration)
      : sampledDuration
    clock.stop(duration)
    clearTimeout(missTimer.current)
    setMistake(false)
    setStatus('done')
    const result = practiceResult({
      id: crypto.randomUUID(),
      passage,
      layout: settings.layout,
      duration,
      durationMs,
      nextKeys,
      typewell,
      trainer,
      etyping,
      rtc,
      articles,
      limit,
      seed,
      replayVersion,
      missEpisodes: missEpisodes.current,
      trace: trace.current.finish(duration),
      countEveryMiss: options?.countEveryMiss,
      // oxlint-disable-next-line react/purity
      date: new Date().toISOString(),
    })
    if (customDocument) result.mode = 'weak'
    setFinishedResult(result)
    setPracticeStage(3)
    if (!customDocument) onRecord(result)
  }
  useEffect(() => {
    finishTimer.current = (duration) =>
      finishSession(liveKeys.current, duration)
  })
  const trialResult = (keyTime: number) => {
    const duration = keyTime - trial.current.started
    const result = practiceResult({
      id: crypto.randomUUID(),
      passage,
      layout: settings.layout,
      duration,
      durationMs: 0,
      nextKeys: trial.current.keys,
      typewell: false,
      trainer: false,
      etyping: false,
      rtc: false,
      articles: false,
      limit,
      seed,
      replayVersion,
      missEpisodes: trial.current.misses,
      trace: trial.current.trace.finish(duration),
      countEveryMiss: options?.countEveryMiss,
      date: new Date().toISOString(),
    })
    result.mode = 'weak'
    return result
  }
  const accept = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return
    if (e.key === 'Escape') {
      e.preventDefault()
      pause()
      return
    }
    if (isTypingShortcut(e.nativeEvent, settings.layout)) return
    if (e.repeat) {
      if (e.code === 'Space') e.preventDefault()
      return
    }
    if (
      e.nativeEvent.isComposing ||
      e.key === 'Process' ||
      e.key === 'Unidentified'
    ) {
      setNotice(
        'IME を OFF（直接入力）にしてください。かな入力も IME は使いません。',
      )
      return
    }
    if (status === 'ready' || status === 'countdown') {
      if (
        options?.startOnFirstKey &&
        status === 'ready' &&
        e.key.length === 1
      ) {
        clock.start()
        trace.current.begin(sentences[sentenceIndex], 0, settings.layout)
        trial.current.trace.begin(sentences[sentenceIndex], 0, settings.layout)
        setStatus('running')
      } else {
        if (e.key.length === 1 || e.code === 'Space') e.preventDefault()
        if (status === 'ready' && !clock.isCountingDown() && e.code === 'Space')
          beginCountdown()
        return
      }
    }
    if (status === 'paused' || status === 'done') return
    const key = mapKey(
      e.nativeEvent,
      english && settings.layout === 'kana' ? 'jis' : settings.layout,
      engine.current.hint[0],
      english,
    )
    if (!key) return
    e.preventDefault()
    if (durationMs && status === 'running' && elapsedNow() >= durationMs) {
      finishSession(liveKeys.current, durationMs)
      return
    }
    const keyTime = elapsedNow()
    const position = engine.current.position
    const expected =
      (settings.layout === 'kana'
        ? engine.current.target[position]
        : engine.current.hint[0]) ?? ''
    const accepted = engine.current.feed(key)
    trace.current.add(key, expected, position, accepted, keyTime)
    if (options?.onTrialComplete || options?.onMiss) {
      trial.current.trace.add(
        key,
        expected,
        position,
        accepted,
        keyTime - trial.current.started,
      )
      if (accepted) {
        trial.current.keys++
        trial.current.misses.accept()
      } else trial.current.misses.miss()
    }
    if (!accepted) {
      keyFeedback.reportMiss(e.code)
      if (missEpisodes.current.miss()) setMisses(missEpisodes.current.misses)
      setRawMisses(missEpisodes.current.raw)
      setMissPenalty(missEpisodes.current.penalty)
      setMistake(true)
      clearTimeout(missTimer.current)
      missTimer.current = setTimeout(() => setMistake(false), 520)
      if (options?.onMiss?.(trialResult(keyTime), missEpisodes.current.raw))
        finishSession(liveKeys.current, keyTime)
      return
    }
    missEpisodes.current.accept()
    const nextKeys = liveKeys.current + 1
    liveKeys.current = nextKeys
    setKeys(nextKeys)
    setSnapshot({
      position: engine.current.position,
      target: engine.current.target,
      hint: engine.current.hint,
      typed: snapshot.typed + key,
      naturalKeys:
        settings.layout === 'kana'
          ? engine.current.position
          : (engine.current as RomanEngine).naturalProgress,
    })
    if (engine.current.done) {
      if (options?.onTrialComplete) {
        const result = trialResult(keyTime)
        if (options.onTrialComplete(result)) finishSession(nextKeys, keyTime)
        else {
          engine.current = sentenceEngine(
            sentences[sentenceIndex],
            settings.layout,
          )
          trace.current.begin(
            sentences[sentenceIndex],
            keyTime,
            settings.layout,
          )
          trial.current = {
            trace: new TypingTrace(),
            misses: new MissEpisodes(),
            keys: 0,
            started: keyTime,
          }
          trial.current.trace.begin(
            sentences[sentenceIndex],
            0,
            settings.layout,
          )
          setSnapshot({
            position: 0,
            target: engine.current.target,
            hint: engine.current.hint,
            typed: '',
            naturalKeys: 0,
          })
        }
      } else if (durationMs) {
        const index = trainerOrder.current()
        setSentenceIndex(index)
        engine.current = sentenceEngine(sentences[index], settings.layout)
        trace.current.begin(sentences[index], keyTime, settings.layout)
        setSnapshot({
          position: 0,
          target: engine.current.target,
          hint: engine.current.hint,
          typed: '',
          naturalKeys: 0,
        })
      } else if (!typewell && sentenceIndex < sentences.length - 1) {
        const n = sentenceIndex + 1
        setSentenceIndex(n)
        engine.current = sentenceEngine(sentences[n], settings.layout)
        trace.current.begin(sentences[n], keyTime, settings.layout)
        setSnapshot({
          position: engine.current.position,
          target: engine.current.target,
          hint: engine.current.hint,
          typed: '',
          naturalKeys: 0,
        })
      } else {
        finishSession(nextKeys)
      }
    }
  }
  const normalizedKeys = typewell ? snapshot.naturalKeys : keys
  const progress =
    status === 'done'
      ? 100
      : durationMs
        ? Math.min(100, (elapsed / durationMs) * 100)
        : typewell
          ? Math.max(0, (normalizedKeys / limit) * 100)
          : ((sentenceIndex + snapshot.position / snapshot.target.length) /
              sentences.length) *
            100
  const point = scorePoint(
    typewell ? Math.max(0, normalizedKeys) : keys,
    missPenalty,
    elapsed,
  )
  const kpm =
      elapsed > 0
        ? Math.round(
            (typewell ? Math.max(0, normalizedKeys) : keys) / (elapsed / 60000),
          )
        : 0,
    accuracy = rawAccuracy(keys, rawMisses)
  return {
    weak: !!customDocument,
    english,
    missedKey: keyFeedback.missedKey,
    selected,
    passage,
    sentences,
    seed,
    seedDraft,
    fixedSeed,
    replayVersion,
    typewell,
    etyping,
    rtc,
    trainer,
    articles,
    seeded,
    limit,
    durationMs,
    previewParagraphs,
    paragraphSegments,
    status,
    startCount,
    sentenceIndex,
    elapsed,
    keys,
    misses: options?.countEveryMiss ? rawMisses : misses,
    rawMisses,
    snapshot,
    mistake,
    practiceStage,
    finishedResult,
    normalizedKeys,
    progress,
    point,
    kpm,
    accuracy,
    area,
    focus,
    reset,
    pause,
    resume,
    beginCountdown,
    accept,
    handleStageChange,
    setSeedDraft,
    setFixedSeed,
    openRandomDocument: (id: string, layout: Layout) => {
      setFixedSeed(false)
      reset(id, layout, 1, freshSeed(), 2)
    },
    startPreview: () => {
      setPracticeStage(2)
      if (status === 'paused') resume()
      else focus()
    },
    replayRecord: (record: RecordEntry) => {
      setFixedSeed(true)
      reset(
        record.passageId,
        record.layout,
        0,
        record.seed!,
        record.replayVersion ?? 1,
      )
    },
  }
}
export type PracticeSession = ReturnType<typeof usePracticeSession>
