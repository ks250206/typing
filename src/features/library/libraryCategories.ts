import type { Passage } from '../../domain/content/passages'

/** Keep the original themes searchable while grouping the six authored essays. */
export const libraryCategory = (p: Passage) =>
  ['文学', '旅', '科学', '日常', '思索', '音楽'].includes(p.genre)
    ? 'オリジナル文章'
    : p.genre
