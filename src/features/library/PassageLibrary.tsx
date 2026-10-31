import { libraryCategory } from './libraryCategories'
import { useMemo, useState } from 'react'
import { BookOpen } from 'lucide-react'
import type { Passage } from '../../domain/content/passages'
import { isTypewell } from '../../domain/content/typewell'
import { isRtc } from '../../domain/content/rtcWords'
import { isRtcOriginal } from '../../domain/content/rtcOriginal'
import { isEtyping } from '../../domain/content/etyping'
import { isTrainer } from '../../domain/content/sakusaku'
import { isConstitutionArticles } from '../../domain/content/constitutionArticles'
import { FavoriteButton } from '../favorites/FavoriteButton'

export function PassageLibrary({
  passages,
  selected,
  onSelect,
  isFavorite,
  onToggleFavorite,
}: {
  passages: Passage[]
  selected: string
  onSelect: (id: string) => void
  isFavorite: (id: string) => boolean
  onToggleFavorite: (id: string) => void
}) {
  const categories = useMemo(() => {
    const priority = (category: string) =>
      category === 'オリジナル' ? 0 : category === 'オリジナル長文' ? 1 : 2
    return [...new Set(passages.map(libraryCategory))].sort(
      (a, b) => priority(a) - priority(b),
    )
  }, [passages])
  const [genre, setGenre] = useState('すべて')
  const [search, setSearch] = useState('')
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
      <div className="selection-library-heading">
        <h3>文章ライブラリ</h3>
        <span>
          {filtered.length} / {passages.length} セット
        </span>
      </div>
      <p className="library-favorite-hint">
        各文書の☆からお気に入りに登録できます。
      </p>
      <label className="library-search">
        文章を検索
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="タイトル・ジャンルで検索"
        />
      </label>
      <div className="filters" aria-label="文章のジャンル">
        {['すべて', ...categories].map((g) => (
          <button
            key={g}
            className={genre === g ? 'selected' : ''}
            aria-pressed={genre === g}
            onClick={() => setGenre(g)}
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
              <p>{p.subtitle}</p>
              <div>
                <span>
                  {p.continuous
                    ? `全文1問 · ${p.paragraphs[0].text.length}文字 · 途中の切り替えなし`
                    : isTypewell(p.id)
                      ? 'R 400打 / K 280打 · シード再現'
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
