import {
  ChevronRight,
  History,
  Keyboard,
  Settings2,
  Target,
  Repeat2,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { lazy, Suspense } from 'react'
import type { Settings } from '../domain/records/types'

export type AppTab = 'practice' | 'battle' | 'history' | 'ghost' | 'weak'
const SpaceScene = lazy(() =>
  import('./SpaceScene').then((m) => ({ default: m.SpaceScene })),
)
export function AppShell({
  settings,
  tab,
  onNavigate,
  onSettings,
  mistake,
  misses,
  children,
  dialogs,
  favorites,
}: {
  settings: Settings
  tab: AppTab
  onNavigate: (tab: AppTab) => void
  onSettings: () => void
  mistake: boolean
  misses: number
  children: ReactNode
  dialogs: ReactNode
  favorites: ReactNode
}) {
  return (
    <div
      className="app-shell"
      data-navigation-motion={settings.navigationMotion}
    >
      {settings.background && (
        <Suspense
          fallback={<div className="space-loading" aria-hidden="true" />}
        >
          <SpaceScene enabled />
        </Suspense>
      )}
      {mistake && (
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
            onNavigate('practice')
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
        <nav aria-label="WORKSPACE">
          {[
            ['practice', Keyboard, 'タイピング'],
            ['battle', Target, 'CPU対戦'],
            ['history', History, '練習の記録'],
            ['weak', Repeat2, '苦手ワード練習'],
          ].map(([id, Icon, label]) => {
            const I = Icon as typeof Keyboard
            return (
              <button
                key={String(id)}
                className={`nav-item ${tab === id ? 'active' : ''}`}
                onClick={() => {
                  onNavigate(String(id) as AppTab)
                }}
              >
                <I size={18} />
                {String(label)}
                {tab === id && <span className="nav-dot" />}
              </button>
            )
          })}
        </nav>
        {favorites}
        <button className="nav-item settings-link" onClick={() => onSettings()}>
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
                  weak: '苦手ワード練習',
                  practice: 'タイピング',
                  ghost: 'ゴースト対戦',
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
        <div className="content page-view" key={tab}>
          {children}
          <footer className="page-footer">
            <span>
              GALACTYPE <span>—</span> 言葉と、自分に向き合う時間。
            </span>
            <span>NO RUSH. JUST FLOW.</span>
          </footer>
        </div>
      </main>
      {dialogs}
    </div>
  )
}
