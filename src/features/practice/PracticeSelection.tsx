import { ArrowRight } from 'lucide-react'
import { practicePassages as passages } from '../../domain/content/practiceDocument'
import { freshSeed } from '../../domain/content/typewell'
import type { Settings } from '../../domain/records/types'
import { PassageLibrary } from '../library/PassageLibrary'
import type { PracticeSession } from './usePracticeSession'
import { isRtcOriginal } from '../../domain/content/rtcOriginal'

export function PracticeSelection({
  session,
  settings,
  isFavorite,
  onToggleFavorite,
}: {
  session: Pick<
    PracticeSession,
    | 'selected'
    | 'passage'
    | 'sentences'
    | 'seed'
    | 'seedDraft'
    | 'fixedSeed'
    | 'replayVersion'
    | 'typewell'
    | 'etyping'
    | 'rtc'
    | 'trainer'
    | 'articles'
    | 'seeded'
    | 'limit'
    | 'status'
    | 'reset'
    | 'handleStageChange'
    | 'setSeedDraft'
    | 'setFixedSeed'
  >
  settings: Settings
  isFavorite: (passageId: string) => boolean
  onToggleFavorite: (passageId: string) => void
}) {
  const {
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
    status,
    reset,
    handleStageChange,
    setSeedDraft,
    setFixedSeed,
  } = session
  return (
    <div key="selected">
      <PassageLibrary
        passages={passages}
        selected={selected}
        onSelect={(id) => reset(id, settings.layout, 0)}
        isFavorite={isFavorite}
        onToggleFavorite={onToggleFavorite}
      />
      <div className="passage-header">
        <div>
          <span className="tag">{passage.genre}</span>
          <span className="muted small">
            {typewell
              ? 'R 400打 / K 280打 · '
              : etyping
                ? 'WORD SET · '
                : passage.source
                  ? passage.source.kind === 'provided'
                    ? 'PROVIDED TEXT · '
                    : 'PUBLIC TEXT · '
                  : 'ORIGINAL ESSAY · '}
            {typewell
              ? 'ランダム出題'
              : passage.paragraphs.reduce((n, p) => n + p.text.length, 0)}{' '}
            {!typewell && '文字'}
          </span>
          <h2>{passage.title}</h2>
          <p>{passage.subtitle}</p>
          {passage.source?.url ? (
            <a
              className="text-button"
              href={passage.source.url}
              target="_blank"
              rel="noreferrer"
            >
              出典：{passage.source.label}
            </a>
          ) : passage.source ? (
            <p className="small muted">出典：{passage.source.label}</p>
          ) : null}
        </div>
        <span className="passage-symbol">{passage.accent}</span>
      </div>
      {seeded && (
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
              !seedDraft.trim() ||
              status === 'running' ||
              status === 'countdown'
            }
            onClick={() =>
              reset(selected, settings.layout, 0, seedDraft.trim())
            }
          >
            このシードを使う
          </button>
          <button
            className="text-button"
            disabled={fixedSeed}
            onClick={() => reset(selected, settings.layout, 0, freshSeed())}
          >
            {etyping || rtc || trainer || articles
              ? '問題をシャッフル'
              : '単語をシャッフル'}
          </button>
          <p>
            {articles ? (
              '指定14条を各1回、条単位でシャッフルします。各条の全項を収録し、条内の順序は保ちます。同じシードで同じ順番を再現します。'
            ) : trainer ? (
              replayVersion === 1 ? (
                '旧記録の出題方式（v1）を再現しています。'
              ) : (
                `全${sentences.length}文を1周するごとに再シャッフルします。全文確認は1周目のみ。同じシードで2周目以降も再現します。`
              )
            ) : rtc ? (
              isRtcOriginal(selected) ? (
                '独自短文から重複なしで15問を選びます。同じシードで同じ15問・同じ順番を再現します。'
              ) : (
                '各パートから1フレーズを選んで連結します。同じシードで同じ15問・同じ順番を再現します。'
              )
            ) : etyping ? (
              '同じシードで同じ15問・同じ順番を再現します。重複なしのランダム出題です。'
            ) : (
              <>
                単語間のスペースも含め、自然な表記で{limit}
                打。余分なローマ字は進捗に加算しません。末尾は単語の途中でも終了します。
              </>
            )}
          </p>
          <small>
            再現ID: {selected} / v
            {etyping || rtc || articles ? 1 : replayVersion} / {seed} ·{' '}
            {settings.layout}
          </small>
        </div>
      )}
      <div className="mission-select-actions">
        <p>言葉の軌道を選んで、読み、指先で旅をする。</p>
        <button className="primary-button" onClick={() => handleStageChange(1)}>
          全文を読む <ArrowRight size={16} />
        </button>
      </div>
    </div>
  )
}
