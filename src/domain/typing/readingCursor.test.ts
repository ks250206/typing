import { expect, it } from 'vitest'
import { readingCursor } from './readingCursor'

it('keeps voiced and semi-voiced kana intact across separate physical keystrokes', () => {
  const target = 'がぱ。'.normalize('NFD')
  expect(readingCursor(target, 0)).toEqual({
    before: '',
    current: 'が',
    after: 'ぱ。',
  })
  expect(readingCursor(target, 1)).toEqual({
    before: '',
    current: 'が',
    after: 'ぱ。',
  })
  expect(readingCursor(target, 2)).toEqual({
    before: 'が',
    current: 'ぱ',
    after: '。',
  })
  expect(readingCursor(target, 3)).toEqual({
    before: 'が',
    current: 'ぱ',
    after: '。',
  })
  expect(readingCursor(target, 5)).toEqual({
    before: 'がぱ。',
    current: '',
    after: '',
  })
})
it('uses composed offsets for roman input and resets at the sentence start', () => {
  expect(readingCursor('がぱ。', 1)).toEqual({
    before: 'が',
    current: 'ぱ',
    after: '。',
  })
  expect(readingCursor('つぎ。', 0)).toEqual({
    before: '',
    current: 'つ',
    after: 'ぎ。',
  })
})
