import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react'
import {
  practicePassages,
  japanesePracticePassages,
} from '../../domain/content/practiceDocument'
import { englishPassages } from '../../domain/content/english'
import { sentencePracticePool } from '../../domain/content/sentencePracticePool'
import {
  judgeSentence,
  normalizeSentenceGoals,
} from '../../domain/typing/sentenceChallenge'
import {
  sentenceChallengeResult,
  sentenceStatsKey,
} from '../../domain/records/sentencePractice'
import type { RecordEntry, Settings } from '../../domain/records/types'
import { PageHeading } from '../../shared/ui/PageHeading'
import { useGameShortcuts } from '../../shared/typing/useGameShortcuts'
import { PassageLibrary } from '../library/PassageLibrary'
import { SessionResult } from '../results/SessionResult'
import { InputStyleCard } from './PracticeSidebar'
import { SentenceAttempt } from './SentenceAttempt'
import { SentenceWordTable } from './SentenceWordTable'
import { MissionCarousel } from './MissionCarousel'
import { PracticePreview } from './PracticePreview'
import { useSentenceStats } from './useSentenceStats'
import type { PracticeStatus } from './usePracticeClock'
import {
  defaultSentencePracticeSettings,
  type SentencePracticeSettings,
} from '../../infrastructure/persistence/sentencePractice'
import { useSentencePracticeSettings } from './useSentencePracticeSettings'

type Attempt = ReturnType<typeof judgeSentence> & { id: string; misses: number }
export default function SentencePractice({
  settings,
  setSettings,
  onNotice,
  isFavorite,
  onToggleFavorite,
}: {
  settings: Settings
  setSettings: Dispatch<SetStateAction<Settings>>
  onNotice: (message: string) => void
  isFavorite: (id: string) => boolean
  onToggleFavorite: (id: string) => void
}) {
  const { config, setConfig } = useSentencePracticeSettings(onNotice)
  const { stats, recordAttempt } = useSentenceStats(onNotice)
  const passage = practicePassages.find((p) => p.id === config.passageId)!
  const english = passage.language === 'en'
  const layout = english && settings.layout === 'kana' ? 'jis' : settings.layout
  const pool = useMemo(
    () => sentencePracticePool(config.passageId, layout),
    [config.passageId, layout],
  )
  const streakRef = useRef(0)
  const [sidebarHost, setSidebarHost] = useState<HTMLDivElement | null>(null)
  const [previousSentence, setPreviousSentence] = useState<
    (typeof pool)[number] | null
  >(null)
  const clearTransition = useCallback(() => setPreviousSentence(null), [])
  const [stage, setStage] = useState(0)
  const [index, setIndex] = useState(0)
  const [revision, setRevision] = useState(0)
  const [autoFocus, setAutoFocus] = useState(false)
  const [streak, setStreak] = useState(0)
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [records, setRecords] = useState<RecordEntry[]>([])
  const [status, setStatus] = useState<PracticeStatus>('ready')
  const current = pool[index % pool.length]
  const cleared = streak >= config.repetitions
  const active =
    status === 'running' || status === 'paused' || status === 'countdown'
  const summary = useMemo(
    () => sentenceChallengeResult(records, `一文練習 · ${passage.title}`),
    [records, passage.title],
  )
  const handleStageChange = useCallback((next: number) => {
    setAutoFocus(next === 2)
    setStage(next)
  }, [])
  const resetProgress = (focus = false) => {
    streakRef.current = 0
    setStreak(0)
    setAttempts([])
    setRecords([])
    setAutoFocus(focus)
    setRevision((value) => value + 1)
  }
  const updateConfig = (next: SentencePracticeSettings) => {
    setConfig(next)
    if (next.passageId !== config.passageId) {
      setIndex(0)
      setStage(0)
    } else if (stage === 3) {
      setStage(2)
    }
    resetProgress()
  }
  const changeSentence = (next: number) => {
    setPreviousSentence(current)
    setIndex((next + pool.length) % pool.length)
    resetProgress(true)
    setStage(2)
  }
  const restart = () => {
    resetProgress(true)
    setStage(2)
  }
  const continueAttempt = () => {
    if (cleared) changeSentence(index + 1)
    else {
      setAutoFocus(true)
      setRevision((value) => value + 1)
      setStage(2)
    }
  }
  const onAttempt = (record: RecordEntry) => {
    const result = judgeSentence(config, streakRef.current, {
      keys: record.actualKeys ?? record.keys,
      elapsed: record.elapsed,
      rawMisses: record.rawMisses ?? record.misses,
    })
    streakRef.current = result.streak
    setStreak(result.streak)
    setAttempts((rows) =>
      [
        ...rows,
        { ...result, id: record.id, misses: record.rawMisses ?? record.misses },
      ].slice(-10),
    )
    setRecords((rows) => [...rows, record])
    recordAttempt(sentenceStatsKey(config.passageId, layout, current), record)
    if (result.cleared) {
      setStage(3)
      setAutoFocus(false)
    }
    return result.cleared
  }
  const preview = useMemo(
    () => ({
      passage: { ...passage, continuous: false, paragraphs: pool },
      sentences: pool,
      seed: '',
      typewell: false,
      etyping: false,
      rtc: false,
      articles: false,
      limit: 0,
      previewParagraphs: pool,
      paragraphSegments: pool.map((s) => s.segments),
      startPreview: () => handleStageChange(2),
    }),
    [passage, pool, handleStageChange],
  )
  useGameShortcuts((event) => {
    const key = event.key.toLowerCase()
    if (stage === 3 && summary) {
      if (key === 'r') return restart
      if (['enter', ' ', 'n'].includes(key)) return continueAttempt
    }
    if (
      (status === 'ready' || status === 'done') &&
      !document.activeElement?.closest('.typing-area') &&
      /^[1-4]$/.test(key)
    ) {
      const next = Number(key) - 1
      if (next !== 3 || summary) return () => handleStageChange(next)
    }
  })
  const progress = (
    <div className="sentence-streak" role="status" aria-label="連続達成数">
      <span>
        {cleared
          ? 'CHALLENGE CLEAR'
          : `${config.targetKpm} KPM以上 · ミス ${config.maxMisses} 以下`}
      </span>
      <strong>
        {streak}
        <small> / {config.repetitions} 回</small>
      </strong>
      <progress
        value={streak}
        max={config.repetitions}
        aria-label="連続達成の進捗"
      />
    </div>
  )
  return (
    <div className="practice-grid sentence-practice">
      <div className="practice-main">
        <PageHeading eyebrow="SENTENCE PRACTICE" title="一文練習" />
        <MissionCarousel
          stage={stage}
          onStage={handleStageChange}
          hasResult={!!summary}
        >
          {[
            stage === 0 ? (
              <div key="selection" className="sentence-library">
                <PassageLibrary
                  language={english ? 'en' : 'ja'}
                  onLanguageChange={(language) =>
                    updateConfig({
                      ...config,
                      passageId: (language === 'en'
                        ? englishPassages
                        : japanesePracticePassages)[0].id,
                    })
                  }
                  mode="sentence"
                  passages={
                    english ? englishPassages : japanesePracticePassages
                  }
                  selected={config.passageId}
                  onSelect={(passageId) =>
                    updateConfig({ ...config, passageId })
                  }
                  isFavorite={isFavorite}
                  onToggleFavorite={onToggleFavorite}
                />
                <div className="sentence-selection-footer">
                  <h3>{passage.title}</h3>
                  {passage.source?.url && (
                    <a
                      className="text-button small"
                      href={passage.source.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      出典：{passage.source.label}
                    </a>
                  )}
                  <button
                    className="primary-button"
                    onClick={() => handleStageChange(1)}
                  >
                    全文を読む
                  </button>
                </div>
              </div>
            ) : (
              <div key="selection" />
            ),
            stage === 1 ? (
              <PracticePreview key="preview" session={preview} />
            ) : (
              <div key="preview" />
            ),
            <div key="input">
              {progress}
              <SentenceAttempt
                key={`${config.passageId}/${index}/${revision}/${layout}`}
                sentence={current}
                previousSentence={previousSentence}
                onTransitionEnd={clearTransition}
                sidebarHost={sidebarHost}
                bestKpm={
                  stats[sentenceStatsKey(config.passageId, layout, current)]
                    ?.best ?? 0
                }
                passage={passage}
                settings={{ ...settings, layout }}
                autoFocus={autoFocus}
                active={stage === 2}
                onNotice={onNotice}
                onStatus={setStatus}
                onDone={onAttempt}
                onRestart={restart}
                onContinue={continueAttempt}
                cleared={cleared}
              />
            </div>,
            stage === 3 && summary ? (
              <div key="result">
                {progress}
                <SessionResult
                  record={summary}
                  heading={cleared ? 'CHALLENGE CLEAR' : 'ATTEMPT REPORT'}
                  message={`${records.length}試行 · ${streak} / ${config.repetitions}回連続達成 · 待機・中断時間を除いて集計`}
                  actions={
                    <>
                      <button className="primary-button" onClick={restart}>
                        もう一度
                      </button>
                      <button onClick={continueAttempt}>
                        {cleared ? '次の文へ' : '同じ文を続ける'}
                      </button>
                      <button onClick={() => handleStageChange(0)}>
                        文章を選び直す
                      </button>
                    </>
                  }
                />
              </div>
            ) : (
              <div key="result" />
            ),
          ]}
        </MissionCarousel>
        <SentenceWordTable
          key={`${config.passageId}/${layout}`}
          pool={pool}
          passageId={config.passageId}
          title={passage.title}
          layout={layout}
          selected={index % pool.length}
          stats={stats}
          onSelect={changeSentence}
        />
        {attempts.length > 0 && (
          <details className="sentence-attempts" aria-label="今回の試行結果">
            <summary>
              今回の試行結果 · 直近{attempts.length}回 ·{' '}
              {attempts.at(-1)!.passed ? '達成' : 'もう一度'} ·{' '}
              {attempts.at(-1)!.kpm.toFixed(1)} KPM · ミス{' '}
              {attempts.at(-1)!.misses}
            </summary>
            <ol>
              {attempts.map((attempt) => (
                <li key={attempt.id} data-passed={attempt.passed}>
                  <strong>{attempt.passed ? '達成' : 'もう一度'}</strong>
                  <span>{attempt.kpm.toFixed(1)} KPM</span>
                  <span>ミス {attempt.misses}</span>
                  <span>
                    {attempt.passed
                      ? `${attempt.streak}回連続`
                      : !attempt.speedPassed
                        ? '目標KPMを未達成'
                        : 'ミス上限を超過'}
                  </span>
                </li>
              ))}
            </ol>
          </details>
        )}
      </div>
      <aside className="session-sidebar sentence-options">
        <div ref={setSidebarHost} className="session-card-slot" />
        <div
          className="config-card sentence-challenge"
          data-game-shortcuts="off"
        >
          <span className="tiny-label">YOUR CHALLENGE</span>
          {(
            [
              ['targetKpm', '目標KPM', 10, 3000],
              ['maxMisses', 'ミス上限', 0, 100],
              ['repetitions', '連続回数', 1, 50],
            ] as const
          ).map(([field, label, min, max]) => (
            <label key={field}>
              {label}
              <input
                key={config[field]}
                type="number"
                aria-label={label}
                min={min}
                max={max}
                step="1"
                defaultValue={config[field]}
                disabled={active}
                onBlur={(event) => {
                  const goals = normalizeSentenceGoals({
                    ...config,
                    [field]:
                      event.target.value === ''
                        ? NaN
                        : Number(event.target.value),
                  })
                  event.target.value = String(goals[field])
                  if (goals[field] !== config[field])
                    updateConfig({ ...config, ...goals })
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur()
                }}
              />
            </label>
          ))}
          <button
            className="text-button"
            disabled={active}
            onClick={() => updateConfig(defaultSentencePracticeSettings)}
          >
            初期設定に戻す
          </button>
        </div>
        <InputStyleCard
          session={{
            selected: config.passageId,
            status,
            reset: () => resetProgress(),
          }}
          settings={{ ...settings, layout }}
          setSettings={setSettings}
          label="一文練習の入力方式"
        />
      </aside>
    </div>
  )
}
