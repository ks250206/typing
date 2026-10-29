import { useEffect, useMemo, useRef, useState } from 'react'
import { isConstitutionArticles } from '../../domain/content/constitutionArticles'
import { isEtyping } from '../../domain/content/etyping'
import {
  practiceDocument,
  practicePassages,
} from '../../domain/content/practiceDocument'
import { practicePreview } from '../../domain/content/practicePreview'
import { isRtc } from '../../domain/content/rtcWords'
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
import { KanaEngine, mapKey, RomanEngine } from '../../domain/typing/engine'
import { MissEpisodes, scorePoint } from '../../domain/typing/scoring'
import type { PracticeStatus } from './usePracticeClock'
import { usePracticeClock } from './usePracticeClock'
import { usePracticeFocus } from './usePracticeFocus'
import { usePracticeSeed } from './usePracticeSeed'

function makeEngine(reading: string, layout: Layout) {
  return layout === 'kana' ? new KanaEngine(reading) : new RomanEngine(reading)
}

export function usePracticeSession(
  settings: Settings,
  onRecord: (record: RecordEntry) => void,
  setNotice: (message: string) => void,
) {
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
  const [selected, setSelected] = useState(practicePassages[0].id)
  const [finishedResult, setFinishedResult] = useState<RecordEntry | null>(null)
  const [status, setStatus] = useState<PracticeStatus>('ready'),
    [sentenceIndex, setSentenceIndex] = useState(0),
    [keys, setKeys] = useState(0),
    [misses, setMisses] = useState(0),
    [rawMisses, setRawMisses] = useState(0),
    [missPenalty, setMissPenalty] = useState(0),
    [snapshot, setSnapshot] = useState(() => {
      const initial = makeEngine(
        sentencesByPassage[practicePassages[0].id][0].reading,
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
    [practiceStage, setPracticeStage] = useState(0)
  const practice = useMemo(
    () => practiceDocument(selected, seed, settings.layout, replayVersion),
    [selected, seed, settings.layout, replayVersion],
  )
  const { passage } = practice
  const sentences: Sentence[] = practice.sentences
  const typewell = isTypewell(selected)
  const etyping = isEtyping(selected)
  const rtc = isRtc(selected)
  const trainer = isTrainer(selected)
  const articles = isConstitutionArticles(selected)
  const seeded = typewell || etyping || rtc || trainer || articles
  const limit = strokeLimit(settings.layout)
  const durationMs = passage.durationMs ?? 0
  const engine = useRef(makeEngine(sentences[0].reading, settings.layout)),
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
      isEtyping(id) ||
      isRtc(id) ||
      isTrainer(id) ||
      isConstitutionArticles(id)
    ) {
      setReplayVersion(isConstitutionArticles(id) ? 1 : version)
      setSeed(nextSeed)
      setSeedDraft(nextSeed)
    }
    clock.reset()
    const doc = practiceDocument(id, nextSeed, layout, version)
    trainerOrder.current = createTrainerOrder(
      nextSeed,
      doc.sentences.length,
      version,
    )
    const initialIndex = doc.passage.durationMs ? trainerOrder.current() : 0
    engine.current = doc.plan
      ? typewellEngine(doc.plan)
      : makeEngine(doc.sentences[initialIndex].reading, layout)
    setSelected(id)
    setSentenceIndex(initialIndex)
    liveKeys.current = 0
    trace.current = new TypingTrace()
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
  const pause = () => {
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
      // oxlint-disable-next-line react/purity
      date: new Date().toISOString(),
    })
    setFinishedResult(result)
    setPracticeStage(3)
    onRecord(result)
  }
  useEffect(() => {
    finishTimer.current = (duration) =>
      finishSession(liveKeys.current, duration)
  })
  const accept = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return
    if (e.key === 'Escape') {
      e.preventDefault()
      pause()
      return
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return
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
      if (e.key.length === 1 || e.code === 'Space') e.preventDefault()
      if (status === 'ready' && !clock.isCountingDown() && e.code === 'Space')
        beginCountdown()
      return
    }
    if (status === 'paused' || status === 'done') return
    const key = mapKey(e.nativeEvent, settings.layout, engine.current.hint[0])
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
    if (!accepted) {
      if (missEpisodes.current.miss()) setMisses(missEpisodes.current.misses)
      setRawMisses(missEpisodes.current.raw)
      setMissPenalty(missEpisodes.current.penalty)
      setMistake(true)
      clearTimeout(missTimer.current)
      missTimer.current = setTimeout(() => setMistake(false), 520)
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
      if (durationMs) {
        const index = trainerOrder.current()
        setSentenceIndex(index)
        engine.current = makeEngine(sentences[index].reading, settings.layout)
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
        engine.current = makeEngine(sentences[n].reading, settings.layout)
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
    accuracy =
      keys + (durationMs ? rawMisses : misses)
        ? (keys / (keys + (durationMs ? rawMisses : misses))) * 100
        : 100
  return {
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
    misses,
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
