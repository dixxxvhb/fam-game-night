import { LETTERS, type CategoriesState } from './logic'

/**
 * The Letter Machine's timing, shared by the TV, the phones and the compact Stage so every
 * screen pulls the lever, spins and lands on the same frame (they all read the host clock).
 * Presentation only: the write clock in logic.ts starts at the same moment and keeps running.
 */

/** Lever down and back up. */
export const LEVER_MS = 450
/** The reel stops (with its little overshoot) here. */
export const LAND_MS = 3800
/** Phones hand over the pad here, after the landing has had its moment. */
export const ROLL_MS = 4400
/** Letters on the reel strip, the last one being the round's letter. */
export const REEL_LEN = 24
/** The clock music speeds up here, and again at PANIC_SECS. */
export const HURRY_SECS = 10
export const PANIC_SECS = 5

/** When the current write stage began (host time). */
export function writeStartedAt(s: Pick<CategoriesState, 'endsAt' | 'stageTotal'>): number {
  return s.endsAt - s.stageTotal
}

export type RollPhase = 'lever' | 'spin' | 'landed' | 'done'

/** Where the machine is, `ms` after the write stage began. Never rolls outside the write stage. */
export function rollPhase(stage: CategoriesState['stage'], ms: number): RollPhase {
  if (stage !== 'write' || ms >= ROLL_MS || ms < 0) return 'done'
  if (ms < LEVER_MS) return 'lever'
  if (ms < LAND_MS) return 'spin'
  return 'landed'
}

/**
 * The letters printed on the reel for one round: REEL_LEN of them, ending on `letter`, never
 * the same letter twice in a row. Seeded by the round so every screen draws the same strip.
 */
export function reelStrip(letter: string, round: number): string[] {
  let h = 2166136261 ^ (round * 7919 + letter.charCodeAt(0))
  const next = () => { h = Math.imul(h ^ (h >>> 15), 2246822519); h ^= h >>> 13; return (h >>> 0) / 4294967296 }
  const out: string[] = []
  for (let i = 0; i < REEL_LEN - 1; i++) {
    let pick = LETTERS[Math.floor(next() * LETTERS.length)]
    const prev = out.at(-1)
    const last = i === REEL_LEN - 2
    while (pick === prev || (last && pick === letter)) pick = LETTERS[(LETTERS.indexOf(pick) + 1) % LETTERS.length]
    out.push(pick)
  }
  out.push(letter)
  return out
}

export type ClockMood = 'calm' | 'hurry' | 'panic' | 'up'

/** How the writing clock should feel with `secsLeft` on it. */
export function clockMood(secsLeft: number): ClockMood {
  if (secsLeft <= 0) return 'up'
  if (secsLeft <= PANIC_SECS) return 'panic'
  if (secsLeft <= HURRY_SECS) return 'hurry'
  return 'calm'
}
