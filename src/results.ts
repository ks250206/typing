import type { SessionTrace } from './telemetry'
import { analyzeTrace } from './telemetry'
/** Copy a round into its own zero-based clock and prompt indexes, without changing the full log. */
export function roundTrace(
  trace: SessionTrace,
  firstPrompt: number,
  start: number,
): SessionTrace {
  return {
    version: 1,
    elapsed: trace.elapsed - start,
    prompts: trace.prompts
      .slice(firstPrompt)
      .map((p) => ({
        ...p,
        start: p.start - start,
        end: p.end - start,
        segments: p.segments?.map((s) => ({ ...s })),
      })),
    strokes: trace.strokes
      .filter((s) => s.prompt >= firstPrompt)
      .map((s) => ({ ...s, t: s.t - start, prompt: s.prompt - firstPrompt })),
  }
}
export function resultAnalysis(trace: SessionTrace) {
  const analysis = analyzeTrace(trace)
  const groups = new Map<
    string,
    {
      prompt: number
      character: string
      expected: string
      key: string
      count: number
      first: number
    }
  >()
  for (const s of trace.strokes) {
    if (s.correct) continue
    const id = JSON.stringify([s.prompt, s.position, s.expected, s.key])
    const row = groups.get(id)
    if (row) row.count++
    else
      groups.set(id, {
        prompt: s.prompt,
        character: s.character,
        expected: s.expected,
        key: s.key,
        count: 1,
        first: s.t,
      })
  }
  return {
    ...analysis,
    mistakes: [...groups.values()].sort(
      (a, b) => b.count - a.count || a.first - b.first,
    ),
  }
}
