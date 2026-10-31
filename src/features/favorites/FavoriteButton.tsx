import { Star } from 'lucide-react'

export function FavoriteButton({
  active,
  onClick,
  passageTitle,
}: {
  active: boolean
  onClick: () => void
  passageTitle?: string
}) {
  const action = active ? 'お気に入りを解除' : 'お気に入りに登録'
  const label = passageTitle ? `${action}：${passageTitle}` : action
  return (
    <button
      type="button"
      className="favorite-toggle text-button"
      data-game-shortcuts="off"
      aria-pressed={active}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <Star size={15} fill={active ? 'currentColor' : 'none'} />
      <span>{active ? 'お気に入り登録済み' : 'お気に入りに登録'}</span>
    </button>
  )
}
