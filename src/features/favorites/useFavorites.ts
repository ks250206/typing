import { useEffect, useMemo, useState } from 'react'
import {
  favoriteKey,
  reorderFavorites,
  type Favorite,
} from '../../domain/records/favorites'
import {
  FAVORITES_STORAGE_KEY,
  readFavorites,
  saveFavorites,
} from '../../infrastructure/persistence/favorites'

export function useFavorites(onNotice: (message: string) => void) {
  const [items, setItems] = useState(readFavorites)
  const keys = useMemo(() => new Set(items.map(favoriteKey)), [items])
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === FAVORITES_STORAGE_KEY || event.key === null)
        setItems(readFavorites())
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])
  const update = (next: Favorite[]) => {
    setItems(next)
    if (!saveFavorites(next))
      onNotice('お気に入りを保存できません。この画面では引き続き利用できます。')
  }
  const remove = (favorite: Favorite) =>
    update(items.filter((item) => favoriteKey(item) !== favoriteKey(favorite)))
  return {
    items,
    has: (favorite: Favorite) => keys.has(favoriteKey(favorite)),
    remove,
    reorder: (order: string[]) => {
      const next = reorderFavorites(items, order)
      if (next !== items) update(next)
    },
    toggle: (favorite: Favorite) =>
      keys.has(favoriteKey(favorite))
        ? remove(favorite)
        : update([...items, favorite]),
  }
}
