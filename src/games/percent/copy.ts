import type { Bet } from './logic'

/**
 * Agency copy: the stamp and the deadpan line for a Spy's field report, and bet labels as
 * stamps. Pure, so the words are tested and the same on every screen.
 */

export interface Verdict {
  /** Stamp text, short caps. */
  stamp: string
  /** Ink: good news in green, bad in red, middling in blue. */
  tone: 'good' | 'mid' | 'bad'
  /** One deadpan line after the name. */
  line: string
}

export function spyVerdict(guess: number, answer: number, locked: boolean): Verdict {
  const off = Math.abs(answer - guess)
  if (!locked) return { stamp: 'No report', tone: 'bad', line: 'never filed. HQ wrote down 50.' }
  if (off === 0) return { stamp: 'Dead on', tone: 'good', line: 'nailed it exactly. Internal Affairs is looking into it.' }
  if (off <= 3) return { stamp: `Off by ${off}`, tone: 'good', line: `was off by ${off}. Medal pending.` }
  if (off <= 10) return { stamp: `Off by ${off}`, tone: 'mid', line: `was off by ${off}. Acceptable losses.` }
  if (off < 25) return { stamp: `Off by ${off}`, tone: 'mid', line: `was off by ${off}. HQ is disappointed, not surprised.` }
  return { stamp: 'Cover blown', tone: 'bad', line: `was off by ${off}. Reassigned to a desk in Tampa.` }
}

export const BET_STAMP: Record<Bet, string> = {
  muchLower: 'Much lower',
  lower: 'Lower',
  higher: 'Higher',
  muchHigher: 'Much higher',
}

export const isLower = (b: Bet) => b === 'lower' || b === 'muchLower'
export const isMuch = (b: Bet) => b === 'muchLower' || b === 'muchHigher'

/** The file number on the folder tab: "FILE 03 / 06", or the final briefing. */
export function fileNo(round: number, total: number): string {
  if (round >= total) return 'Final briefing'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `File ${pad(round + 1)} / ${pad(total)}`
}
