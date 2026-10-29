import source from './data/constitutionArticlesSource.json' with { type: 'json' }
import type { Passage } from './passages'
import { normalizeReading } from './engine'
import { seededRandom } from './typewell'

/** Modern input readings; the displayed legal text retains the official spelling. */
const readings: Record<string, string> = Object.fromEntries(
  `
一代|いちだい 一体|いったい 三分|さんぶん 上|うえ 下|もと 二以上|にいじょう
交戦権|こうせんけん 享有|きょうゆう 人種|じんしゅ 他|た 他一切|たいっさい 休息|きゅうそく
何人|なんぴと 侵|おか 保持|ほじ 保護|ほご 保障|ほしょう 信教|しんきょう 信条|しんじょう
個人|こじん 健康|けんこう 儀式又|ぎしきまた 児童|じどう 公共|こうきょう 公布|こうふ
公衆衛生|こうしゅうえいせい 出版|しゅっぱん 制度|せいど 前項|ぜんこう 努|つと 効力|こうりょく
勤労|きんろう 勤労条件|きんろうじょうけん 勤労者|きんろうしゃ 勲章|くんしょう 参加|さんか
又|また 反|はん 受|う 各議院|かくぎいん 名|な 向上及|こうじょうおよ 唯一|ゆいいつ
営|いとな 団体交渉|だんたいこうしょう 団体行動|だんたいこうどう 団結|だんけつ 国|くに
国会|こっかい 国及|くにおよ 国政|こくせい 国権|こっけん 国民|こくみん
国民投票又|こくみんとうひょうまた 国際平和|こくさいへいわ 国際紛争|こくさいふんそう
基本的人権|きほんてきじんけん 基準|きじゅん 基調|きちょう 増進|ぞうしん 天皇|てんのう
妨|さまた 威嚇又|いかくまた 子女|しじょ 宗教上|しゅうきょうじょう 宗教団体|しゅうきょうだんたい
宗教教育|しゅうきょうきょういく 宗教的活動|しゅうきょうてきかつどう 定|さだ 対|たい
将来|しょうらい 尊重|そんちょう 就業時間|しゅうぎょうじかん 差別|さべつ 希求|ききゅう
平等|びょうどう 幸福追求|こうふくついきゅう 強制|きょうせい 必要|ひつよう 応|おう
思想及|しそうおよ 性別|せいべつ 憲法|けんぽう 憲法改正|けんぽうかいせい 成|な
戦争|せんそう 戦力|せんりょく 手段|しゅだん 承認|しょうにん 投票|とうひょう 授与|じゅよ
提案|ていあん 改正|かいせい 放棄|ほうき 政治上|せいじじょう 政治的|せいじてき
教育|きょういく 文化的|ぶんかてき 日本国民|にほんこくみん 普通教育|ふつうきょういく
最低限度|さいていげんど 最大|さいだい 最高機関|さいこうきかん 有|ゆう 栄典|えいてん
栄誉|えいよ 検閲|けんえつ 権利|けんり 権利及|けんりおよ 権力|けんりょく 機関|きかん
正義|せいぎ 武力|ぶりょく 永久|えいきゅう 法|ほう 法律|ほうりつ 無償|むしょう
特別|とくべつ 特権|とっけん 現|げん 現在及|げんざいおよ 生命|せいめい 生活|せいかつ
生活部面|せいかつぶめん 発動|はつどう 発議|はつぎ 目的|もくてき 直|ただ
社会保障及|しゃかいほしょうおよ 社会的身分又|しゃかいてきみぶんまた 社会的関係|しゃかいてきかんけい
社会福祉|しゃかいふくし 祝典|しゅくてん 福祉|ふくし 秘密|ひみつ 秩序|ちつじょ
立法|りっぽう 立法機関|りっぽうきかん 納税|のうぜい 経|へ 経済的又|けいざいてきまた
結社及|けっしゃおよ 総議員|そうぎいん 義務|ぎむ 義務教育|ぎむきょういく 者|もの
能力|のうりょく 自由|じゆう 自由及|じゆうおよ 良心|りょうしん 華族|かぞく
行事|ぎょうじ 行使|こうし 行為|こうい 表現|ひょうげん 解決|かいけつ 言論|げんろん
認|みと 誠実|せいじつ 貴族|きぞく 賃金|ちんぎん 賛成|さんせい 通信|つうしん
過半数|かはんすう 達|たっ 選挙|せんきょ 酷使|こくし 門地|もんち 関|かん
限|かぎ 陸海空軍|りくかいくうぐん 際|さい 集会|しゅうかい
`
    .trim()
    .split(/\s+/u)
    .map((pair) => pair.split('|')),
)
const historical: Record<string, string> = {
  与へ: 'あたえ',
  伴は: 'ともなわ',
  行は: 'おこなわ',
  負ふ: 'おう',
  あつ: 'あっ',
}
const topics: Record<number, [string, string]> = {
  9: ['戦争の放棄', '戦争放棄・戦力不保持'],
  11: ['基本的人権の享有', '侵すことのできない永久の権利'],
  13: ['個人の尊重', '幸福追求権'],
  14: ['法の下の平等', '差別の禁止'],
  19: ['思想・良心の自由', '内心の自由'],
  20: ['信教の自由', '政教分離'],
  21: ['表現の自由', '言論・出版・集会・結社'],
  25: ['生存権', '健康で文化的な最低限度の生活'],
  26: ['教育を受ける権利', '義務教育'],
  27: ['勤労の権利・義務', '労働'],
  28: ['労働基本権', '団結権・団体交渉権・団体行動権'],
  30: ['納税の義務', '納税'],
  41: ['国会の地位', '国権の最高機関・唯一の立法機関'],
  96: ['憲法改正', '各議院の総議員の3分の2以上で発議'],
}
function paragraph(text: string) {
  const annotated = text.replace(
    /与へ|伴は|行は|負ふ|あつ/gu,
    (part) => `〈${part}|${historical[part]}〉`,
  )
  const segments = []
  for (const match of annotated.matchAll(
    /〈([^|]+)\|([^〉]+)〉|([一-龯々]+|.)/gu,
  )) {
    const part = match[1] ?? match[3]
    const reading =
      match[2] ??
      (/^[一-龯々]+$/u.test(part) ? readings[part] : normalizeReading(part))
    if (!reading) throw Error(`Missing article reading: ${part}`)
    segments.push({ text: part, reading })
  }
  return { text, reading: segments.map((s) => s.reading).join(''), segments }
}
export const constitutionArticles = source.articles.map((article) => {
  const [title, keywords] = topics[article.number]
  const parts = article.paragraphs.map(paragraph)
  return {
    number: article.number,
    title,
    keywords,
    text: parts.map((p) => p.text).join(''),
    reading: parts.map((p) => p.reading).join(''),
    segments: parts.flatMap((p) => p.segments),
    label: `第${article.number}条 · ${title}`,
    note: `覚えるキーワード：${keywords}`,
  }
})
export const constitutionArticlePassage: Passage = {
  id: 'constitution-articles',
  title: '日本国憲法 条文集',
  genre: '公的文書',
  accent: '法',
  subtitle:
    '指定14条の全項を、条単位のランダム順で最後まで。シード再現に対応。',
  splitSentences: false,
  source: { label: '衆議院：日本国憲法', url: source.source, kind: 'public' },
  paragraphs: constitutionArticles,
}
export const isConstitutionArticles = (id: string) =>
  id === constitutionArticlePassage.id
/** Shuffle complete articles without replacement; all paragraphs stay inside their article. */
export function constitutionArticleDocument(seed: string) {
  const articles = [...constitutionArticles]
  const random = seededRandom(`constitution-articles-v1/${seed}`)
  for (let i = articles.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[articles[i], articles[j]] = [articles[j], articles[i]]
  }
  return {
    passage: { ...constitutionArticlePassage, paragraphs: articles },
    sentences: articles,
    plan: null,
  }
}
