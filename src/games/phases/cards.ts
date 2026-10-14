/**
 * The Phases deck and phase table. Cards are plain ids (0..107) so state stays small JSON:
 *   0..95   numbers: color = floor(id / 24), number = id % 12 + 1 (two of each per color)
 *   96..103 Wild
 *   104..107 Skip
 */

export type Color = 'red' | 'blue' | 'green' | 'yellow'
export const COLORS: Color[] = ['red', 'blue', 'green', 'yellow']
export type Kind = 'num' | 'wild' | 'skip'

export interface Card {
  id: number
  kind: Kind
  /** 1..12 for number cards, 0 for Wild and Skip. */
  n: number
  color: Color | null
}

export const DECK_SIZE = 108
export const HAND_SIZE = 10
export const ALL_IDS: number[] = Array.from({ length: DECK_SIZE }, (_, i) => i)

export function isCardId(x: unknown): x is number {
  return typeof x === 'number' && Number.isInteger(x) && x >= 0 && x < DECK_SIZE
}

export function card(id: number): Card {
  if (id < 96) return { id, kind: 'num', n: (id % 12) + 1, color: COLORS[Math.floor(id / 24)] }
  if (id < 104) return { id, kind: 'wild', n: 0, color: null }
  return { id, kind: 'skip', n: 0, color: null }
}

export const isWild = (id: number) => id >= 96 && id < 104
export const isSkip = (id: number) => id >= 104

/** Penalty points for a card left in hand: 1-9 = 5, 10-12 = 10, Skip = 15, Wild = 25. */
export function penalty(id: number): number {
  const c = card(id)
  if (c.kind === 'wild') return 25
  if (c.kind === 'skip') return 15
  return c.n >= 10 ? 10 : 5
}

/** "red 7", "Wild", "Skip". */
export function cardName(id: number): string {
  const c = card(id)
  if (c.kind === 'wild') return 'Wild'
  if (c.kind === 'skip') return 'Skip'
  return `${c.color} ${c.n}`
}

/** "the red 7", "a Wild", "a Skip". */
export function cardPhrase(id: number): string {
  const c = card(id)
  return c.kind === 'num' ? `the ${cardName(id)}` : `a ${cardName(id)}`
}

const COLOR_ORDER: Record<Color, number> = { red: 0, blue: 1, green: 2, yellow: 3 }

function rank(id: number, by: 'number' | 'color'): number {
  const c = card(id)
  if (c.kind === 'wild') return 10_000 + id
  if (c.kind === 'skip') return 20_000 + id
  const col = COLOR_ORDER[c.color!]
  return by === 'number' ? c.n * 100 + col * 10 + (id % 24 >= 12 ? 1 : 0) : col * 1000 + c.n * 10 + (id % 24 >= 12 ? 1 : 0)
}

export function sortHand(ids: number[], by: 'number' | 'color'): number[] {
  return [...ids].sort((a, b) => rank(a, by) - rank(b, by))
}

// ---------------- phases ----------------

export type ReqType = 'set' | 'run' | 'color'
export interface Req { type: ReqType; size: number }

const set = (size: number): Req => ({ type: 'set', size })
const run = (size: number): Req => ({ type: 'run', size })

export const PHASES: { reqs: Req[]; label: string }[] = [
  { reqs: [set(3), set(3)], label: '2 sets of 3' },
  { reqs: [set(3), run(4)], label: '1 set of 3 + 1 run of 4' },
  { reqs: [set(4), run(4)], label: '1 set of 4 + 1 run of 4' },
  { reqs: [run(7)], label: '1 run of 7' },
  { reqs: [run(8)], label: '1 run of 8' },
  { reqs: [run(9)], label: '1 run of 9' },
  { reqs: [set(4), set(4)], label: '2 sets of 4' },
  { reqs: [{ type: 'color', size: 7 }], label: '7 cards of one color' },
  { reqs: [set(5), set(2)], label: '1 set of 5 + 1 set of 2' },
  { reqs: [set(5), set(3)], label: '1 set of 5 + 1 set of 3' },
]

export const LENGTHS: Record<string, number[]> = {
  full: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  short: [0, 1, 2, 3, 4],
  odds: [0, 2, 4, 6, 8],
}

export function reqLabel(r: Req): string {
  if (r.type === 'set') return `Set of ${r.size}`
  if (r.type === 'run') return `Run of ${r.size}`
  return `${r.size} of one color`
}
