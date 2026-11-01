import { libraryCategory } from './libraryCategories'
import { useMemo, useState } from 'react'
import { BookOpen, Search } from 'lucide-react'
import type { Passage } from '../../domain/content/passages'
import { isTypewell } from '../../domain/content/typewell'
import { isRtc } from '../../domain/content/rtcWords'
import { isRtcOriginal } from '../../domain/content/rtcOriginal'
import { isEtyping } from '../../domain/content/etyping'
import { isTrainer } from '../../domain/content/sakusaku'
import { isConstitutionArticles } from '../../domain/content/constitutionArticles'
import {
  isEnglishTypewell,
  isSeededEnglish,
} from '../../domain/content/english'
import { LanguageSwitch } from './LanguageSwitch'
import { FavoriteButton } from '../favorites/FavoriteButton'

export function PassageLibrary({
  passages,
  selected,
  onSelect,
  isFavorite,
  onToggleFavorite,
  mode = 'document',
  language,
  onLanguageChange,
}: {
  passages: Passage[]
  selected: string
  onSelect: (id: string) => void
  isFavorite: (id: string) => boolean
  onToggleFavorite: (id: string) => void
  mode?: 'document' | 'sentence'
  language: 'ja' | 'en'
  onLanguageChange: (language: 'ja' | 'en') => void
}) {
  const categories = useMemo(() => {
    const priority = (category: string) =>
      category === 'オリジナル' ? 0 : category === 'オリジナル長文' ? 1 : 2
    return [...new Set(passages.map(libraryCategory))].sort(
      (a, b) => priority(a) - priority(b),
    )
  }, [passages])
  const [filter, setFilter] = useState({
    language,
    genre: 'すべて',
    search: '',
  })
  if (filter.language !== language)
    setFilter({ language, genre: 'すべて', search: '' })
  const { genre, search } = filter
  const filtered = useMemo(
    () =>
      passages.filter(
        (p) =>
          (genre === 'すべて' || libraryCategory(p) === genre) &&
          `${p.title} ${p.subtitle} ${p.genre} ${libraryCategory(p)}`
            .toLocaleLowerCase('ja')
            .includes(search.trim().toLocaleLowerCase('ja')),
      ),
    [passages, genre, search],
  )
  return (
    <section className="selection-library" aria-label="文章ライブラリ">
      <header className="library-header">
        <div className="selection-library-heading">
          <div className="library-title">
            <span className="library-mark" aria-hidden="true">
              <BookOpen size={24} />
            </span>
            <h3>文章ライブラリ</h3>
          </div>
          <span className="library-count">
            {filtered.length} / {passages.length} セット
          </span>
        </div>
        <div className="library-toolbar">
          <LanguageSwitch value={language} onChange={onLanguageChange} />
          <label className="library-search">
            <span className="library-search-label">文章を検索</span>
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) =>
                setFilter({ language, genre, search: e.target.value })
              }
              placeholder="タイトル・ジャンルで検索"
            />
          </label>
        </div>
      </header>
      <p className="library-favorite-hint">
        各文書の☆からお気に入りに登録できます。
      </p>
      <div className="filters" aria-label="文章のジャンル">
        {['すべて', ...categories].map((g) => (
          <button
            key={g}
            className={genre === g ? 'selected' : ''}
            aria-pressed={genre === g}
            onClick={() => setFilter({ language, genre: g, search })}
          >
            {g}
          </button>
        ))}
      </div>
      <div className="library-grid">
        {filtered.map((p) => (
          <div className="story-card-wrap" key={p.id}>
            <button
              className="story-card"
              aria-label={p.title}
              aria-pressed={selected === p.id}
              onClick={() => onSelect(p.id)}
            >
              <div className="story-art">
                <span>{p.accent}</span>
                <BookOpen size={28} />
                <span className="tag">
                  {p.genre === 'RTC準拠' ? 'RTC' : p.genre}
                </span>
              </div>
              <h3>{p.title}</h3>
              <p>
                {mode === 'sentence'
                  ? p.continuous
                    ? '長文を一文ずつに分けて練習します。'
                    : isTypewell(p.id) || isEnglishTypewell(p.id)
                      ? '辞書の各単語を選び、繰り返し練習します。'
                      : '文章セットから1文を選び、目標KPMを連続達成します。'
                  : p.subtitle}
              </p>
              <div>
                <span>
                  {mode === 'sentence'
                    ? '1文・1語ずつ · 連続練習'
                    : p.continuous
                      ? `全文1問 · ${p.paragraphs[0].text.length}文字 · 途中の切り替えなし`
                      : isTypewell(p.id)
                        ? 'R 400打 / K 280打 · シード再現'
                        : isEnglishTypewell(p.id)
                          ? '400打 · シード再現'
                          : isSeededEnglish(p.id)
                            ? '15問 · シードでシャッフル'
                            : isConstitutionArticles(p.id)
                              ? '全14条 · 条単位のシャッフル · シード再現'
                              : isRtcOriginal(p.id)
                                ? '15問 · 短文をシャッフル'
                                : isRtc(p.id)
                                  ? '15問 · パートをランダム連結'
                                  : isTrainer(p.id)
                                    ? `${p.paragraphs.length}文 · 60秒 · シード再現`
                                    : isEtyping(p.id)
                                      ? '15問 · シードでシャッフル'
                                      : `${p.paragraphs.reduce((n, row) => n + row.text.length, 0)} 文字`}
                </span>
              </div>
            </button>
            <FavoriteButton
              passageTitle={p.title}
              active={isFavorite(p.id)}
              onClick={() => onToggleFavorite(p.id)}
            />
          </div>
        ))}
      </div>
      {!filtered.length && (
        <p role="status">
          一致する文章がありません。検索やジャンルを変更してください。
        </p>
      )}
    </section>
  )
}
