import type { SessionTrace } from './telemetry'
import type { Layout } from '../typing/engine'
import { sentenceWordStarts } from '../typing/wordSpacing'

/** Match the same one-second bins used by analyzeTrace, including idle context. */
export function paceContexts(trace: SessionTrace, layout: Layout = 'jis') {
  const spans = trace.prompts.map((prompt) => {
    if (!prompt.segments?.length) return []
    const sentence = {
      text: prompt.text,
      reading: prompt.reading,
      segments: prompt.segments,
    }
    const starts = [
      0,
      ...sentenceWordStarts(sentence).segments,
      prompt.segments.length,
    ].sort((a, b) => a - b)
    const offsets = [0]
    for (const segment of prompt.segments)
      offsets.push(
        offsets.at(-1)! +
          segment.reading.normalize(layout === 'kana' ? 'NFD' : 'NFC').length,
      )
    return starts.slice(0, -1).map((start, index) => ({
      from: offsets[start],
      to: offsets[starts[index + 1]],
      text: prompt
        .segments!.slice(start, starts[index + 1])
        .map((s) => s.text)
        .join(''),
    }))
  })
  const count = Math.floor(trace.elapsed / 1000)
  const bins = Array.from({ length: count }, () => ({
    words: new Set<string>(),
    prompts: new Set<number>(),
    mistakes: new Set<string>(),
  }))
  for (const stroke of trace.strokes) {
    const i = Math.min(
      Math.ceil(trace.elapsed / 1000) - 1,
      Math.floor(stroke.t / 1000),
    )
    const bin = bins[i]
    if (!bin) continue
    bin.words.add(
      spans[stroke.prompt]?.find(
        (word) => stroke.position >= word.from && stroke.position < word.to,
      )?.text ?? stroke.character,
    )
    bin.prompts.add(stroke.prompt)
    if (!stroke.correct)
      bin.mistakes.add(
        `${stroke.key === ' ' ? 'Space' : stroke.key} → ${stroke.expected === ' ' ? 'Space' : stroke.expected}`,
      )
  }
  let last = ''
  let lastPrompt = -1
  return bins.map((bin, i) => {
    if (!bin.prompts.size) {
      // A silent second still belongs to the displayed problem.
      const prompt = trace.prompts.findLastIndex(
        (p) => p.start <= i * 1000 && p.end >= i * 1000,
      )
      if (prompt >= 0) bin.prompts.add(prompt)
      if (last && prompt === lastPrompt) bin.words.add(last)
    }
    const words = [...bin.words]
    last = words.at(-1) ?? ''
    lastPrompt = [...bin.prompts].at(-1) ?? -1
    return {
      words,
      prompts: [...bin.prompts].flatMap((index) =>
        trace.prompts[index]
          ? [{ index, text: trace.prompts[index].text }]
          : [],
      ),
      mistakes: [...bin.mistakes],
    }
  })
}
