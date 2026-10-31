import { useEffect, useRef, useState } from 'react'
import { Keyboard, Star, Target, X } from 'lucide-react'
import { practicePassages } from '../../domain/content/practiceDocument'
import { battleSets } from '../../domain/content/battleSets'
import { favoriteKey, type Favorite } from '../../domain/records/favorites'
import { layoutLabels } from '../../domain/typing/engine'

export function FavoritesSidebar({
  items,
  onSelect,
  onRemove,
}: {
  items: Favorite[]
  onSelect: (favorite: Favorite) => void
  onRemove: (favorite: Favorite) => void
}) {
  const [open, setOpen] = useState(false)
  const host = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !host.current?.contains(event.target))
        setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  return (
    <section
      className={`sidebar-favorites ${open ? 'is-open' : ''}`}
      aria-label="お気に入り"
      role="group"
      data-game-shortcuts="off"
      ref={host}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.preventDefault()
          event.stopPropagation()
          setOpen(false)
          host.current
            ?.querySelector<HTMLButtonElement>('.favorites-mobile-toggle')
            ?.focus()
        }
      }}
    >
      <button
        className="favorites-mobile-toggle"
        aria-label="お気に入りを表示"
        aria-expanded={open}
        aria-controls="sidebar-favorites-list"
        onClick={() => setOpen((value) => !value)}
      >
        <Star size={18} />
      </button>
      <div className="favorites-panel" id="sidebar-favorites-list">
        <h2 className="nav-label">FAVORITES</h2>
        {items.length === 0 ? (
          <p>文書や対戦設定の☆から登録できます。</p>
        ) : (
          <ul>
            {items.map((favorite) => {
              const title =
                (favorite.kind === 'cpu' ? battleSets : practicePassages).find(
                  (p) => p.id === favorite.passageId,
                )?.title ?? favorite.passageId
              const description = `${favorite.kind === 'cpu' ? 'CPU対戦' : 'タイピング'} · ${title} · ${layoutLabels[favorite.layout]}`
              const detail =
                favorite.kind === 'cpu'
                  ? `${favorite.cpuConfig.kpm} KPM · ${favorite.cpuConfig.reactionMs} ms · ${favorite.cpuConfig.curve === 'constant' ? '一定速度' : 'イーズイン'}`
                  : ''
              const label = `${description}${detail ? ` · ${detail}` : ''}`
              return (
                <li key={favoriteKey(favorite)}>
                  <button
                    className="favorite-open"
                    aria-label={`お気に入りを開く：${label}`}
                    onClick={() => {
                      onSelect(favorite)
                      setOpen(false)
                    }}
                  >
                    {favorite.kind === 'cpu' ? (
                      <Target size={14} />
                    ) : (
                      <Keyboard size={14} />
                    )}
                    <span>
                      <strong>{title}</strong>
                      {favorite.kind === 'cpu' && <small>{detail}</small>}
                    </span>
                  </button>
                  <button
                    className="favorite-remove"
                    aria-label={`お気に入りから削除：${label}`}
                    onClick={() => {
                      onRemove(favorite)
                      host.current
                        ?.querySelector<HTMLButtonElement>(
                          '.favorites-mobile-toggle',
                        )
                        ?.focus()
                    }}
                  >
                    <X size={13} />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
