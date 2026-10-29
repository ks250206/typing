export type Layout = 'jis' | 'us' | 'dvorak' | 'kana'
const table: Record<string, string[]> = {}
const add = (kana: string, ...forms: string[]) => {
  table[kana] = forms
}
const rows = [
  ['あいうえお', 'a i u e o'],
  ['かきくけこ', 'ka ki ku ke ko'],
  ['さしすせそ', 'sa shi,s i su se so'],
  ['たちつてと', 'ta chi,ti tsu,tu te to'],
  ['なにぬねの', 'na ni nu ne no'],
  ['はひふへほ', 'ha hi fu,hu he ho'],
  ['まみむめも', 'ma mi mu me mo'],
  ['やゆよ', 'ya yu yo'],
  ['らりるれろ', 'ra ri ru re ro'],
  ['わを', 'wa wo'],
  ['がぎぐげご', 'ga gi gu ge go'],
  ['ざじずぜぞ', 'za ji,zi zu ze zo'],
  ['だぢづでど', 'da di du de do'],
  ['ばびぶべぼ', 'ba bi bu be bo'],
  ['ぱぴぷぺぽ', 'pa pi pu pe po'],
]
// Keep all alternatives on a single token.
rows[2][1] = 'sa shi,si su se so'
for (const [kana, forms] of rows)
  [...kana].forEach((k, i) => add(k, ...forms.split(' ')[i].split(',')))
for (const [small, full] of Object.entries({
  ぁ: 'a',
  ぃ: 'i',
  ぅ: 'u',
  ぇ: 'e',
  ぉ: 'o',
  ゃ: 'ya',
  ゅ: 'yu',
  ょ: 'yo',
  ゎ: 'wa',
  っ: 'tu',
  ゕ: 'ka',
  ゖ: 'ke',
}))
  add(
    small,
    `x${full}`,
    `l${full}`,
    ...(small === 'っ' ? ['xtsu', 'ltsu'] : []),
  )
add('か', 'ka', 'ca')
add('く', 'ku', 'cu', 'qu')
add('こ', 'ko', 'co')
add('し', 'shi', 'si', 'ci')
add('せ', 'se', 'ce')
add('い', 'i', 'yi')
add('う', 'u', 'wu', 'whu')
add('ゔゃ', 'vya')
add('ゔゅ', 'vyu')
add('ゔょ', 'vyo')
add('ゔ', 'vu')
add('いぇ', 'ye')
add('うぃ', 'wi', 'whi')
add('うぇ', 'we', 'whe')
add('うぉ', 'who')
add('うぁ', 'wha')
for (const [kana, bases] of Object.entries({
  き: ['ky'],
  ぎ: ['gy'],
  し: ['sh', 'sy'],
  じ: ['j', 'jy', 'zy'],
  ち: ['ch', 'ty', 'cy'],
  ぢ: ['dy'],
  に: ['ny'],
  ひ: ['hy'],
  び: ['by'],
  ぴ: ['py'],
  み: ['my'],
  り: ['ry'],
})) {
  for (const [small, v] of Object.entries({
    ゃ: 'a',
    ゅ: 'u',
    ょ: 'o',
    ぇ: 'e',
  }))
    add(kana + small, ...bases.map((b) => b + v))
}
for (const [kana, forms] of Object.entries({
  きぃ: ['kyi'],
  ぎぃ: ['gyi'],
  しぃ: ['syi'],
  じぃ: ['jyi', 'zyi'],
  ちぃ: ['tyi', 'cyi'],
  ぢぃ: ['dyi'],
  にぃ: ['nyi'],
  ひぃ: ['hyi'],
  びぃ: ['byi'],
  ぴぃ: ['pyi'],
  みぃ: ['myi'],
  りぃ: ['ryi'],
}))
  add(kana, ...forms)
for (const [kana, base] of Object.entries({ ふ: 'f', ゔ: 'v', つ: 'ts' }))
  for (const [k, v] of Object.entries({
    ぁ: 'a',
    ぃ: 'i',
    ぇ: 'e',
    ぉ: 'o',
    ゅ: 'yu',
  }))
    add(kana + k, base + v)
for (const [kana, forms] of Object.entries({
  てぃ: ['thi'],
  てゅ: ['thu'],
  てゃ: ['tha'],
  てょ: ['tho'],
  でぃ: ['dhi'],
  でゅ: ['dhu'],
  でゃ: ['dha'],
  でょ: ['dho'],
  とぅ: ['twu'],
  どぅ: ['dwu'],
  くぁ: ['qa', 'kwa'],
  くぃ: ['qi', 'qwi'],
  くぇ: ['qe', 'qwe'],
  くぉ: ['qo', 'qwo'],
  くゃ: ['qya'],
  くゅ: ['qyu'],
  くょ: ['qyo'],
  ぐぁ: ['gwa'],
  ぐぃ: ['gwi'],
  ぐぇ: ['gwe'],
  ぐぉ: ['gwo'],
}))
  add(kana, ...forms)
export const normalizeReading = (s: string) =>
  s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
type Edge = { end: number; text: string }
type State = { pos: number; rest: string; end: number }
export class RomanEngine {
  target: string
  states: State[] = [{ pos: 0, rest: '', end: 0 }]
  private shortest: string[] | undefined
  readonly natural: boolean
  constructor(reading: string, natural = false) {
    this.natural = natural
    this.target = normalizeReading(reading)
  }
  private naturalSuffixes() {
    if (!this.shortest) {
      const suffixes = Array<string>(this.target.length + 1).fill('')
      for (let pos = this.target.length - 1; pos >= 0; pos--) {
        const choices = this.edges(pos).map(
          (edge) => edge.text + suffixes[edge.end],
        )
        suffixes[pos] = choices.reduce((a, b) => (a.length <= b.length ? a : b))
      }
      this.shortest = suffixes
    }
    return this.shortest
  }
  get naturalRemaining() {
    const suffixes = this.naturalSuffixes()
    return Math.min(
      ...this.states.map(
        (state) =>
          state.rest.length +
          suffixes[state.rest ? state.end : state.pos].length,
      ),
    )
  }
  get naturalHint() {
    const suffixes = this.naturalSuffixes()
    return this.states
      .map((state) => state.rest + suffixes[state.rest ? state.end : state.pos])
      .reduce((a, b) => (a.length <= b.length ? a : b))
  }
  get naturalProgress() {
    return this.naturalSuffixes()[0].length - this.naturalRemaining
  }
  edges(pos: number): Edge[] {
    const c = this.target[pos]
    if (!c) return []
    const edges: Edge[] = []
    for (const size of [2, 1]) {
      if (pos + size > this.target.length) continue
      for (const text of table[this.target.slice(pos, pos + size)] ?? [])
        edges.push({ end: pos + size, text })
    }
    if (c === 'ん') {
      edges.push(
        { end: pos + 1, text: 'nn' },
        { end: pos + 1, text: "n'" },
        { end: pos + 1, text: 'xn' },
      )
      if (
        this.target[pos + 1] &&
        !'あいうえおやゆよんぁぃぅぇぉゃゅょ'.includes(this.target[pos + 1])
      )
        edges.unshift({ end: pos + 1, text: 'n' })
    }
    if (c === 'っ' && this.target[pos + 1] && this.target[pos + 1] !== 'っ') {
      const initials = new Set(
        this.edges(pos + 1)
          .map((e) => e.text[0])
          .filter((c) => /[bcdfghjklmpqrstvwxyz]/.test(c)),
      )
      for (const text of initials) edges.unshift({ end: pos + 1, text })
    }
    const punctuation: Record<string, string> = {
      '、': ',',
      '。': '.',
      ー: '-',
      '「': '[',
      '」': ']',
      '！': '!',
      '？': '?',
      '　': ' ',
      '＆': '&',
      '・': '/',
    }
    if (punctuation[c]) edges.push({ end: pos + 1, text: punctuation[c] })
    else if (/^[\x20-\x7e]$/.test(c))
      edges.push({ end: pos + 1, text: c.toLowerCase() })
    return edges
  }
  feed(key: string) {
    const next: State[] = []
    for (const s of this.states) {
      const options = s.rest
        ? [{ text: s.rest, end: s.end }]
        : this.edges(s.pos)
      for (const e of options)
        if (e.text[0] === key)
          next.push(
            e.text.length === 1
              ? { pos: e.end, rest: '', end: e.end }
              : { pos: s.pos, rest: e.text.slice(1), end: e.end },
          )
    }
    if (!next.length) return false
    this.states = [
      ...new Map(next.map((s) => [`${s.pos}/${s.rest}/${s.end}`, s])).values(),
    ]
    return true
  }
  get done() {
    return this.states.some((s) => s.pos === this.target.length && !s.rest)
  }
  get position() {
    return Math.max(...this.states.map((s) => s.pos))
  }
  get hint() {
    if (this.natural) return this.naturalHint
    const s = this.states.reduce((a, b) => (a.pos > b.pos ? a : b))
    let out = s.rest,
      pos = s.rest ? s.end : s.pos
    while (pos < this.target.length) {
      const e = this.edges(pos)[0]
      if (!e) break
      out += e.text
      pos = e.end
    }
    return out
  }
}
export class KanaEngine {
  target: string
  position = 0
  constructor(reading: string) {
    this.target = normalizeReading(reading)
      .replace(/[A-Z]/g, (c) => c.toLowerCase())
      .replace(/＆/g, '&')
      .replace(/？/g, '?')
      .normalize('NFD')
  }
  feed(key: string) {
    const k = key.normalize('NFD')
    if (this.target.slice(this.position, this.position + k.length) !== k)
      return false
    this.position += k.length
    return true
  }
  get done() {
    return this.position === this.target.length
  }
  get hint() {
    return this.target.slice(this.position).normalize('NFC')
  }
}
const codes = [
  'Backquote',
  ...Array.from({ length: 10 }, (_, i) => `Digit${(i + 1) % 10}`),
  'Minus',
  'Equal',
  'KeyQ',
  'KeyW',
  'KeyE',
  'KeyR',
  'KeyT',
  'KeyY',
  'KeyU',
  'KeyI',
  'KeyO',
  'KeyP',
  'BracketLeft',
  'BracketRight',
  'KeyA',
  'KeyS',
  'KeyD',
  'KeyF',
  'KeyG',
  'KeyH',
  'KeyJ',
  'KeyK',
  'KeyL',
  'Semicolon',
  'Quote',
  'KeyZ',
  'KeyX',
  'KeyC',
  'KeyV',
  'KeyB',
  'KeyN',
  'KeyM',
  'Comma',
  'Period',
  'Slash',
]
const us = "`1234567890-=qwertyuiop[]asdfghjkl;'zxcvbnm,./"
const usShift = '~!@#$%^&*()_+QWERTYUIOP{}ASDFGHJKL:"ZXCVBNM<>?'
const dv = "`1234567890[]',.pyfgcrl/=aoeuidhtns-;qjkxbmwvz"
const dvShift = '~!@#$%^&*(){}"<>PYFGCRL?+AOEUIDHTNS_:QJKXBMWVZ'
const kana: Record<string, string> = {
  Digit1: 'ぬ',
  Digit2: 'ふ',
  Digit3: 'あ',
  Digit4: 'う',
  Digit5: 'え',
  Digit6: 'お',
  Digit7: 'や',
  Digit8: 'ゆ',
  Digit9: 'よ',
  Digit0: 'わ',
  Minus: 'ほ',
  Equal: 'へ',
  KeyQ: 'た',
  KeyW: 'て',
  KeyE: 'い',
  KeyR: 'す',
  KeyT: 'か',
  KeyY: 'ん',
  KeyU: 'な',
  KeyI: 'に',
  KeyO: 'ら',
  KeyP: 'せ',
  BracketLeft: '\u3099',
  BracketRight: '\u309a',
  KeyA: 'ち',
  KeyS: 'と',
  KeyD: 'し',
  KeyF: 'は',
  KeyG: 'き',
  KeyH: 'く',
  KeyJ: 'ま',
  KeyK: 'の',
  KeyL: 'り',
  Semicolon: 'れ',
  Quote: 'け',
  Backslash: 'む',
  IntlYen: 'ー',
  IntlRo: 'ろ',
  KeyZ: 'つ',
  KeyX: 'さ',
  KeyC: 'そ',
  KeyV: 'ひ',
  KeyB: 'こ',
  KeyN: 'み',
  KeyM: 'も',
  Comma: 'ね',
  Period: 'る',
  Slash: 'め',
  Space: ' ',
}
const kanaShift: Record<string, string> = {
  Digit3: 'ぁ',
  KeyE: 'ぃ',
  Digit4: 'ぅ',
  Digit5: 'ぇ',
  Digit6: 'ぉ',
  Digit7: 'ゃ',
  Digit8: 'ゅ',
  Digit9: 'ょ',
  Digit0: 'を',
  KeyZ: 'っ',
  Comma: '、',
  Period: '。',
  Slash: '・',
  BracketRight: '「',
  Backslash: '」',
  IntlRo: 'ー',
}
export function mapKey(
  event: Pick<KeyboardEvent, 'code' | 'key' | 'shiftKey'>,
  layout: Layout,
  expected?: string,
): string | null {
  // Literal positions use JIS alphanumeric keys, including incorrect attempts.
  if (layout === 'kana' && expected && /^[ -~]$/.test(expected)) {
    if (event.key.length === 1 && /^[ -~]$/.test(event.key))
      return event.key.toLowerCase()
    if (/^Key[A-Z]$/.test(event.code)) return event.code.slice(3).toLowerCase()
    if (/^Numpad[0-9]$/.test(event.code)) return event.code.slice(6)
  }
  if (layout === 'kana')
    return (
      (event.shiftKey ? kanaShift[event.code] : undefined) ??
      kana[event.code] ??
      null
    )
  if (event.code === 'Space') return ' '
  if (layout === 'jis')
    return event.key.length === 1 ? event.key.toLowerCase() : null
  if (event.code === 'Backslash') return event.shiftKey ? '|' : '\\'
  const index = codes.indexOf(event.code)
  if (layout === 'dvorak')
    return index < 0
      ? null
      : ((event.shiftKey ? dvShift : dv)[index]?.toLowerCase() ?? null)
  if (layout === 'us')
    return index < 0
      ? null
      : ((event.shiftKey ? usShift : us)[index]?.toLowerCase() ?? null)
  return event.key.length === 1 ? event.key.toLowerCase() : null
}
