// Shared by Trivia Night and Survive the Quiz.

export type CatKey =
  | 'movies' | 'disney' | 'broadway' | 'dance' | 'pop'
  | 'tv' | 'florida' | 'food' | 'animals' | 'science'
  | 'geography' | 'history' | 'sports' | 'words' | 'random'

export interface Question {
  id: string
  cat: CatKey
  q: string
  /** Exactly four, all different. */
  options: string[]
  /** Index of the one right option. */
  answer: number
  difficulty: 1 | 2 | 3
  /** Where the fact was checked, when it was looked up. */
  source?: string
}

/** Wheel order. `short` fits a wheel slice, `label` is for everything else. */
export const CATEGORIES: { key: CatKey; label: string; short: string }[] = [
  { key: 'movies', label: 'Movies', short: 'Movies' },
  { key: 'disney', label: 'Disney and theme parks', short: 'Disney' },
  { key: 'broadway', label: 'Broadway and musicals', short: 'Broadway' },
  { key: 'dance', label: 'Dance', short: 'Dance' },
  { key: 'pop', label: 'Pop music', short: 'Pop' },
  { key: 'tv', label: 'TV', short: 'TV' },
  { key: 'florida', label: 'Florida', short: 'Florida' },
  { key: 'food', label: 'Food', short: 'Food' },
  { key: 'animals', label: 'Animals', short: 'Animals' },
  { key: 'science', label: 'Science', short: 'Science' },
  { key: 'geography', label: 'Geography', short: 'Geography' },
  { key: 'history', label: 'History', short: 'History' },
  { key: 'sports', label: 'Sports', short: 'Sports' },
  { key: 'words', label: 'Words', short: 'Words' },
  { key: 'random', label: 'Random', short: 'Random' },
]

export const CAT_KEYS: CatKey[] = CATEGORIES.map((c) => c.key)

export function isCat(x: unknown): x is CatKey {
  return typeof x === 'string' && (CAT_KEYS as string[]).includes(x)
}

export function catLabel(k: CatKey | null | undefined): string {
  return CATEGORIES.find((c) => c.key === k)?.label ?? ''
}

export function catShort(k: CatKey | null | undefined): string {
  return CATEGORIES.find((c) => c.key === k)?.short ?? ''
}
