import { useEffect, useState } from 'react'
import {
  readPracticeSeed,
  savePracticeSeed,
} from '../../infrastructure/persistence/practiceSeed'

export function usePracticeSeed() {
  const [seedPreferences] = useState(readPracticeSeed)
  const [seed, setSeed] = useState(seedPreferences.seed)
  const [replayVersion, setReplayVersion] = useState<1 | 2>(
    seedPreferences.version,
  )
  const [seedDraft, setSeedDraft] = useState(seed)
  const [fixedSeed, setFixedSeed] = useState(seedPreferences.fixed)
  useEffect(() => {
    savePracticeSeed({ seed, fixed: fixedSeed, version: replayVersion })
  }, [seed, fixedSeed, replayVersion])
  return {
    seed,
    setSeed,
    replayVersion,
    setReplayVersion,
    seedDraft,
    setSeedDraft,
    fixedSeed,
    setFixedSeed,
  }
}
