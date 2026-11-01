import { OverflowMarquee } from '../../shared/ui/OverflowMarquee'
export function FavoriteMarquee({ text }: { text: string }) {
  return (
    <OverflowMarquee
      text={text}
      className="favorite-marquee"
      trackClassName="favorite-marquee-track"
    />
  )
}
