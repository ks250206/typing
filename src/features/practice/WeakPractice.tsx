import { useEffect, useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { RecordEntry, Settings } from '../../domain/records/types'
import { extractWeakWords, weakDocument } from '../../domain/records/weakWords'
import { readTraces } from '../../infrastructure/persistence/traceStore'
import { PracticeInput } from './PracticeInput'
import { PracticeSidebar } from './PracticeSidebar'
import { usePracticeSession } from './usePracticeSession'
import { SessionResult } from '../results/SessionResult'

interface Props {
  records: RecordEntry[]
  bestRecords: RecordEntry[]
  settings: Settings
  setSettings: Dispatch<SetStateAction<Settings>>
  onRecord: (r: RecordEntry) => void
  onNotice: (message: string) => void
}
export default function WeakPractice(props: Props) {
  const [loaded, setLoaded] = useState<RecordEntry[] | null>(null)
  const [selected, setSelected] = useState<string[] | null>(null)
  const [repetitions, setRepetitions] = useState(5)
  const [plan, setPlan] = useState<ReturnType<typeof weakDocument> | null>(null)
  useEffect(() => {
    let active = true
    void readTraces(props.records.map((r) => r.id)).then((traces) => {
      if (active)
        setLoaded(
          props.records.map((r) => ({ ...r, trace: r.trace ?? traces[r.id] })),
        )
    })
    return () => {
      active = false
    }
  }, [props.records])
  const words = useMemo(
    () => (loaded ? extractWeakWords(loaded) : []),
    [loaded],
  )
  const choices = (selected ?? words.slice(0, 5).map((w) => w.id)).filter(
    (id) => words.some((w) => w.id === id),
  )
  if (plan)
    return <WeakRun {...props} document={plan} onBack={() => setPlan(null)} />
  return (
    <section className="weak-practice" aria-label="苦手ワード練習">
      <div className="section-heading">
        <h2>苦手ワード練習</h2>
      </div>
      <p>
        直近200件の打鍵ログから、ミスや待ち時間の多い単語を抽出します。1文字の語や主な助詞・記号を除き、読みが確認できる単語だけを使います。
      </p>
      {!loaded ? (
        <p role="status">打鍵ログを読み込み中…</p>
      ) : !words.length ? (
        <p role="status">
          練習候補がありません。通常練習で打鍵ログを残すと、ここで苦手な単語を選べます。読み区切りのない旧ログは候補に含めません。
        </p>
      ) : (
        <>
          <div className="weak-controls">
            <label>
              繰り返し回数
              <input
                aria-label="繰り返し回数"
                type="number"
                min={1}
                max={20}
                value={repetitions}
                onChange={(e) =>
                  setRepetitions(
                    Math.max(
                      1,
                      Math.min(20, Math.trunc(Number(e.target.value)) || 1),
                    ),
                  )
                }
              />
            </label>
            <button
              onClick={() => setSelected(words.slice(0, 20).map((w) => w.id))}
            >
              上位20語を選択
            </button>
            <button onClick={() => setSelected([])}>選択を解除</button>
            <button
              className="primary-button"
              disabled={!choices.length}
              onClick={() =>
                setPlan(
                  weakDocument(
                    words.filter((w) => choices.includes(w.id)),
                    repetitions,
                  ),
                )
              }
            >
              {choices.length}語で反復練習
            </button>
          </div>
          <div className="weak-word-list">
            {words.map((w) => (
              <label key={w.id} className="weak-word">
                <input
                  type="checkbox"
                  aria-label={`${w.text}を練習`}
                  checked={choices.includes(w.id)}
                  disabled={!choices.includes(w.id) && choices.length >= 20}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked
                        ? [...choices, w.id]
                        : choices.filter((id) => id !== w.id),
                    )
                  }
                />
                <span>
                  <strong>{w.text}</strong>
                  <small>{w.reading}</small>
                </span>
                <small>
                  実ミス {w.misses} · ロス目安 {(w.loss / 1000).toFixed(2)}秒 ·{' '}
                  {w.attempts}回
                </small>
              </label>
            ))}
          </div>
          <p className="small muted">
            最大20語・各20回まで。単語の区切りは保存されたふりがな対応に合わせます。ロスは正打鍵間隔の中央値を超えた待ち時間の目安です。反復練習の結果は通常練習と別に保存します。
          </p>
        </>
      )}
    </section>
  )
}
function WeakRun({
  document,
  onBack,
  ...props
}: Props & { document: ReturnType<typeof weakDocument>; onBack: () => void }) {
  const session = usePracticeSession(
    props.settings,
    props.onRecord,
    props.onNotice,
    document,
  )
  const { area } = session
  useEffect(() => {
    area.current?.focus()
  }, [area])
  return (
    <section aria-label="苦手ワードの反復練習">
      {session.mistake && session.status === 'running' && (
        <div
          key={session.rawMisses}
          className="damage-overlay"
          aria-hidden="true"
        />
      )}
      <div className="section-heading">
        <h2>{document.passage.title}</h2>
        <button onClick={onBack}>単語を選び直す</button>
      </div>
      <div className="practice-grid">
        <div className="practice-main weak-run">
          {session.finishedResult ? (
            <SessionResult
              record={session.finishedResult}
              history={[...props.records, ...props.bestRecords]}
              heading="反復練習 COMPLETE"
              actions={
                <>
                  <button
                    className="primary-button"
                    onClick={() => {
                      session.reset()
                      session.focus()
                    }}
                  >
                    同じ単語でもう一度
                  </button>
                  <button onClick={onBack}>単語を選び直す</button>
                </>
              }
            />
          ) : (
            <PracticeInput session={session} settings={props.settings} />
          )}
        </div>
        <PracticeSidebar
          session={session}
          settings={props.settings}
          setSettings={props.setSettings}
          records={props.records}
          bestRecords={props.bestRecords}
        />
      </div>
    </section>
  )
}
