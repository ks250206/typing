import { Star } from 'lucide-react'

export function FavoriteButton({
  active,
  onClick,
}: {
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      className="favorite-toggle text-button"
      data-game-shortcuts="off"
      aria-pressed={active}
      aria-label={active ? 'お気に入りを解除' : 'お気に入りに登録'}
      onClick={onClick}
    >
      <Star size={15} fill={active ? 'currentColor' : 'none'} />
      {active ? 'お気に入り登録済み' : 'お気に入りに登録'}
    </button>
  )
}
