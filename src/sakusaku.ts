import type { Passage } from './passages'
import { seededRandom } from './typewell'
import { normalizeReading } from './engine'

/** Text and readings provided by the user, in their original order and spelling. */
export const sakusakuEntries = [
  [
    'だんだん会長の役職が板についてきたような気がするよ',
    'だんだんかいちょうのやくしょくがいたについてきたようなきがするよ',
    'かいちょう/やくしょく/いた/き',
  ],
  [
    'よく使用する単語は単語帳に記録したほうがいいよ',
    'よくしようするたんごはたんごちょうにきろくしたほうがいいよ',
    'しよう/たんご/たんごちょう/きろく',
  ],
  [
    '今日の歴史的敗戦でとうとう上位からも戦線離脱だよ',
    'きょうのれきしてきはいせんでとうとうじょういからもせんせんりだつだよ',
    'きょう/れきしてきはいせん/じょうい/せんせんりだつ',
  ],
  [
    '今より先に進めるかどうか総合的に判断してください',
    'いまよりさきにすすめるかどうかそうごうてきにはんだんしてください',
    'いま/さき/すす/そうごうてき/はんだん',
  ],
  [
    '毎日ガンガン打てるさくさくタイピングに熱い興味を注ぐ',
    'まいにちがんがんうてるさくさくたいぴんぐにあついきょうみをそそぐ',
    'まいにち/う/あつ/きょうみ/そそ',
  ],
  [
    '今から逆転する最良の近道はその階段を左です',
    'いまからぎゃくてんするさいりょうのちかみちはそのかいだんをひだりです',
    'いま/ぎゃくてん/さいりょう/ちかみち/かいだん/ひだり',
  ],
  [
    '学生時代の懐かしい友達と同窓会をするのはわくわくする',
    'がくせいじだいのなつかしいともだちとどうそうかいをするのはわくわくする',
    'がくせいじだい/なつ/ともだち/どうそうかい',
  ],
  [
    '八回裏のシングルヒット三連打で逆転勝利',
    'はちかいうらのしんぐるひっとさんれんだでぎゃくてんしょうり',
    'はちかいうら/さんれんだ/ぎゃくてんしょうり',
  ],
  [
    '隣の町の水晶のほうが綺麗に見えるのはどうしてだろうか',
    'となりのまちのすいしょうのほうがきれいにみえるのはどうしてだろうか',
    'となり/まち/すいしょう/きれい/み',
  ],
  [
    '期末テストで満点を取るために毎日毎日勉強を続ける',
    'きまつてすとでまんてんをとるためにまいにちまいにちべんきょうをつづける',
    'きまつ/まんてん/と/まいにちまいにちべんきょう/つづ',
  ],
  [
    '今日は音楽と科学のテストが完了して心身共に意気消沈です',
    'きょうはおんがくとかがくのてすとがかんりょうしてしんしんともにいきしょうちんです',
    'きょう/おんがく/かがく/かんりょう/しんしんとも/いきしょうちん',
  ],
  [
    'やっと半額となったスナック菓子をたくさん買う予定です',
    'やっとはんがくとなったすなっくがしをたくさんかうよていです',
    'はんがく/がし/か/よてい',
  ],
  [
    '三月には来年度の予算を作って大阪の本社に提出すること',
    'さんがつにはらいねんどのよさんをつくっておおさかのほんしゃにていしゅつすること',
    'さんがつ/らいねんど/よさん/つく/おおさか/ほんしゃ/ていしゅつ',
  ],
  [
    '彼の堂々とした作戦が事件解決に影響するかどうか見学する',
    'かれのどうどうとしたさくせんがじけんかいけつにえいきょうするかどうかけんがくする',
    'かれ/どうどう/さくせん/じけんかいけつ/えいきょう/けんがく',
  ],
  [
    '労働者の団体交渉の権利が無くなるのはガクガクブルブルする',
    'ろうどうしゃのだんたいこうしょうのけんりがなくなるのはがくがくぶるぶるする',
    'ろうどうしゃ/だんたいこうしょう/けんり/な',
  ],
] as const
export function randomSentenceIndex(
  length: number,
  previous = -1,
  random = Math.random,
) {
  if (length < 2) return 0
  if (previous < 0) return Math.floor(random() * length)
  const index = Math.floor(random() * (length - 1))
  return index >= previous ? index + 1 : index
}
/** Version 1: deterministic draws with replacement, excluding the last prompt. */
export function createTrainerOrder(
  seed: string,
  length: number = sakusakuEntries.length,
) {
  const random = seededRandom(`sakusaku-v1/${seed}`)
  let previous = -1
  return () => (previous = randomSentenceIndex(length, previous, random))
}
export const isTrainer = (id: string) => id === 'sakusaku-trainer'
export const sakusaku: Passage = {
  id: 'sakusaku-trainer',
  title: '打鍵トレーナー · さくさくタイピング',
  genre: '60秒トレーナー',
  accent: '60',
  subtitle:
    '15文をシードでランダム出題。最初の打鍵から60秒間の正打鍵数を計測。',
  durationMs: 60000,
  source: {
    label: 'ユーザー提供の本文・読み（15文）',
    url: 'https://ankey.io/wordbooks/cuet1ri9io6g02p7bm0g',
    kind: 'provided',
  },
  paragraphs: sakusakuEntries.map(([text, reading, groups]) => {
    const kanji = groups.split('/')
    let index = 0
    const segments = (text.match(/[一-龯々]+|./gu) ?? []).map((part) => ({
      text: part,
      reading: /^[一-龯々]/u.test(part)
        ? kanji[index++]
        : normalizeReading(part),
    }))
    if (
      index !== kanji.length ||
      segments.map((s) => s.reading).join('') !== reading
    )
      throw new Error(`Sakusaku alignment mismatch: ${text}`)
    return { text, reading, segments }
  }),
}
