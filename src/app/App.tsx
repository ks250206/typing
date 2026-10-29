import { lazy, Suspense, useState } from 'react'
import { X } from 'lucide-react'
import type { RecordEntry } from '../domain/records/types'
import { CpuBattle } from '../features/battle/CpuBattle'
import { ClearHistoryDialog } from '../features/history/ClearHistoryDialog'
import { HistoryPage } from '../features/history/HistoryPage'
import { useHistory } from '../features/history/useHistory'
import { PracticePage } from '../features/practice/PracticePage'
import { usePracticeSession } from '../features/practice/usePracticeSession'
import { SettingsDialog } from '../features/settings/SettingsDialog'
import { useSettings } from '../features/settings/useSettings'
import { AppShell } from './AppShell'
import type { AppTab } from './AppShell'
import './App.css'

const GhostBattle = lazy(() => import('../features/battle/GhostBattle'))

/** Connect feature APIs here; feature state survives page changes. */
export default function App() {
  const [tab, setTab] = useState<AppTab>('practice')
  const [notice, setNotice] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [ghostSource, setGhostSource] = useState<RecordEntry | null>(null)
  const [cpuReplay, setCpuReplay] = useState<RecordEntry | null>(null)
  const { settings, setSettings } = useSettings(setNotice)
  const history = useHistory(setNotice)
  const session = usePracticeSession(settings, history.persistResult, setNotice)
  const navigate = (next: AppTab) => {
    session.pause()
    setTab(next)
  }

  return (
    <AppShell
      settings={settings}
      tab={tab}
      onNavigate={navigate}
      onSettings={() => setShowSettings(true)}
      mistake={
        session.mistake && session.status === 'running' && tab === 'practice'
      }
      misses={session.misses}
      dialogs={
        <>
          {showSettings && (
            <SettingsDialog
              settings={settings}
              setSettings={setSettings}
              onClose={() => setShowSettings(false)}
            />
          )}
          {history.confirmClear && (
            <ClearHistoryDialog
              onClose={history.cancelClear}
              onConfirm={history.clearRecords}
            />
          )}
        </>
      }
    >
      {notice && (
        <div role="status" className="notice">
          {notice}
          <button aria-label="通知を閉じる" onClick={() => setNotice('')}>
            <X size={14} />
          </button>
        </div>
      )}
      {tab === 'ghost' && ghostSource && (
        <Suspense fallback={<p role="status">ゴースト対戦を準備中…</p>}>
          <GhostBattle
            key={ghostSource.id}
            record={ghostSource}
            settings={settings}
            onClose={() => navigate('history')}
            onRecord={history.persistResult}
          />
        </Suspense>
      )}
      {tab === 'battle' && (
        <CpuBattle
          settings={settings}
          onRecord={history.persistResult}
          replay={cpuReplay}
          onReplayConsumed={() => setCpuReplay(null)}
        />
      )}
      {tab === 'practice' && (
        <PracticePage
          session={session}
          settings={settings}
          setSettings={setSettings}
          records={history.records}
          bestRecords={history.bestRecords}
        />
      )}
      {tab === 'history' && (
        <HistoryPage
          history={history}
          onGhost={(record) => {
            setGhostSource(record)
            navigate('ghost')
          }}
          onCpuReplay={(record) => {
            setCpuReplay(record)
            navigate('battle')
          }}
          onPracticeReplay={(record) => {
            session.replayRecord(record)
            setSettings((value) => ({ ...value, layout: record.layout }))
            // reset() already stops the previous session and selects the requested seed.
            setTab('practice')
          }}
          onPractice={() => navigate('practice')}
        />
      )}
    </AppShell>
  )
}
