import type { SessionTrace } from './telemetry'
import type { CpuConfig } from '../battle/cpuMatch'
import type { Layout } from '../typing/engine'
import type { PaceSummary } from './pace'

export interface RecordEntry {
  pace?: PaceSummary
  trace?: SessionTrace
  hasTrace?: boolean
  cpuConfig?: CpuConfig
  id: string
  passageId: string
  title: string
  layout: Layout
  date: string
  elapsed: number
  keys: number
  misses: number
  kpm: number
  accuracy: number
  point?: number
  rank?: string
  rawMisses?: number
  scoreVersion?: number
  missPenalty?: number
  seed?: string
  replayVersion?: 1 | 2
  strokeLimit?: number
  actualKeys?: number
  ghostSourceId?: string
  mode?: 'practice' | 'cpu' | 'trainer' | 'ghost' | 'weak'
}
export interface Settings {
  displayScale: number
  layout: Layout
  background: boolean
  wordColors: boolean
  consumeTyped: boolean
  navigationMotion: 'on' | 'system' | 'off'
}
