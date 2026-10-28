import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowRight,
  AudioLines,
  BookOpen,
  Check,
  ChevronRight,
  Clock3,
  Command,
  History,
  Keyboard,
  Pause,
  Play,
  RotateCcw,
  Settings2,
  Sparkles,
  Target,
  Trash2,
  X,
} from 'lucide-react'
import { KanaEngine, RomanEngine, mapKey } from './engine'
import type { Layout } from './engine'
import { passages as essayPassages } from './passages'
import {
  freshSeed,
  isTypewell,
  strokeLimit,
  typewellDocument,
  typewellPassages,
  typewellEngine,
} from './typewell'
import {
  appendHistory,
  clearHistory,
  mergeHistory,
  readHistory,
  readSettings,
  saveSettings,
  subscribeHistory,
} from './storage'
import { CpuBattle } from './CpuBattle'
import { animalRank, MissEpisodes, scorePoint } from './scoring'
import { KeyboardGuide } from './KeyboardGuide'
import { MissionCarousel } from './MissionCarousel'
import { RubyText } from './RubyText'
import { SentenceView } from './SentenceView'
import { sentencesByPassage } from './sentences'
import type { RecordEntry } from './storage'
const SpaceScene = lazy(() =>
  import('./SpaceScene').then((m) => ({ default: m.SpaceScene })),
)
import './App.css'
const layoutLabels: Record<Layout, string> = {
  jis: 'QWERTY · JIS',
  us: 'QWERTY · US',
  dvorak: 'Dvorak',
  kana: 'JIS かな',
}
const time = (ms: number) =>
  `${Math.floor(ms / 60000)
    .toString()
    .padStart(2, '0')}:${Math.floor((ms / 1000) % 60)
    .toString()
    .padStart(2, '0')}`
const passages = [...essayPassages, ...typewellPassages]
function practiceDocument(
  id: string,
  seed: string,
  layout: Layout,
  version: 1 | 2,
) {
  return isTypewell(id)
    ? typewellDocument(id, seed, layout, version)
    : {
        passage: passages.find((p) => p.id === id)!,
        sentences: sentencesByPassage[id],
        plan: null,
      }
}
type Status = 'ready' | 'running' | 'paused' | 'done'
function makeEngine(reading: string, layout: Layout) {
  return layout === 'kana' ? new KanaEngine(reading) : new RomanEngine(reading)
}
export default function App() {
  const [seedPreferences] = useState(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem('yohaku.typewell.v1') ?? 'null',
      )
      if (
        saved?.fixed &&
        typeof saved.seed === 'string' &&
        saved.seed.length > 0 &&
        saved.seed.length <= 64
      )
        return {
          seed: saved.seed,
          fixed: true,
          version: saved.version === 2 ? (2 as const) : (1 as const),
        }
    } catch {
      /* A fresh seed also works without storage. */
    }
    return { seed: freshSeed(), fixed: false, version: 2 as const }
  })
  const [seed, setSeed] = useState(seedPreferences.seed)
  const [replayVersion, setReplayVersion] = useState<1 | 2>(
    seedPreferences.version,
  )
  const [seedDraft, setSeedDraft] = useState(seed)
  const [fixedSeed, setFixedSeed] = useState(seedPreferences.fixed)
  const [selected, setSelected] = useState(passages[0].id),
    [tab, setTab] = useState('practice'),
    [genre, setGenre] = useState('すべて')
  const [settings, setSettings] = useState(readSettings),
    [records, setRecords] = useState(readHistory),
    [status, setStatus] = useState<Status>('ready'),
    [sentenceIndex, setSentenceIndex] = useState(0),
    [elapsed, setElapsed] = useState(0),
    [keys, setKeys] = useState(0),
    [misses, setMisses] = useState(0),
    [rawMisses, setRawMisses] = useState(0),
    [missPenalty, setMissPenalty] = useState(0),
    [snapshot, setSnapshot] = useState(() => {
      const initial = makeEngine(
        sentencesByPassage[passages[0].id][0].reading,
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
    [notice, setNotice] = useState(''),
    [showSettings, setShowSettings] = useState(false),
    [confirmClear, setConfirmClear] = useState(false),
    [practiceStage, setPracticeStage] = useState(0)
  const practice = useMemo(
    () => practiceDocument(selected, seed, settings.layout, replayVersion),
    [selected, seed, settings.layout, replayVersion],
  )
  const { passage, sentences } = practice
  const typewell = isTypewell(selected)
  const limit = strokeLimit(settings.layout)
  const engine = useRef(makeEngine(sentences[0].reading, settings.layout)),
    area = useRef<HTMLDivElement>(null),
    unsavedRecords = useRef<RecordEntry[]>([]),
    started = useRef(0),
    accumulated = useRef(0),
    missTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    focusRevision = useRef(0),
    missEpisodes = useRef(new MissEpisodes())
  const paragraphSegments = useMemo(() => {
    let cursor = 0
    if (typewell) return [sentences[0].segments]
    return passage.paragraphs.map((paragraph) => {
      const segments = []
      let length = 0
      while (length < paragraph.text.length) {
        const sentence = sentences[cursor++]
        segments.push(...sentence.segments)
        length += sentence.text.length
      }
      return segments
    })
  }, [passage, sentences, typewell])
  const handleStageChange = (stage: number) => {
    if (stage !== 2) pause()
    setPracticeStage(stage)
    if (stage === 2) focus()
  }
  const elapsedNow = () =>
    accumulated.current +
    // Sampled by pause/finish handlers, never during render.
    // oxlint-disable-next-line react/purity
    (started.current ? performance.now() - started.current : 0)
  const focus = () => {
    const revision = ++focusRevision.current
    const previous = document.activeElement
    requestAnimationFrame(() => {
      const el = area.current
      if (!el || el.closest('[inert]')) return
      const animations = el.closest('.mission-face')?.getAnimations() ?? []
      void Promise.allSettled(
        animations.map((animation) => animation.finished),
      ).then(() => {
        if (
          !el.isConnected ||
          revision !== focusRevision.current ||
          el.closest('[inert]')
        )
          return
        if (
          document.activeElement !== previous &&
          document.activeElement !== document.body &&
          document.activeElement !== el
        )
          return
        el.focus()
      })
    })
  }
  const reset = (
    id = selected,
    layout = settings.layout,
    stage = practiceStage,
    nextSeed = fixedSeed ? seed : freshSeed(),
    version: 1 | 2 = fixedSeed && id === selected ? replayVersion : 2,
  ) => {
    if (isTypewell(id)) {
      setReplayVersion(version)
      setSeed(nextSeed)
      setSeedDraft(nextSeed)
    }
    const doc = practiceDocument(id, nextSeed, layout, version)
    engine.current = doc.plan
      ? typewellEngine(doc.plan)
      : makeEngine(doc.sentences[0].reading, layout)
    setSelected(id)
    setSentenceIndex(0)
    setStatus('ready')
    setPracticeStage(stage)
    setElapsed(0)
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
    started.current = 0
    accumulated.current = 0
  }
  const pause = () => {
    if (status === 'running') {
      clearTimeout(missTimer.current)
      setMistake(false)
      accumulated.current = elapsedNow()
      started.current = 0
      setElapsed(accumulated.current)
      setStatus('paused')
    }
  }
  const resume = () => {
    if (status === 'paused') {
      // oxlint-disable-next-line react/purity
      started.current = performance.now()
      setStatus('running')
    }
    focus()
  }
  useEffect(() => {
    try {
      localStorage.setItem(
        'yohaku.typewell.v1',
        JSON.stringify({ seed, fixed: fixedSeed, version: replayVersion }),
      )
    } catch {
      /* Keep playing without persistence. */
    }
  }, [seed, fixedSeed, replayVersion])
  useEffect(() => {
    if (status !== 'running') return
    const timer = setInterval(
      () =>
        setElapsed(accumulated.current + performance.now() - started.current),
      100,
    )
    return () => clearInterval(timer)
  }, [status])
  useEffect(() => {
    // Report a failure from the external storage system, once per settings change.
    if (!saveSettings(settings))
      // oxlint-disable-next-line react/set-state-in-effect
      setNotice('設定を保存できません。この画面では引き続き使えます。')
  }, [settings])
  useEffect(() => {
    const hidden = () => {
      if (document.hidden) pause()
    }
    document.addEventListener('visibilitychange', hidden)
    return () => document.removeEventListener('visibilitychange', hidden)
  })
  useEffect(
    () =>
      subscribeHistory((latest) =>
        setRecords(mergeHistory(latest, unsavedRecords.current)),
      ),
    [],
  )
  useEffect(() => () => clearTimeout(missTimer.current), [])
  useEffect(() => {
    if (!showSettings && !confirmClear) return
    const previous = document.activeElement as HTMLElement | null
    const modal = document.querySelector<HTMLElement>(
      '[role="dialog"], [role="alertdialog"]',
    )
    const controls = () =>
      Array.from(
        modal?.querySelectorAll<HTMLElement>(
          'button,input,select,[tabindex="0"]',
        ) ?? [],
      )
    controls()[0]?.focus()
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowSettings(false)
        setConfirmClear(false)
      }
      if (e.key === 'Tab') {
        const items = controls(),
          first = items[0],
          last = items.at(-1)
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last?.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first?.focus()
        }
      }
    }
    document.addEventListener('keydown', handle)
    return () => {
      document.removeEventListener('keydown', handle)
      previous?.focus()
    }
  }, [showSettings, confirmClear])
  const persistResult = (result: RecordEntry) => {
    void appendHistory(result, unsavedRecords.current).then(
      ({ records: latest, saved }) => {
        if (saved)
          unsavedRecords.current = unsavedRecords.current.filter(
            (r) => !latest.some((item) => item.id === r.id),
          )
        else {
          unsavedRecords.current = mergeHistory(unsavedRecords.current, [
            result,
          ])
          setNotice('記録を保存できません。JSON を書き出して保管してください。')
        }
        setRecords(mergeHistory(latest, unsavedRecords.current))
      },
    )
  }
  const accept = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return
    if (e.key === 'Escape') {
      e.preventDefault()
      pause()
      return
    }
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return
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
    if (status === 'paused' || status === 'done') return
    const key = mapKey(e.nativeEvent, settings.layout)
    if (!key) return
    e.preventDefault()
    if (status === 'ready') {
      // This clock is sampled only by the keyboard event handler.
      // oxlint-disable-next-line react/purity
      started.current = performance.now()
      setStatus('running')
    }
    if (!engine.current.feed(key)) {
      if (missEpisodes.current.miss()) setMisses(missEpisodes.current.misses)
      setRawMisses(missEpisodes.current.raw)
      setMissPenalty(missEpisodes.current.penalty)
      setMistake(true)
      clearTimeout(missTimer.current)
      missTimer.current = setTimeout(() => setMistake(false), 520)
      return
    }
    missEpisodes.current.accept()
    const nextKeys = keys + 1
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
      if (!typewell && sentenceIndex < sentences.length - 1) {
        const n = sentenceIndex + 1
        setSentenceIndex(n)
        engine.current = makeEngine(sentences[n].reading, settings.layout)
        setSnapshot({
          position: engine.current.position,
          target: engine.current.target,
          hint: engine.current.hint,
          typed: '',
          naturalKeys: 0,
        })
      } else {
        const duration = elapsedNow()
        accumulated.current = duration
        started.current = 0
        setElapsed(duration)
        clearTimeout(missTimer.current)
        setMistake(false)
        setStatus('done')
        const scoredKeys = typewell ? limit : nextKeys
        const result: RecordEntry = {
          id: crypto.randomUUID(),
          passageId: passage.id,
          title: passage.title,
          layout: settings.layout,
          // Completion timestamp is produced only by the keyboard event handler.
          // oxlint-disable-next-line react/purity
          date: new Date().toISOString(),
          elapsed: duration,
          keys: scoredKeys,
          actualKeys: nextKeys,
          misses,
          rawMisses: missEpisodes.current.raw,
          point: scorePoint(scoredKeys, missEpisodes.current.penalty, duration),
          rank: animalRank(
            scorePoint(scoredKeys, missEpisodes.current.penalty, duration),
          ),
          scoreVersion: 3,
          missPenalty: missEpisodes.current.penalty,
          ...(typewell ? { seed, strokeLimit: limit, replayVersion } : {}),
          mode: 'practice',
          kpm: Math.round(scoredKeys / (Math.max(duration, 1) / 60000)),
          accuracy: Number(((nextKeys / (nextKeys + misses)) * 100).toFixed(2)),
        }
        persistResult(result)
      }
    }
  }
  const normalizedKeys = typewell ? snapshot.naturalKeys : keys
  const progress =
    status === 'done'
      ? 100
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
    accuracy = keys + misses ? (keys / (keys + misses)) * 100 : 100
  const best = records
    .filter((r) => r.passageId === selected && r.layout === settings.layout)
    .reduce((n, r) => Math.max(n, r.kpm), 0)
  const exportRecords = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify({ version: 1, records }, null, 2)], {
        type: 'application/json',
      }),
    )
    const a = document.createElement('a')
    a.href = url
    a.download = 'galactype-records.json'
    a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <div className="app-shell">
      {settings.background && (
        <Suspense
          fallback={<div className="space-loading" aria-hidden="true" />}
        >
          <SpaceScene enabled />
        </Suspense>
      )}
      {mistake && status === 'running' && tab === 'practice' && (
        <div key={misses} className="damage-overlay" aria-hidden="true">
          <div className="damage-reticle" />
          <span className="damage-label">MISS</span>
        </div>
      )}
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault()
            pause()
            setTab('practice')
          }}
        >
          <span className="brand-icon" aria-hidden="true">
            G
          </span>
          <span>
            GALACTYPE<span className="brand-caption">COSMIC TYPING</span>
          </span>
        </a>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {[
            ['practice', Keyboard, 'タイピング'],
            ['library', BookOpen, '文章ライブラリ'],
            ['battle', Target, 'CPU対戦'],
            ['history', History, '練習の記録'],
          ].map(([id, Icon, label]) => {
            const I = Icon as typeof Keyboard
            return (
              <button
                key={String(id)}
                className={`nav-item ${tab === id ? 'active' : ''}`}
                onClick={() => {
                  pause()
                  setTab(String(id))
                }}
              >
                <I size={18} />
                {String(label)}
                {tab === id && <span className="nav-dot" />}
              </button>
            )
          })}
        </nav>
        <div className="sidebar-note">
          <span className="tiny-label">YOUR OWN PACE</span>
          <p>速さの、その先へ。</p>
          <span>
            一文字ずつ、深く潜る。
            <br />
            自分のリズムで、長文を。
          </span>
          <div className="note-orbit">✧</div>
        </div>
        <button
          className="nav-item settings-link"
          onClick={() => setShowSettings(true)}
        >
          <Settings2 size={18} />
          環境設定
        </button>
        <div className="local-status">
          <span />
          ローカルに保存 · あなただけの記録
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div>
            <span className="breadcrumb">WORKSPACE</span>
            <ChevronRight size={12} />
            <span>
              {
                {
                  practice: 'タイピング',
                  library: '文章ライブラリ',
                  history: '練習の記録',
                  battle: 'CPU対戦',
                }[tab]
              }
            </span>
          </div>
          <span className="topbar-right">
            <span className="status-dot" />
            FOCUS MODE <span className="keycap">⌘</span>
          </span>
        </header>
        <div className="content">
          <section className="hero">
            <div className="hero-content">
              <div className="eyebrow">
                <span />
                DEEP SPACE · JAPANESE TYPING
              </div>
              <h1>
                {tab === 'history' ? (
                  '積み重ねた、あなたの軌跡。'
                ) : tab === 'library' ? (
                  '次に潜る、言葉の世界。'
                ) : (
                  <>
                    指先から、
                    <br />
                    宇宙へ。
                  </>
                )}
              </h1>
              <p>
                {tab === 'history'
                  ? '昨日の自分から、少しずつ。数字に、続けてきた時間が宿る。'
                  : tab === 'library'
                    ? '文学、科学、日常。気分に合う一篇を、今日の練習に。'
                    : '一打ごとに、言葉が光る。\n次の一文を先読みして、自分だけの軌道へ。'}
              </p>
              <div className="hero-tags">
                <span>
                  <BookOpen size={13} />
                  長文に没頭
                </span>
                <span>
                  <Keyboard size={13} />
                  4つの入力方式
                </span>
                <span>
                  <History size={13} />
                  記録はこの端末に
                </span>
              </div>
            </div>
            <div className="orbit-label">
              <span className="orbit-line" /> A SPACE FOR YOUR FLOW{' '}
              <span>01 — ∞</span>
            </div>
          </section>
          {notice && (
            <div role="status" className="notice">
              {notice}
              <button aria-label="通知を閉じる" onClick={() => setNotice('')}>
                <X size={14} />
              </button>
            </div>
          )}
          {tab === 'battle' && (
            <CpuBattle settings={settings} onRecord={persistResult} />
          )}
          {tab === 'practice' && (
            <>
              <div className="section-heading">
                <div>
                  <span className="section-number">01 /</span>
                  <h2>今日の一篇</h2>
                  <span className="muted">言葉の流れに、身をまかせる。</span>
                </div>
                <button
                  className="text-button"
                  onClick={() => {
                    pause()
                    setTab('library')
                  }}
                >
                  文章を選ぶ
                  <ArrowRight size={14} />
                </button>
              </div>
              <div className="practice-grid">
                <div className="practice-main">
                  <MissionCarousel
                    stage={practiceStage}
                    onStage={handleStageChange}
                  >
                    {[
                      <div key="selected">
                        <div className="passage-header">
                          <div>
                            <span className="tag">{passage.genre}</span>
                            <span className="muted small">
                              {typewell
                                ? 'R 400打 / K 280打 · '
                                : passage.source
                                  ? 'PUBLIC TEXT · '
                                  : 'ORIGINAL ESSAY · '}
                              {typewell
                                ? 'ランダム出題'
                                : passage.paragraphs.reduce(
                                    (n, p) => n + p.text.length,
                                    0,
                                  )}{' '}
                              {!typewell && '文字'}
                            </span>
                            <h2>{passage.title}</h2>
                            <p>{passage.subtitle}</p>
                            {passage.source && (
                              <a
                                className="text-button"
                                href={passage.source.url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                出典：{passage.source.label}
                              </a>
                            )}
                          </div>
                          <span className="passage-symbol">
                            {passage.accent}
                          </span>
                        </div>
                        {typewell && (
                          <div className="seed-settings">
                            <label>
                              <input
                                type="checkbox"
                                checked={fixedSeed}
                                onChange={(e) => setFixedSeed(e.target.checked)}
                              />{' '}
                              シードを固定する
                            </label>
                            <label>
                              出題シード
                              <input
                                aria-label="出題シード"
                                maxLength={64}
                                value={seedDraft}
                                onChange={(e) => setSeedDraft(e.target.value)}
                              />
                            </label>
                            <button
                              className="text-button"
                              disabled={
                                !seedDraft.trim() || status === 'running'
                              }
                              onClick={() =>
                                reset(
                                  selected,
                                  settings.layout,
                                  0,
                                  seedDraft.trim(),
                                )
                              }
                            >
                              このシードを使う
                            </button>
                            <button
                              className="text-button"
                              disabled={fixedSeed}
                              onClick={() =>
                                reset(selected, settings.layout, 0, freshSeed())
                              }
                            >
                              単語をシャッフル
                            </button>
                            <p>
                              単語間のスペースも含め、自然な表記で{limit}
                              打。余分なローマ字は進捗に加算しません。末尾は単語の途中でも終了します。
                            </p>
                            <small>
                              再現ID: {selected} / v{replayVersion} / {seed} ·{' '}
                              {settings.layout}
                            </small>
                          </div>
                        )}
                        <div className="mission-select-actions">
                          <p>言葉の軌道を選んで、読み、指先で旅をする。</p>
                          <div className="mission-story-choices">
                            {passages.map((item) => (
                              <button
                                key={item.id}
                                aria-pressed={selected === item.id}
                                onClick={() =>
                                  reset(item.id, settings.layout, 0)
                                }
                              >
                                {item.title}
                              </button>
                            ))}
                          </div>
                          <button
                            className="primary-button"
                            onClick={() => handleStageChange(1)}
                          >
                            全文を読む <ArrowRight size={16} />
                          </button>
                        </div>
                      </div>,
                      <section className="passage-preview" key="preview">
                        <div className="mission-face-heading">
                          <span className="eyebrow">MISSION BRIEFING</span>
                          <h2>{passage.title}</h2>
                          <p>
                            {typewell
                              ? `${limit}打分の単語列 / シード ${seed}`
                              : `${sentences.length} 文 / ${passage.paragraphs.length} 段落`}
                          </p>
                        </div>
                        <div id="passage-full-text">
                          <ol>
                            {paragraphSegments.map((segments, index) => (
                              <li key={index}>
                                <p>
                                  <RubyText segments={segments} />
                                </p>
                              </li>
                            ))}
                          </ol>
                          <button
                            className="primary-button"
                            onClick={() => {
                              setPracticeStage(2)
                              if (status === 'paused') resume()
                              else focus()
                            }}
                          >
                            この文章でスタート <ArrowRight size={16} />
                          </button>
                        </div>
                      </section>,
                      <div key="input">
                        <div
                          className="typing-area"
                          ref={area}
                          tabIndex={0}
                          role="region"
                          aria-label="タイピング入力領域。IME をオフにして入力"
                          onKeyDown={accept}
                          onBlur={(event) => {
                            if (
                              !event.currentTarget.contains(event.relatedTarget)
                            )
                              pause()
                          }}
                        >
                          <div className="reading-toolbar">
                            <span
                              className={`live-label ${status === 'running' ? 'live' : ''}`}
                            >
                              <span />
                              {
                                {
                                  ready: 'READY WHEN YOU ARE',
                                  running: 'IN THE FLOW',
                                  paused: 'PAUSED',
                                  done: 'SESSION COMPLETE',
                                }[status]
                              }
                            </span>
                            <span className="small muted">
                              {layoutLabels[settings.layout]} ·{' '}
                              {typewell
                                ? `${Math.max(0, normalizedKeys)} / ${limit} 打 · ${seed}`
                                : `${sentenceIndex + 1} / ${sentences.length} 文`}
                            </span>
                          </div>
                          <SentenceView
                            current={sentences[sentenceIndex]}
                            next={sentences[sentenceIndex + 1]}
                            showNext={!typewell}
                            partialRoman={typewell}
                            position={snapshot.position}
                            kana={settings.layout === 'kana'}
                            done={status === 'done'}
                            target={snapshot.target}
                            typed={snapshot.typed}
                            hint={snapshot.hint}
                            guide={settings.guide}
                            wordColors={settings.wordColors}
                            consumeTyped={settings.consumeTyped}
                          />
                          <KeyboardGuide
                            layout={settings.layout}
                            nextCharacter={
                              settings.layout === 'kana'
                                ? (snapshot.target[snapshot.position] ?? '')
                                : (snapshot.hint[0] ?? '')
                            }
                            enabled={status === 'ready' || status === 'running'}
                          />
                          <div
                            className={`session-controls ${mistake ? 'mistake' : ''}`}
                          >
                            {keys > 0 &&
                              (status === 'running' || status === 'done') && (
                                <span
                                  key={keys}
                                  className="keyburst"
                                  aria-hidden="true"
                                >
                                  <span className="burst-ring" />
                                  {Array.from({ length: 6 }, (_, i) => (
                                    <i
                                      key={i}
                                      style={{ rotate: `${i * 60}deg` }}
                                    />
                                  ))}
                                </span>
                              )}
                            {status === 'ready' && (
                              <div className="start-hint">
                                <Keyboard size={14} />
                                ここをクリックして、最初の文字からスタート
                                <span>IME OFF</span>
                              </div>
                            )}
                            {status === 'paused' && (
                              <button
                                className="resume-button"
                                onClick={resume}
                              >
                                <Play size={14} />
                                再開する
                              </button>
                            )}
                            {status === 'done' && (
                              <div className="finish-message">
                                <Check size={20} />
                                一篇を、最後まで。完走です。
                                <button
                                  onClick={() => {
                                    reset()
                                    focus()
                                  }}
                                >
                                  もう一度
                                  <RotateCcw size={14} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        <div
                          className="practice-footer"
                          onMouseDown={(e) => e.preventDefault()}
                        >
                          <div>
                            <span className="progress-track">
                              <span style={{ width: `${progress}%` }} />
                            </span>
                            <span>{Math.floor(progress)}%</span>
                          </div>
                          <div>
                            <button
                              onClick={() => {
                                reset()
                                focus()
                              }}
                            >
                              <RotateCcw size={14} />
                              やり直す
                            </button>
                            <button
                              disabled={status === 'ready' || status === 'done'}
                              onClick={status === 'paused' ? resume : pause}
                            >
                              {status === 'paused' ? (
                                <Play size={14} />
                              ) : (
                                <Pause size={14} />
                              )}
                              <span>
                                {status === 'paused' ? '再開' : '一時停止'}
                              </span>
                              <kbd>esc</kbd>
                            </button>
                          </div>
                        </div>
                      </div>,
                    ]}
                  </MissionCarousel>
                </div>
                <aside className="session-sidebar">
                  <div className="session-card">
                    <div className="card-heading">
                      <span className="tiny-label">THIS SESSION</span>
                      <AudioLines size={15} />
                    </div>
                    <div className="point-panel">
                      <strong>
                        {point}
                        <small> pt</small>
                      </strong>
                      <span>{animalRank(point)}</span>
                      <small>正打鍵KPM × 補正正確率²</small>
                      <small>
                        連続ミス減点 1 / .75 / .5 / .35 / .25（5回〜）
                      </small>
                    </div>
                    <div className="primary-stat">
                      <span>{kpm}</span>
                      <span>
                        KPM<small>正しく打ったキー / 分</small>
                      </span>
                    </div>
                    <div className="stat-grid">
                      <div>
                        <Target size={14} />
                        <span>正確率</span>
                        <strong>
                          {accuracy.toFixed(1)}
                          <small>%</small>
                        </strong>
                      </div>
                      <div>
                        <Clock3 size={14} />
                        <span>経過時間</span>
                        <strong>{time(elapsed)}</strong>
                      </div>
                    </div>
                    <div className="miss-stat">
                      <span>ミス</span>
                      <strong>{misses}</strong>
                      {rawMisses !== misses && (
                        <small>実ミス {rawMisses} 打鍵</small>
                      )}
                      <span>打鍵</span>
                      <strong>{keys}</strong>
                    </div>
                    <div className="best">
                      <Sparkles size={14} />
                      <span>この文章の自己ベスト</span>
                      <strong>
                        {best || '—'}
                        <small> KPM</small>
                      </strong>
                    </div>
                  </div>
                  <div
                    className="config-card"
                    onMouseDown={(e) => {
                      if ((e.target as HTMLElement).closest('.toggle-row'))
                        e.preventDefault()
                    }}
                  >
                    <span className="tiny-label">INPUT STYLE</span>
                    <label htmlFor="layout">入力方式</label>
                    <select
                      id="layout"
                      value={settings.layout}
                      disabled={status === 'running' || status === 'paused'}
                      onChange={(e) => {
                        const layout = e.target.value as Layout
                        setSettings((s) => ({ ...s, layout }))
                        reset(selected, layout)
                      }}
                    >
                      {Object.entries(layoutLabels).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                    <label className="toggle-row">
                      <span>入力ガイド</span>
                      <input
                        type="checkbox"
                        checked={settings.guide}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            guide: e.target.checked,
                          }))
                        }
                      />
                    </label>
                    <label className="toggle-row">
                      <span>3D 背景</span>
                      <input
                        type="checkbox"
                        checked={settings.background}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            background: e.target.checked,
                          }))
                        }
                      />
                    </label>
                    <div
                      className="display-options"
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      <label className="toggle-row">
                        <span>単語の色分け</span>
                        <input
                          type="checkbox"
                          checked={settings.wordColors}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              wordColors: e.target.checked,
                            }))
                          }
                        />
                      </label>
                      <label className="toggle-row">
                        <span>入力済み単語を消す</span>
                        <input
                          type="checkbox"
                          checked={settings.consumeTyped}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              consumeTyped: e.target.checked,
                            }))
                          }
                        />
                      </label>
                    </div>
                    <p className="config-help">
                      IME を OFF にして入力。
                      <br />
                      {settings.layout === 'dvorak'
                        ? '物理キーを Dvorak 配列に変換します。OS は QWERTY に設定。'
                        : settings.layout === 'kana'
                          ? 'JIS 物理配列に対応。濁点・半濁点は別打鍵です。'
                          : 'し → shi / si など、打ち方は自由。'}
                    </p>
                  </div>
                  <div className="tip">
                    <Command size={17} />
                    <p>
                      速さよりも、流れを。
                      <br />
                      <span>
                        先の文章を読みながら、
                        <br />
                        自分のリズムを見つけましょう。
                      </span>
                    </p>
                  </div>
                </aside>
              </div>
            </>
          )}
          {tab === 'library' && (
            <>
              <div className="section-heading">
                <div>
                  <h2>文章ライブラリ</h2>
                  <span className="muted">
                    {essayPassages.length} TEXTS + {typewellPassages.length}{' '}
                    WORD SETS
                  </span>
                </div>
              </div>
              <div className="filters">
                {['すべて', ...new Set(passages.map((p) => p.genre))].map(
                  (g) => (
                    <button
                      className={genre === g ? 'selected' : ''}
                      key={g}
                      onClick={() => setGenre(g)}
                    >
                      {g}
                    </button>
                  ),
                )}
              </div>
              <div className="library-grid">
                {passages
                  .filter((p) => genre === 'すべて' || p.genre === genre)
                  .map((p) => (
                    <button
                      className="story-card"
                      key={p.id}
                      onClick={() => {
                        reset(p.id, settings.layout, 0)
                        setTab('practice')
                      }}
                    >
                      <div className="story-art">
                        <span>{p.accent}</span>
                        <BookOpen size={38} />
                        <span className="tag">{p.genre}</span>
                      </div>
                      <h3>{p.title}</h3>
                      <p>{p.subtitle}</p>
                      <div>
                        <span>
                          {isTypewell(p.id)
                            ? 'R 400打 / K 280打 · シード再現対応'
                            : `${p.paragraphs.reduce((n, p) => n + p.text.length, 0)} 文字 · ${p.paragraphs.length} 段落`}
                        </span>
                        <ArrowRight size={17} />
                      </div>
                    </button>
                  ))}
              </div>
            </>
          )}
          {tab === 'history' && (
            <>
              <div className="section-heading">
                <div>
                  <h2>練習の記録</h2>
                  <span className="muted">
                    直近 {records.length} セッション / 最大 200 件
                  </span>
                </div>
                <div>
                  <button className="text-button" onClick={exportRecords}>
                    <ArrowDownToLine size={14} />
                    JSON 書出し
                  </button>
                  <button
                    className="icon-button"
                    aria-label="全記録を削除"
                    onClick={() => setConfirmClear(true)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              {records.length ? (
                <div className="history-table">
                  <table>
                    <thead>
                      <tr>
                        <th>文章 / 日時</th>
                        <th>入力方式</th>
                        <th>point / 称号</th>
                        <th>KPM</th>
                        <th>正確率</th>
                        <th>時間</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((r) => (
                        <tr key={r.id}>
                          <td>
                            {r.title}
                            {r.seed && isTypewell(r.passageId) && (
                              <button
                                className="text-button"
                                onClick={() => {
                                  setFixedSeed(true)
                                  reset(
                                    r.passageId,
                                    r.layout,
                                    0,
                                    r.seed!,
                                    r.replayVersion ?? 1,
                                  )
                                  setSettings((value) => ({
                                    ...value,
                                    layout: r.layout,
                                  }))
                                  setTab('practice')
                                }}
                              >
                                シード {r.seed} を再現
                              </button>
                            )}
                            <small>
                              {new Date(r.date).toLocaleString('ja-JP')}
                            </small>
                          </td>
                          <td>{layoutLabels[r.layout]}</td>
                          <td>
                            {scorePoint(
                              r.keys,
                              r.missPenalty ?? r.misses,
                              r.elapsed,
                            )}{' '}
                            pt
                            <small>
                              {animalRank(
                                scorePoint(
                                  r.keys,
                                  r.missPenalty ?? r.misses,
                                  r.elapsed,
                                ),
                              )}
                              {r.scoreVersion !== 3 ? ' · 旧ミス方式' : ''}
                            </small>
                          </td>
                          <td className="record-kpm">{r.kpm}</td>
                          <td>{r.accuracy}%</td>
                          <td>{time(r.elapsed)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">
                  <History size={32} />
                  <h3>最初の一篇から、はじめよう。</h3>
                  <p>最後まで打ち終えると、ここに記録が残ります。</p>
                  <button
                    className="primary-button"
                    onClick={() => setTab('practice')}
                  >
                    タイピングへ
                    <ArrowRight size={15} />
                  </button>
                </div>
              )}
            </>
          )}
          <footer className="page-footer">
            <span>
              GALACTYPE <span>—</span> 言葉と、自分に向き合う時間。
            </span>
            <span>NO RUSH. JUST FLOW.</span>
          </footer>
        </div>
      </main>
      {showSettings && (
        <div className="modal-backdrop" onClick={() => setShowSettings(false)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="close"
              aria-label="閉じる"
              onClick={() => setShowSettings(false)}
            >
              <X />
            </button>
            <Settings2 size={22} />
            <h2 id="settings-title">あなたの集中環境</h2>
            <p>
              入力方式は練習画面で選べます。配列を切り替えると、練習は最初からになります。
            </p>
            <label className="toggle-row">
              3D 背景
              <input
                type="checkbox"
                checked={settings.background}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, background: e.target.checked }))
                }
              />
            </label>
            <label className="toggle-row">
              入力ガイド
              <input
                type="checkbox"
                checked={settings.guide}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, guide: e.target.checked }))
                }
              />
            </label>
            <p>
              記録と設定はこのブラウザのみに保存されます。ブラウザのデータを消すと失われるため、記録画面から書き出しておけます。
            </p>
            <button
              className="primary-button"
              onClick={() => setShowSettings(false)}
            >
              設定を閉じる
              <Check size={15} />
            </button>
          </section>
        </div>
      )}
      {confirmClear && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="alertdialog"
            aria-labelledby="clear-title"
          >
            <h2 id="clear-title">すべての記録を削除しますか？</h2>
            <p>
              この操作は取り消せません。必要な記録は JSON に書き出してください。
            </p>
            <div className="modal-actions">
              <button onClick={() => setConfirmClear(false)}>キャンセル</button>
              <button
                className="primary-button"
                onClick={async () => {
                  if (await clearHistory()) {
                    unsavedRecords.current = []
                    setRecords([])
                    setConfirmClear(false)
                  } else
                    setNotice(
                      '削除できませんでした。ブラウザの保存設定を確認してください。',
                    )
                }}
              >
                削除する
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
