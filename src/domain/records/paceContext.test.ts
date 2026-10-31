import { expect, it } from 'vitest'
import { paceContexts } from './paceContext'
import { TypingTrace } from './telemetry'
it('shows typed words, transitions and actual mistakes in their second, keeps idle context and excludes the final fraction', () => {
  const trace = new TypingTrace()
  trace.begin(
    {
      text: '銀河',
      reading: 'ぎんが',
      segments: [{ text: '銀河', reading: 'ぎんが' }],
    },
    0,
    'jis',
  )
  trace.add('x', 'g', 0, false, 100)
  trace.add('g', 'g', 0, true, 200)
  trace.begin(
    {
      text: '宇宙',
      reading: 'うちゅう',
      segments: [{ text: '宇宙', reading: 'うちゅう' }],
    },
    2000,
    'jis',
  )
  trace.add('u', 'u', 0, true, 3100)
  const rows = paceContexts(trace.finish(3500))
  expect(rows).toHaveLength(3)
  expect(rows[0]).toMatchObject({
    words: ['銀河'],
    prompts: [{ index: 0, text: '銀河' }],
    mistakes: ['x → g'],
  })
  expect(rows[1].words).toEqual(['銀河'])
  expect(rows[2]).toMatchObject({
    words: [],
    prompts: [{ index: 1, text: '宇宙' }],
  })
})
