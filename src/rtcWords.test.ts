/// <reference types="node" />
import { expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import data from './data/generated/rtc.json' with { type: 'json' }
import { rtcDocument, rtcPassages, rtcPrompts } from './rtcWords'
import { KanaEngine, RomanEngine } from './engine'
import { physicalKey, keyOutput } from './physicalKeyboard'
import type { Layout } from './engine'
it('preserves all 20 supplied two-part word files, raw readings, order and provenance', () => {
  expect(data).toHaveLength(20)
  expect(
    data.reduce((n, s) => n + s.parts.reduce((n, p) => n + p.length, 0), 0),
  ).toBe(5994)
  for (const set of data) {
    const path = new URL(
      `../data/sources/rtc/${set.source.archive}`,
      import.meta.url,
    ).pathname
    expect(createHash('sha256').update(readFileSync(path)).digest('hex')).toBe(
      set.source.zipSha256,
    )
    const source = JSON.parse(
      execFileSync(
        'python3',
        [
          '-c',
          `import sys,json,zipfile,xml.etree.ElementTree as E,hashlib
with zipfile.ZipFile(sys.argv[1]) as z:
 raw=z.read(sys.argv[2]);r=E.fromstring(raw)
 print(json.dumps({'hash':hashlib.sha256(raw).hexdigest(),'parts':[[[w.findtext('Display'),w.findtext('Characters')] for w in p.findall('Word')] for p in r.findall('Part')]}))`,
          path,
          set.source.member,
        ],
        { encoding: 'utf8' },
      ),
    )
    expect(source.hash).toBe(set.source.xmlSha256)
    expect(source.parts).toEqual(
      set.parts.map((p) => p.map((r) => [r[0], r[1]])),
    )
    expect(set.parts).toHaveLength(2)
  }
})
it('generates 15 seeded combinations and extends the same sequence to all 133 RTC prompts', () => {
  for (const set of rtcPassages) {
    const a = rtcDocument(set.id, 'seed')
    expect(a.sentences).toHaveLength(15)
    expect(a).toEqual(rtcDocument(set.id, 'seed'))
    expect(a.sentences).not.toEqual(rtcDocument(set.id, 'other').sentences)
    expect(rtcPrompts(set.id, 'seed', 133).slice(0, 15)).toEqual(a.sentences)
    const source = data.find((s) => s.id === set.id)!
    for (const s of a.sentences)
      expect(
        source.parts[0].some((a) =>
          source.parts[1].some((b) => String(a[0]) + String(b[0]) === s.text),
        ),
      ).toBe(true)
  }
})
it('keeps every fragment aligned and typable in all six layouts, including literal ASCII in kana', () => {
  const layouts = [
    'jis',
    'us',
    'dvorak',
    'colemak',
    'workman',
    'kana',
  ] as Layout[]
  const characters = new Map(layouts.map((l) => [l, new Set<string>()]))
  for (const set of data)
    for (const part of set.parts)
      for (const row of part) {
        const segments = row[2] as string[][]
        const text = segments.map((s) => s[0]).join(''),
          reading = segments.map((s) => s[1]).join('')
        expect(text).toBe(row[0])
        for (const layout of layouts) {
          const engine =
            layout === 'kana'
              ? new KanaEngine(reading)
              : new RomanEngine(reading)
          const keys = layout === 'kana' ? engine.target : engine.hint
          for (const char of keys) {
            characters.get(layout)!.add(char)
            if (!engine.feed(char))
              throw Error(`${set.id}: ${text} / ${layout} / ${char}`)
          }
          expect(engine.done).toBe(true)
        }
      }
  for (const [layout, chars] of characters)
    for (const char of chars) {
      const key = physicalKey(char, layout)
      expect(key, `${layout}: ${char}`).toBeDefined()
      expect(keyOutput(key!.code, key!.shift, layout, char)).toBe(char)
    }
})
