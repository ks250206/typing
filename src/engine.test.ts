import { describe, expect, it } from 'vitest'
import { KanaEngine, RomanEngine, mapKey } from './engine'
import { passages } from './passages'
function accepts(reading: string, keys: string) {
  const e = new RomanEngine(reading)
  for (const key of keys)
    expect(e.feed(key), `${reading}: ${keys} at ${key}`).toBe(true)
  expect(e.done).toBe(true)
}
describe('branching roman input', () => {
  it.each([
    ['し', 'shi'],
    ['し', 'si'],
    ['ち', 'chi'],
    ['ち', 'ti'],
    ['つ', 'tsu'],
    ['つ', 'tu'],
    ['じ', 'ji'],
    ['じ', 'zi'],
    ['きゃ', 'kya'],
    ['きゃ', 'kixya'],
    ['きゃ', 'kilya'],
    ['しゃ', 'sha'],
    ['しゃ', 'sya'],
    ['しゃ', 'shixya'],
    ['ちゃ', 'cha'],
    ['ちゃ', 'tya'],
    ['ちゃ', 'cya'],
    ['ちぇ', 'che'],
    ['じぇ', 'je'],
    ['ふぁ', 'fa'],
    ['ふぁ', 'huxa'],
    ['てぃ', 'thi'],
    ['てぃ', 'teli'],
    ['うぃ', 'wi'],
    ['ヴァ', 'va'],
    ['っか', 'kka'],
    ['っち', 'cchi'],
    ['っち', 'tti'],
    ['っち', 'tchi'],
    ['っし', 'sshi'],
    ['っし', 'xtsushi'],
    ['っし', 'ltusi'],
    ['んか', 'nka'],
    ['んか', 'nnka'],
    ['んあ', 'nna'],
    ['んあ', "n'a"],
    ['んな', 'nna'],
    ['んな', 'nnna'],
    ['んや', 'nnya'],
    ['ん', 'nn'],
    ['ん', 'xn'],
    ['しんよう', 'shinnyou'],
    ['こんにちは', 'konnichiha'],
    ['こんにちは', 'konnnichiha'],
    ['「えー！」', '[e-!]'],
  ])('%s → %s', accepts)
  it('does not consume wrong keys or ambiguity prematurely', () => {
    const e = new RomanEngine('しんあ')
    expect(e.feed('x')).toBe(false)
    expect(e.position).toBe(0)
    for (const c of 'shin') expect(e.feed(c)).toBe(true)
    expect(e.feed('a')).toBe(false)
    for (const c of 'na') expect(e.feed(c)).toBe(true)
    expect(e.done).toBe(true)
  })
  it('all corpus readings are reachable and guides survive alternate spellings', () => {
    for (const p of passages)
      for (const part of p.paragraphs) {
        const e = new RomanEngine(part.reading)
        for (let steps = 0; !e.done && steps < 5000; steps++) {
          const hint = e.hint
          expect(hint.length).toBeGreaterThan(0)
          expect(e.feed(hint[0])).toBe(true)
        }
        expect(e.done).toBe(true)
      }
  })
})
describe('physical layouts and kana', () => {
  const key = (code: string, shiftKey = false, key = '') => ({
    code,
    shiftKey,
    key,
  })
  it('maps US physical punctuation independently of host', () => {
    expect(mapKey(key('Digit2', true), 'us')).toBe('@')
    expect(mapKey(key('Quote'), 'us')).toBe("'")
    expect(mapKey(key('BracketLeft'), 'us')).toBe('[')
  })
  it('maps every Dvorak letter in physical QWERTY order', () => {
    for (const [row, expected] of [
      ['QWERTYUIOP', "',.pyfgcrl"],
      ['ASDFGHJKL', 'aoeuidhtn'],
      ['ZXCVBNM', ';qjkxbm'],
    ])
      [...row].forEach((c, i) =>
        expect(mapKey(key(`Key${c}`), 'dvorak')).toBe(expected[i]),
      )
    expect(mapKey(key('Semicolon'), 'dvorak')).toBe('s')
    expect(mapKey(key('Quote'), 'dvorak')).toBe('-')
  })
  it('kana combines voicing and shifted small kana', () => {
    const e = new KanaEngine('がぱっ。ー')
    for (const code of ['KeyT', 'BracketLeft', 'KeyF', 'BracketRight'])
      expect(e.feed(mapKey(key(code), 'kana')!)).toBe(true)
    expect(e.feed(mapKey(key('KeyZ', true), 'kana')!)).toBe(true)
    expect(e.feed(mapKey(key('Period', true), 'kana')!)).toBe(true)
    expect(e.feed(mapKey(key('IntlYen'), 'kana')!)).toBe(true)
    expect(e.done).toBe(true)
  })
  it('all corpus kana readings accept direct keys', () => {
    for (const p of passages)
      for (const part of p.paragraphs) {
        const e = new KanaEngine(part.reading)
        for (const c of part.reading.normalize('NFD'))
          expect(e.feed(c)).toBe(true)
        expect(e.done).toBe(true)
      }
  })
})

describe('review regressions', () => {
  it('preserves JIS closing bracket instead of applying the US backslash override', () => {
    const event = { code: 'Backslash', key: ']', shiftKey: false }
    expect(mapKey(event, 'jis')).toBe(']')
    const e = new RomanEngine('」')
    expect(e.feed(mapKey(event, 'jis')!)).toBe(true)
    expect(e.done).toBe(true)
    expect(mapKey(event, 'us')).toBe('\\')
    expect(mapKey(event, 'dvorak')).toBe('\\')
  })
  it('uses the JIS physical bracket keys for kana corner brackets', () => {
    const e = new KanaEngine('「」')
    for (const code of ['BracketRight', 'Backslash'])
      expect(e.feed(mapKey({ code, key: '', shiftKey: true }, 'kana')!)).toBe(
        true,
      )
    expect(e.done).toBe(true)
    expect(
      mapKey({ code: 'BracketLeft', key: '', shiftKey: false }, 'kana'),
    ).toBe('\u3099')
    expect(
      mapKey({ code: 'BracketRight', key: '', shiftKey: false }, 'kana'),
    ).toBe('\u309a')
  })
  it.each([
    ['しぃ', 'shi'],
    ['ちぃ', 'chi'],
    ['じぃ', 'ji'],
    ['うぅ', 'whu'],
  ])('does not finish %s with %s', (reading, keys) => {
    const e = new RomanEngine(reading)
    for (const k of keys) expect(e.feed(k)).toBe(true)
    expect(e.done).toBe(false)
    expect(e.position).toBe(1)
    for (const k of e.hint) expect(e.feed(k)).toBe(true)
    expect(e.done).toBe(true)
  })
  it.each([
    ['しぃ', 'syi'],
    ['ちぃ', 'tyi'],
    ['ちぃ', 'cyi'],
    ['じぃ', 'jyi'],
    ['じぃ', 'zyi'],
    ['しぃ', 'shixi'],
    ['ちぃ', 'chili'],
    ['じぃ', 'jixi'],
    ['うぅ', 'whuxu'],
    ['ふぃ', 'fi'],
    ['ゔぃ', 'vi'],
    ['つぃ', 'tsi'],
  ])('%s still accepts %s', accepts)
  it('never advances past the end of the reading', () => {
    const e = new RomanEngine('し')
    for (const k of 'shi') e.feed(k)
    expect(e.position).toBe(e.target.length)
  })
})
