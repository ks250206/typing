import { useMemo, useState, type Dispatch, type SetStateAction } from 'react'
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
import { layoutLabels, type Layout } from '../../domain/typing/engine'
import type { RecordEntry, Settings } from '../../domain/records/types'
import { PageHeading } from '../../shared/ui/PageHeading'
import { Select } from '../../shared/ui/Select'
import { PassageLibrary } from '../library/PassageLibrary'
import { LanguageSwitch } from '../library/LanguageSwitch'
import { SentenceAttempt } from './SentenceAttempt'
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
  const passage = practicePassages.find((p) => p.id === config.passageId)!
  const english = passage.language === 'en'
  const layout = english && settings.layout === 'kana' ? 'jis' : settings.layout
  const pool = useMemo(
    () => sentencePracticePool(config.passageId, layout),
    [config.passageId, layout],
  )
  const [index, setIndex] = useState(0)
  const [revision, setRevision] = useState(0)
  const [autoFocus, setAutoFocus] = useState(false)
  const [streak, setStreak] = useState(0)
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [status, setStatus] = useState<PracticeStatus>('ready')
  const [library, setLibrary] = useState(false)
  const current = pool[index % pool.length]
  const cleared = streak >= config.repetitions
  const active =
    status === 'running' || status === 'paused' || status === 'countdown'
  const resetProgress = (focus = false) => {
    setStreak(0)
    setAttempts([])
    setAutoFocus(focus)
    setRevision((value) => value + 1)
  }
  const updateConfig = (next: SentencePracticeSettings) => {
    setConfig(next)
    if (next.passageId !== config.passageId) setIndex(0)
    resetProgress()
  }
  const changeSentence = (next: number) => {
    setIndex((next + pool.length) % pool.length)
    resetProgress(true)
  }
  const onAttempt = (record: RecordEntry) => {
    const result = judgeSentence(config, streak, {
      keys: record.actualKeys ?? record.keys,
      elapsed: record.elapsed,
      rawMisses: record.rawMisses ?? record.misses,
    })
    setStreak(result.streak)
    setAttempts((rows) =>
      [
        ...rows,
        { ...result, id: record.id, misses: record.rawMisses ?? record.misses },
      ].slice(-10),
    )
  }
  return (
    <div className="practice-grid sentence-practice">
      <div className="practice-main">
        <PageHeading
          eyebrow="ONE SENTENCE, YOUR PACE"
          title="一文練習"
          actions={
            <button
              className="text-button"
              disabled={active}
              onClick={() => setLibrary((value) => !value)}
            >
              文章セットを選ぶ
            </button>
          }
        >
          <p>
            同じ文を、目標KPM・ミス上限以内で{config.repetitions}
            回連続。失敗したら連続回数を0に戻します。
          </p>
        </PageHeading>
        {library && (
          <div className="sentence-library">
            <LanguageSwitch
              value={english ? 'en' : 'ja'}
              onChange={(language) =>
                updateConfig({
                  ...config,
                  passageId: (language === 'en'
                    ? englishPassages
                    : japanesePracticePassages)[0].id,
                })
              }
            />
            <PassageLibrary
              key={english ? 'en' : 'ja'}
              passages={english ? englishPassages : japanesePracticePassages}
              selected={config.passageId}
              onSelect={(passageId) => {
                updateConfig({ ...config, passageId })
                setLibrary(false)
              }}
              isFavorite={isFavorite}
              onToggleFavorite={onToggleFavorite}
            />
          </div>
        )}
        <div className="sentence-challenge-heading">
          <span className="tag">
            {english ? 'English' : '日本語'} · {passage.genre}
          </span>
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
          <div className="sentence-picker" data-game-shortcuts="off">
            <button disabled={active} onClick={() => changeSentence(index - 1)}>
              前の文
            </button>
            <label>
              文章番号{' '}
              <input
                aria-label="文章番号"
                type="number"
                min="1"
                max={pool.length}
                value={(index % pool.length) + 1}
                disabled={active}
                onChange={(event) => {
                  const value = Number(event.target.value)
                  if (
                    Number.isInteger(value) &&
                    value >= 1 &&
                    value <= pool.length
                  )
                    changeSentence(value - 1)
                }}
              />{' '}
              / {pool.length}
            </label>
            <button disabled={active} onClick={() => changeSentence(index + 1)}>
              次の文
            </button>
          </div>
        </div>
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
        <SentenceAttempt
          key={`${config.passageId}/${index}/${revision}/${layout}`}
          sentence={current}
          passage={passage}
          settings={{ ...settings, layout }}
          autoFocus={autoFocus}
          onNotice={onNotice}
          onStatus={setStatus}
          onDone={onAttempt}
          onRestart={() => resetProgress(true)}
          onContinue={() => {
            if (cleared) changeSentence(index + 1)
            else {
              setAutoFocus(true)
              setRevision((value) => value + 1)
            }
          }}
          cleared={cleared}
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
                      : !attempt.speedPassed && !attempt.accuracyPassed
                        ? '速度・ミス上限を未達成'
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
        <div className="config-card" data-game-shortcuts="off">
          <span className="tiny-label">YOUR CHALLENGE</span>
          <h3>達成条件</h3>
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
          <p className="small muted">
            KPMは正しく入力したキー数で判定します。ミス上限は、連続ミスも1打ずつ数えます。
          </p>
          <label>
            入力方式
            <Select
              label="一文練習の入力方式"
              value={layout}
              disabled={active}
              options={Object.entries(layoutLabels)
                .filter(([value]) => !english || value !== 'kana')
                .map(([value, label]) => ({ value, label }))}
              onChange={(value) => {
                setSettings((s) => ({ ...s, layout: value as Layout }))
                resetProgress()
              }}
            />
          </label>
          <label
            className="toggle-row"
            onMouseDown={(event) => event.preventDefault()}
          >
            <span>単語の色分け</span>
            <input
              type="checkbox"
              checked={settings.wordColors}
              onChange={(event) =>
                setSettings((value) => ({
                  ...value,
                  wordColors: event.target.checked,
                }))
              }
            />
          </label>
          <label
            className="toggle-row"
            onMouseDown={(event) => event.preventDefault()}
          >
            <span>入力済み単語を消す</span>
            <input
              type="checkbox"
              checked={settings.consumeTyped}
              onChange={(event) =>
                setSettings((value) => ({
                  ...value,
                  consumeTyped: event.target.checked,
                }))
              }
            />
          </label>
          <button className="text-button" onClick={() => resetProgress(true)}>
            最初からやり直す
          </button>
          <button
            className="text-button"
            disabled={active}
            onClick={() => updateConfig(defaultSentencePracticeSettings)}
          >
            初期設定に戻す
          </button>
        </div>
        <div className="config-card small muted">
          <p>
            最初の1打から計測します。待ち時間と中断時間はKPMに含めません。試行結果はこの画面に直近10回を表示します。
          </p>
          <p>
            参考：
            <a
              href="https://github.com/physics-HTFI/TypeLighter"
              target="_blank"
              rel="noreferrer"
            >
              TypeLighter / physics-HTFI
            </a>
          </p>
        </div>
      </aside>
    </div>
  )
}
