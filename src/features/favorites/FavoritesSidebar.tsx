import { useEffect, useState } from 'react'
import { GripVertical, Keyboard, Star, Target, X } from 'lucide-react'
import { practicePassages } from '../../domain/content/practiceDocument'
import { battleSets } from '../../domain/content/battleSets'
import { favoriteKey, type Favorite } from '../../domain/records/favorites'
import { layoutLabels } from '../../domain/typing/engine'
import { useFavoriteOrder } from './useFavoriteOrder'

export function FavoritesSidebar({
  items,
  activeKey,
  onSelect,
  onRemove,
  onReorder,
}: {
  items: Favorite[]
  activeKey: string | null
  onSelect: (favorite: Favorite) => void
  onRemove: (favorite: Favorite) => void
  onReorder: (order: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const order = useFavoriteOrder(items, onReorder)
  const { host } = order
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !host.current?.contains(event.target))
        setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open, host])
  return (
    <section
      className={`sidebar-favorites ${open ? 'is-open' : ''}`}
      aria-label="お気に入り"
      role="group"
      data-game-shortcuts="off"
      ref={host}
      tabIndex={-1}
      onPointerMove={order.move}
      onPointerUp={order.finish}
      onPointerCancel={order.cancel}
      onLostPointerCapture={order.cancel}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && order.cancel()) {
          event.preventDefault()
          event.stopPropagation()
          return
        }
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
            {order.displayItems.map((favorite) => {
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
                <li
                  key={favoriteKey(favorite)}
                  data-favorite-key={favoriteKey(favorite)}
                  data-active={favoriteKey(favorite) === activeKey || undefined}
                  data-dragging={
                    order.draggingKey === favoriteKey(favorite) || undefined
                  }
                >
                  <button
                    type="button"
                    className="favorite-drag-handle"
                    aria-label={`お気に入りの順番を変更：${label}`}
                    aria-describedby="favorite-reorder-help"
                    title="ドラッグして並べ替え"
                    disabled={items.length < 2}
                    onPointerDown={(event) =>
                      order.start(event, favoriteKey(favorite))
                    }
                    onKeyDown={(event) =>
                      order.moveByKey(event, favoriteKey(favorite))
                    }
                  >
                    <GripVertical size={13} />
                  </button>
                  <button
                    className={`favorite-open ${favoriteKey(favorite) === activeKey ? 'active' : ''}`}
                    aria-current={
                      favoriteKey(favorite) === activeKey ? 'page' : undefined
                    }
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
        <p id="favorite-reorder-help" className="sr-only">
          ドラッグ、または上下矢印キーで並べ替えます。Escapeでドラッグを取り消します。
        </p>
        <span className="sr-only" aria-live="polite">
          {order.announcement}
        </span>
      </div>
    </section>
  )
}
