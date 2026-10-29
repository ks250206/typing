import { ArrowRight } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import type { RecordEntry, Settings } from '../../domain/records/types'
import { SessionResult } from '../results/SessionResult'
import { MissionCarousel } from './MissionCarousel'
import { PracticeInput } from './PracticeInput'
import { PracticePreview } from './PracticePreview'
import { PracticeSelection } from './PracticeSelection'
import { PracticeSidebar } from './PracticeSidebar'
import type { PracticeSession } from './usePracticeSession'

export function PracticePage({
  session,
  settings,
  setSettings,
  records,
  bestRecords,
}: {
  session: PracticeSession
  settings: Settings
  setSettings: Dispatch<SetStateAction<Settings>>
  records: RecordEntry[]
  bestRecords: RecordEntry[]
}) {
  const {
    selected,
    durationMs,
    practiceStage,
    finishedResult,
    focus,
    reset,
    pause,
    handleStageChange,
  } = session
  return (
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
            handleStageChange(0)
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
            hasResult={!!finishedResult}
          >
            {[
              <PracticeSelection
                key="selected"
                session={session}
                settings={settings}
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
                        onClick={() => {
                          reset(selected, settings.layout, 2)
                          focus()
                        }}
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
