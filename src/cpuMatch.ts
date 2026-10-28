import { KanaEngine, RomanEngine } from './engine'
import type { Layout } from './engine'
import type { Sentence } from './sentences'
import { MissEpisodes } from './scoring'

export type Curve = 'constant' | 'ease-in'
export interface CpuConfig {
  kpm: number
  reactionMs: number
  curve: Curve
}
export const cpuPresets = [
  { name: 'リス / 入門', kpm: 180, reactionMs: 500, curve: 'ease-in' },
  { name: 'ネコ / 標準', kpm: 300, reactionMs: 320, curve: 'ease-in' },
  { name: 'ウサギ / 上級', kpm: 500, reactionMs: 240, curve: 'ease-in' },
  { name: 'チーター / 達人', kpm: 900, reactionMs: 180, curve: 'constant' },
] satisfies (CpuConfig & { name: string })[]
export function cpuCharacters(elapsedMs: number, config: CpuConfig) {
  if (elapsedMs < config.reactionMs) return 0
  const t = elapsedMs - config.reactionMs
  const active =
    config.curve === 'constant' ? t : t - 700 * (1 - Math.exp(-t / 700))
  return 1 + (active * config.kpm) / 60000
}
export function cpuDuration(length: number, config: CpuConfig) {
  if (config.curve === 'constant')
    return config.reactionMs + (Math.max(0, length - 1) * 60000) / config.kpm
  let low = config.reactionMs,
    high = config.reactionMs + (length * 60000) / config.kpm + 700
  for (let i = 0; i < 48; i++) {
    const mid = (low + high) / 2
    if (cpuCharacters(mid, config) < length) low = mid
    else high = mid
  }
  return high
}
export function roundWinner(
  first: 'player' | 'cpu',
  playerAccuracy: number,
  cpuAccuracy = 1,
) {
  if (first === 'player' && playerAccuracy < 0.95 && cpuAccuracy >= 0.95)
    return 'cpu'
  if (first === 'cpu' && cpuAccuracy < 0.95 && playerAccuracy >= 0.95)
    return 'player'
  return first
}
export type MatchPhase =
  | 'countdown'
  | 'playing'
  | 'word-result'
  | 'round-result'
  | 'paused'
  | 'finished'
export class RtcMatch {
  phase: MatchPhase = 'countdown'
  private previousPhase: MatchPhase = 'playing'
  deadline = 3000
  wordStart = 3000
  wordEnd = 3000
  cpuDeadline = Infinity
  engine: RomanEngine | KanaEngine
  typed = ''
  wordIndex = 0
  roundPlayer = 0
  roundCpu = 0
  roundsPlayer = 0
  roundsCpu = 0
  keys = 0
  totalKeys = 0
  totalMisses = 0
  totalRaw = 0
  totalElapsed = 0
  roundElapsed = 0
  private playerTypingMs = 0
  private cpuTypingMs = 0
  private cpuKeys = 0
  private firstKeyAt: number | undefined
  misses = new MissEpisodes()
  lastWord: 'player' | 'cpu' = 'cpu'
  lastRound: 'player' | 'cpu' = 'cpu'
  accuracyReversal = false
  prompts: Sentence[]
  layout: Layout
  config: CpuConfig
  constructor(prompts: Sentence[], layout: Layout, config: CpuConfig) {
    this.prompts = prompts
    this.layout = layout
    this.config = config
    if (
      !prompts.length ||
      !Number.isFinite(config.kpm) ||
      config.kpm <= 0 ||
      !Number.isFinite(config.reactionMs) ||
      config.reactionMs < 0
    )
      throw Error('Invalid CPU match')
    this.engine = this.makeEngine()
  }
  elapsedInWord(now: number) {
    return this.phase === 'playing' ||
      (this.phase === 'paused' && this.previousPhase === 'playing')
      ? Math.max(0, now - this.wordStart)
      : Math.max(0, this.wordEnd - this.wordStart)
  }
  get awaitingStart() {
    return (
      this.phase === 'countdown' ||
      (this.phase === 'paused' && this.previousPhase === 'countdown')
    )
  }
  get sentence() {
    return this.prompts[this.wordIndex % this.prompts.length]
  }
  private makeEngine() {
    return this.layout === 'kana'
      ? new KanaEngine(this.sentence.reading)
      : new RomanEngine(this.sentence.reading)
  }
  get cpuLength() {
    return this.layout === 'kana'
      ? new KanaEngine(this.sentence.reading).target.length
      : new RomanEngine(this.sentence.reading).hint.length
  }
  get accuracy() {
    return this.keys
      ? this.keys / (this.keys + this.misses.misses)
      : this.misses.misses
        ? 0
        : 1
  }
  get totalAccuracy() {
    const misses = this.totalMisses + this.misses.misses
    const keys = this.totalKeys + this.keys
    return keys ? keys / (keys + misses) : misses ? 0 : 1
  }
  startWord(now: number) {
    this.engine = this.makeEngine()
    this.typed = ''
    this.misses.accept()
    this.firstKeyAt = undefined
    this.wordStart = now
    this.wordEnd = now
    this.cpuDeadline = now + cpuDuration(this.cpuLength, this.config)
    this.phase = 'playing'
  }
  advance(now: number, deferExactCpu = false) {
    if (
      this.phase === 'paused' ||
      this.phase === 'finished' ||
      this.phase === 'round-result'
    )
      return
    // Handle a delayed frame against deadlines, never award using the delayed paint time.
    for (let guard = 0; guard < 100; guard++) {
      if (this.phase === 'countdown' && now >= this.deadline) {
        this.startWord(this.deadline)
        continue
      }
      if (this.phase === 'word-result' && now >= this.deadline) {
        this.wordIndex++
        this.startWord(this.deadline)
        continue
      }
      if (
        this.phase === 'playing' &&
        (now > this.cpuDeadline || (!deferExactCpu && now >= this.cpuDeadline))
      ) {
        this.finishWord('cpu', this.cpuDeadline)
        continue
      }
      break
    }
  }
  feed(key: string, now: number) {
    const word = this.wordIndex
    this.advance(now, true)
    if (this.wordIndex !== word || this.phase !== 'playing') return false
    this.firstKeyAt ??= now
    if (!this.engine.feed(key)) {
      this.misses.miss()
      return false
    }
    this.misses.accept()
    this.keys++
    this.typed += key
    if (this.engine.done) {
      let winner: 'player' | 'cpu' = 'player'
      if (now === this.cpuDeadline) {
        const playerTp =
          (this.keys /
            Math.max(1, this.playerTypingMs + now - (this.firstKeyAt ?? now))) *
          this.accuracy
        const cpuTp =
          (this.cpuKeys + this.cpuLength) /
          Math.max(
            1,
            this.cpuTypingMs + now - this.wordStart - this.config.reactionMs,
          )
        if (playerTp <= cpuTp) winner = 'cpu'
      }
      this.finishWord(winner, now)
    }
    return true
  }
  private finishWord(winner: 'player' | 'cpu', now: number) {
    if (this.phase !== 'playing') return
    this.lastWord = winner
    this.wordEnd = now
    if (winner === 'player') this.roundPlayer++
    else this.roundCpu++
    const elapsed = Math.max(0, now - this.wordStart)
    this.playerTypingMs +=
      this.firstKeyAt === undefined ? 0 : Math.max(0, now - this.firstKeyAt)
    this.cpuTypingMs += Math.max(0, elapsed - this.config.reactionMs)
    this.cpuKeys += Math.min(
      this.cpuLength,
      Math.floor(cpuCharacters(elapsed, this.config) + 1e-8),
    )
    this.roundElapsed += elapsed
    this.totalElapsed += elapsed
    if (this.roundPlayer >= 10 || this.roundCpu >= 10) {
      this.lastRound = roundWinner(winner, this.accuracy)
      this.accuracyReversal = this.lastRound !== winner
      if (this.lastRound === 'player') this.roundsPlayer++
      else this.roundsCpu++
      this.phase =
        this.roundsPlayer >= 4 || this.roundsCpu >= 4
          ? 'finished'
          : 'round-result'
    } else {
      this.phase = 'word-result'
      this.deadline = now + 650
    }
  }
  nextRound(now: number) {
    if (this.phase !== 'round-result') return
    this.totalKeys += this.keys
    this.totalMisses += this.misses.misses
    this.totalRaw += this.misses.raw
    this.keys = 0
    this.misses = new MissEpisodes()
    this.roundElapsed = 0
    this.playerTypingMs = 0
    this.cpuTypingMs = 0
    this.cpuKeys = 0
    this.roundPlayer = 0
    this.roundCpu = 0
    this.wordIndex++
    this.accuracyReversal = false
    this.phase = 'countdown'
    this.deadline = now + 3000
  }
  pause() {
    if (['playing', 'countdown', 'word-result'].includes(this.phase)) {
      this.previousPhase = this.phase
      this.phase = 'paused'
    }
  }
  resume() {
    if (this.phase === 'paused') this.phase = this.previousPhase
  }
}
