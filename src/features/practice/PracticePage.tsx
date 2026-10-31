import { PageHeading } from '../../shared/ui/PageHeading'
import type { Dispatch, SetStateAction } from 'react'
import type { RecordEntry, Settings } from '../../domain/records/types'
import { SessionResult } from '../results/SessionResult'
import { MissionCarousel } from './MissionCarousel'
import { PracticeInput } from './PracticeInput'
import { PracticePreview } from './PracticePreview'
import { PracticeSelection } from './PracticeSelection'
import { PracticeSidebar } from './PracticeSidebar'
import type { PracticeSession } from './usePracticeSession'
import { useGameShortcuts } from '../../shared/typing/useGameShortcuts'
import { FavoriteButton } from '../favorites/FavoriteButton'

export function PracticePage({
  session,
  settings,
  setSettings,
  records,
  bestRecords,
  isFavorite,
  onToggleFavorite,
}: {
  session: PracticeSession
  settings: Settings
  setSettings: Dispatch<SetStateAction<Settings>>
  records: RecordEntry[]
  bestRecords: RecordEntry[]
  isFavorite: (passageId: string) => boolean
  onToggleFavorite: (passageId: string) => void
}) {
  const {
    selected,
    durationMs,
    practiceStage,
    finishedResult,
    focus,
    reset,
    handleStageChange,
    status,
    resume,
    area,
  } = session
  const retry = () => {
    reset(selected, settings.layout, 2)
    focus()
  }
  useGameShortcuts((event) => {
    const key = event.key.toLowerCase()
    if (practiceStage === 3 && finishedResult && key === 'r') return retry
    if (practiceStage === 2 && status === 'paused') {
      if (key === 'r') return retry
      if ([' ', 'escape', 'enter'].includes(key)) return resume
    }
    if (
      (status === 'ready' || status === 'done') &&
      !area.current?.contains(document.activeElement) &&
      /^[1-4]$/.test(key)
    ) {
      const stage = Number(key) - 1
      if (stage !== 3 || finishedResult) return () => handleStageChange(stage)
    }
  })
  return (
    <>
      <div className="practice-grid">
        <div className="practice-main">
          <PageHeading
            eyebrow="SOLO PRACTICE"
            title="タイピング"
            actions={
              <FavoriteButton
                active={isFavorite(selected)}
                onClick={() => onToggleFavorite(selected)}
              />
            }
          />
          <MissionCarousel
            stage={practiceStage}
            onStage={handleStageChange}
            hasResult={!!finishedResult}
          >
            {[
              <PracticeSelection
                key="selected"
                session={session}
                settings={settings}
                isFavorite={isFavorite}
                onToggleFavorite={onToggleFavorite}
              />,
              <PracticePreview key="preview" session={session} />,
              <PracticeInput
                key="input"
                session={session}
                settings={settings}
              />,
              finishedResult ? (
                <SessionResult
                  key={finishedResult.id}
                  record={finishedResult}
                  heading={durationMs ? 'TIME UP' : 'SESSION COMPLETE'}
                  history={[...records, ...bestRecords]}
                  message={
                    durationMs
                      ? '60秒の計測が終了しました。'
                      : '一篇を、最後まで。完走です。'
                  }
                  actions={
                    <>
                      <button
                        className="primary-button"
                        aria-keyshortcuts="r"
                        onClick={retry}
                      >
                        もう一度
                      </button>
                      <button
                        onClick={() => reset(selected, settings.layout, 0)}
                      >
                        文章を選び直す
                      </button>
                    </>
                  }
                />
              ) : (
                <div key="result-empty" />
              ),
            ]}
          </MissionCarousel>
        </div>
        <PracticeSidebar
          session={session}
          settings={settings}
          setSettings={setSettings}
          records={records}
          bestRecords={bestRecords}
        />
      </div>
    </>
  )
}
