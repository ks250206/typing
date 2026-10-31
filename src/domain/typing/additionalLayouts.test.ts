import { expect, it } from 'vitest'
import { isTypingShortcut, mapKey } from './engine'
import { physicalKey, keyOutput } from './physicalKeyboard'

it.each([
  ['onishi', ['qlu,.fwryp', 'eiao-ktnsh', 'zxcv;gdmjb']],
  ['norman', ['qwdfkjurl;', 'asetgynioh', 'zxcvbpm,./']],
  ['azerty', ['azertyuiop', 'qsdfghjklm', 'wxcvbn,;:!']],
] as const)(
  '%s follows the independently checked official rows',
  (layout, rows) => {
    for (const [index, positions] of [
      'QWERTYUIOP',
      'ASDFGHJKL;',
      'ZXCVBNM,./',
    ].entries()) {
      for (const [i, char] of [...positions].entries()) {
        const code =
          (
            {
              ';': 'Semicolon',
              ',': 'Comma',
              '.': 'Period',
              '/': 'Slash',
            } as Record<string, string>
          )[char] ?? `Key${char}`
        expect(
          mapKey({ code, key: 'wrong host', shiftKey: false }, layout),
        ).toBe(rows[index][i])
      }
    }
  },
)
it('covers all case-insensitive ASCII with Shift and French AltGr, including physical inversion', () => {
  for (const layout of ['onishi', 'azerty', 'norman'] as const) {
    for (let n = 32; n < 127; n++) {
      const char = String.fromCharCode(n)
      if (/[A-Z]/.test(char)) continue
      const key = physicalKey(char, layout)
      expect(key, `${layout}/${char}`).toBeDefined()
      expect(
        keyOutput(key!.code, key!.shift, layout, undefined, key!.altGraph),
      ).toBe(char)
    }
  }
  expect(physicalKey('/', 'onishi')).toEqual({ code: 'Minus', shift: false })
  expect(physicalKey('@', 'azerty')).toEqual({
    code: 'Digit0',
    shift: false,
    altGraph: true,
  })
  expect(physicalKey('1', 'azerty')).toEqual({ code: 'Digit1', shift: true })
  expect(physicalKey('>', 'azerty')).toEqual({
    code: 'IntlBackslash',
    shift: true,
  })
})
it('permits AltGr only in AZERTY, preserving Ctrl/Alt/Meta shortcuts', () => {
  const event = {
    ctrlKey: true,
    altKey: true,
    metaKey: false,
    getModifierState: (key: string) => key === 'AltGraph',
  }
  expect(isTypingShortcut(event, 'azerty')).toBe(false)
  expect(isTypingShortcut(event, 'norman')).toBe(true)
  expect(isTypingShortcut({ ...event, metaKey: true }, 'azerty')).toBe(true)
  expect(
    isTypingShortcut({ ...event, getModifierState: () => false }, 'azerty'),
  ).toBe(false)
  expect(
    isTypingShortcut(
      { ...event, ctrlKey: false, getModifierState: () => false },
      'azerty',
    ),
  ).toBe(true)
})
