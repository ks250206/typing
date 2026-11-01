import { useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { PracticeSessionCard } from './PracticeSidebar'
import { sentenceEngine } from '../../domain/typing/sentenceEngine'
import { Pause, Play, RotateCcw } from 'lucide-react'
import type { RecordEntry, Settings } from '../../domain/records/types'
import type { Sentence } from '../../domain/content/sentences'
import type { Passage } from '../../domain/content/passages'
import { SentenceView } from '../../shared/typing/SentenceView'
import { KeyboardGuide } from '../../shared/typing/KeyboardGuide'
import { PauseOverlay } from '../../shared/typing/PauseOverlay'
import { useGameShortcuts } from '../../shared/typing/useGameShortcuts'
import { usePracticeSession } from './usePracticeSession'
import type { PracticeStatus } from './usePracticeClock'
const discardRecord = () => {}

export function SentenceAttempt({
  sentence,
  previousSentence,
  onTransitionEnd,
  sidebarHost,
  bestKpm,
  passage,
  settings,
  autoFocus,
  onNotice,
  onStatus,
  onDone,
  onRestart,
  onContinue,
  cleared,
  active,
}: {
  sentence: Sentence
  previousSentence: Sentence | null
  onTransitionEnd: () => void
  sidebarHost: HTMLElement | null
  bestKpm: number
  passage: Passage
  settings: Settings
  autoFocus: boolean
  onNotice: (message: string) => void
  onStatus: (status: PracticeStatus) => void
  onDone: (record: RecordEntry) => boolean
  onRestart: () => void
  onContinue: () => void
  cleared: boolean
  active: boolean
}) {
  const document = useMemo(
    () => ({
      passage: {
        ...passage,
        id: `sentence-${passage.id}`,
        durationMs: undefined,
        paragraphs: [sentence],
      },
      sentences: [sentence],
      plan: null,
    }),
    [passage, sentence],
  )
  const session = usePracticeSession(
    settings,
    discardRecord,
    onNotice,
    document,
    { startOnFirstKey: true, onTrialComplete: onDone },
  )
  const { area, pause, focus } = session
  useEffect(() => {
    onStatus(session.status)
  }, [session.status, onStatus])
  useEffect(() => {
    if (autoFocus && active) focus()
  }, [autoFocus, active, focus])
  useEffect(() => {
    if (!active) pause()
  }, [active, pause])
  useEffect(() => {
    if (!previousSentence) return
    const timer = setTimeout(onTransitionEnd, 240)
    return () => clearTimeout(timer)
  }, [previousSentence, onTransitionEnd])
  const previous = useMemo(
    () =>
      previousSentence
        ? sentenceEngine(previousSentence, settings.layout)
        : null,
    [previousSentence, settings.layout],
  )
  useGameShortcuts((event) => {
    if (!active) return
    const key = event.key.toLowerCase()
    if (session.status === 'paused') {
      if ([' ', 'enter', 'escape'].includes(key)) return session.resume
      if (key === 'r') return onRestart
    }
    if (session.status === 'done') {
      if ([' ', 'enter', 'n'].includes(key)) return onContinue
      if (key === 'r') return onRestart
    }
  })
  return (
    <div className="sentence-attempt-content">
      {sidebarHost &&
        createPortal(
          <PracticeSessionCard session={session} bestKpm={bestKpm} />,
          sidebarHost,
        )}
      {active &&
        session.mistake &&
        createPortal(
          <div
            key={session.rawMisses}
            className="damage-overlay"
            aria-hidden="true"
          >
            <div className="damage-reticle" />
            <span className="damage-label">MISS</span>
          </div>,
          window.document.body,
        )}
      <div
        className={`typing-area sentence-attempt ${session.mistake ? 'mistake' : ''}`}
        data-status={session.status}
        data-transition={!!previousSentence}
        ref={area}
        role="region"
        aria-label="一文練習の入力領域"
        tabIndex={0}
        onKeyDown={session.accept}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget))
            session.pause()
        }}
      >
        {session.status === 'paused' && (
          <PauseOverlay onResume={session.resume} />
        )}
        <SentenceView
          current={sentence}
          position={session.snapshot.position}
          kana={settings.layout === 'kana' && sentence.language !== 'en'}
          done={session.status === 'done'}
          target={session.snapshot.target}
          typed={session.snapshot.typed}
          hint={session.snapshot.hint}
          wordColors={settings.wordColors}
          consumeTyped={settings.consumeTyped}
          showNext={false}
        />
        <KeyboardGuide
          layout={settings.layout}
          missedKey={session.missedKey}
          nextCharacter={
            settings.layout === 'kana'
              ? (session.snapshot.target[session.snapshot.position] ?? '')
              : (session.snapshot.hint[0] ?? '')
          }
          enabled={session.status === 'ready' || session.status === 'running'}
        />
      </div>
      {previousSentence && previous && (
        <div className="sentence-crossfade-out" aria-hidden="true">
          <SentenceView
            current={previousSentence}
            position={0}
            kana={
              settings.layout === 'kana' && previousSentence.language !== 'en'
            }
            done={false}
            target={previous.target}
            typed=""
            hint={previous.hint}
            wordColors={settings.wordColors}
            consumeTyped={false}
            showNext={false}
          />
        </div>
      )}
      <div
        className="practice-footer sentence-controls"
        onMouseDown={(event) => event.preventDefault()}
      >
        <button
          disabled={session.status === 'done'}
          onClick={() => {
            session.area.current?.focus()
            if (session.status === 'running') session.pause()
            else if (session.status === 'paused') session.resume()
          }}
        >
          {session.status === 'running' ? (
            <Pause size={14} />
          ) : (
            <Play size={14} />
          )}
          {session.status === 'ready'
            ? '入力欄にフォーカス'
            : session.status === 'paused'
              ? '再開'
              : '一時停止'}
        </button>
        <button onClick={onRestart}>
          <RotateCcw size={14} />
          最初から
        </button>
        {session.status === 'done' && (
          <button className="primary-button" onClick={onContinue}>
            {cleared ? '次の文へ' : '同じ文を続ける'} <kbd>Enter</kbd>
          </button>
        )}
      </div>
    </div>
  )
}
