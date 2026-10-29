import { Check, Pause, Play, RotateCcw } from 'lucide-react'
import type { Settings } from '../../domain/records/types'
import { layoutLabels } from '../../domain/typing/engine'
import { KeyboardGuide } from '../../shared/typing/KeyboardGuide'
import { SentenceView } from '../../shared/typing/SentenceView'
import type { PracticeSession } from './usePracticeSession'

export function PracticeInput({
  session,
  settings,
}: {
  session: Pick<
    PracticeSession,
    | 'sentences'
    | 'seed'
    | 'typewell'
    | 'articles'
    | 'limit'
    | 'durationMs'
    | 'status'
    | 'startCount'
    | 'sentenceIndex'
    | 'elapsed'
    | 'keys'
    | 'snapshot'
    | 'mistake'
    | 'normalizedKeys'
    | 'progress'
    | 'area'
    | 'focus'
    | 'reset'
    | 'pause'
    | 'resume'
    | 'beginCountdown'
    | 'accept'
    | 'handleStageChange'
  >
  settings: Settings
}) {
  const {
    sentences,
    seed,
    typewell,
    articles,
    limit,
    durationMs,
    status,
    startCount,
    sentenceIndex,
    elapsed,
    keys,
    snapshot,
    mistake,
    normalizedKeys,
    progress,
    area,
    focus,
    reset,
    pause,
    resume,
    beginCountdown,
    accept,
    handleStageChange,
  } = session
  return (
    <div key="input">
      <div
        className="typing-area"
        ref={area}
        tabIndex={0}
        role="region"
        aria-label="タイピング入力領域。IME をオフにして入力"
        onKeyDown={accept}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) pause()
        }}
      >
        <div className="reading-toolbar">
          <span className={`live-label ${status === 'running' ? 'live' : ''}`}>
            <span />
            {
              {
                ready: 'READY WHEN YOU ARE',
                countdown: 'STARTING',
                running: 'IN THE FLOW',
                paused: 'PAUSED',
                done: 'INPUT FINISHED',
              }[status]
            }
          </span>
          <span className="small muted">
            {layoutLabels[settings.layout]} ·{' '}
            {durationMs ? (
              <span aria-label="残り時間">
                残り {Math.max(0, Math.ceil((durationMs - elapsed) / 1000))} 秒
              </span>
            ) : typewell ? (
              `${Math.max(0, normalizedKeys)} / ${limit} 打 · ${seed}`
            ) : articles ? (
              `${sentenceIndex + 1} / ${sentences.length} 条`
            ) : (
              `${sentenceIndex + 1} / ${sentences.length} 文`
            )}
          </span>
        </div>
        {status === 'ready' && (
          <div
            className="practice-overlay"
            data-phase="ready"
            role="group"
            aria-label="練習の開始"
          >
            <button
              className="practice-start-button"
              onClick={() => {
                beginCountdown()
                area.current?.focus()
              }}
            >
              <kbd>Space</kbd>でスタート
            </button>
            <p>3秒のカウント後に計測開始 · IME OFF</p>
          </div>
        )}
        {status === 'paused' && (
          <div
            className="practice-overlay"
            data-phase="paused"
            role="group"
            aria-label="一時停止中"
          >
            <span className="practice-pause-label">PAUSED</span>
            <button className="practice-start-button" onClick={resume}>
              <Play size={24} />
              再開する
            </button>
            <p>計測を止めています</p>
          </div>
        )}
        {status === 'countdown' && (
          <div
            className="practice-overlay practice-countdown"
            data-phase="countdown"
            role="status"
            aria-live="polite"
            aria-atomic="true"
            aria-label={`開始まで${startCount}秒`}
          >
            <strong>{startCount}</strong>
            <span>まもなくスタート</span>
          </div>
        )}
        <SentenceView
          current={sentences[sentenceIndex]}
          next={sentences[sentenceIndex + 1]}
          showNext={!typewell && !durationMs}
          partialRoman={typewell}
          position={snapshot.position}
          kana={settings.layout === 'kana'}
          done={status === 'done' && !durationMs}
          target={snapshot.target}
          typed={snapshot.typed}
          hint={snapshot.hint}
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
        <div className={`session-controls ${mistake ? 'mistake' : ''}`}>
          {keys > 0 && (status === 'running' || status === 'done') && (
            <span key={keys} className="keyburst" aria-hidden="true">
              <span className="burst-ring" />
              {Array.from({ length: 6 }, (_, i) => (
                <i key={i} style={{ rotate: `${i * 60}deg` }} />
              ))}
            </span>
          )}
          {status === 'done' && (
            <div className="finish-message">
              <Check size={20} />
              入力終了。
              <button onClick={() => handleStageChange(3)}>結果を見る</button>
            </div>
          )}
        </div>
      </div>
      <div className="practice-footer" onMouseDown={(e) => e.preventDefault()}>
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
            {status === 'paused' ? <Play size={14} /> : <Pause size={14} />}
            <span>
              {status === 'paused'
                ? '再開'
                : status === 'countdown'
                  ? 'キャンセル'
                  : '一時停止'}
            </span>
            <kbd>esc</kbd>
          </button>
        </div>
      </div>
    </div>
  )
}
