/// <reference types="node" />
import { expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import data from '../../data/generated/rtc.json' with { type: 'json' }
import { rtcDocument, rtcPassages, rtcPrompts } from './rtcWords'
import { KanaEngine, RomanEngine } from '../typing/engine'
import { physicalKey, keyOutput } from '../typing/physicalKeyboard'
import type { Layout } from '../typing/engine'
it('retains all 20 registered two-part word sets and their source provenance without requiring ZIP originals', () => {
  expect(data).toHaveLength(20)
  expect(
    data.reduce((n, s) => n + s.parts.reduce((n, p) => n + p.length, 0), 0),
  ).toBe(5994)
  for (const set of data) {
    expect(set.parts).toHaveLength(2)
    expect(set.source.zipSha256).toMatch(/^[a-f0-9]{64}$/u)
    expect(set.source.xmlSha256).toMatch(/^[a-f0-9]{64}$/u)
  }
})
for (const set of data) {
  const path = resolve(
    process.env.GALACTYPE_RTC_SOURCES ??
      fileURLToPath(new URL('../../../data/sources/rtc', import.meta.url)),
    set.source.archive,
  )
  it.skipIf(!existsSync(path))(
    `${set.id}: matches the optional local RTC original`,
    () => {
      expect(
        createHash('sha256').update(readFileSync(path)).digest('hex'),
      ).toBe(set.source.zipSha256)
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
    },
  )
}
it('generates 15 seeded combinations and extends the same sequence to all 133 RTC prompts', () => {
  for (const set of rtcPassages.filter((p) =>
    data.some((s) => s.id === p.id),
  )) {
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
it('keeps every fragment aligned and typable in all supported layouts, including literal ASCII in kana', () => {
  const layouts = [
    'jis',
    'us',
    'dvorak',
    'colemak',
    'workman',
    'onishi',
    'azerty',
    'norman',
    'nova-f5-pair',
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
      expect(
        keyOutput(key!.code, key!.shift, layout, char, key!.altGraph),
      ).toBe(char)
    }
})
