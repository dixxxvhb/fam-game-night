import type { BotMove, GameCtx } from '../../engine/types'
import { currentQuestion, MUCH, type Bet, type PercentState } from './logic'

/** Roughly normal noise with sd 1 (sum of three uniforms, rescaled). */
function noise(random: () => number): number {
  return (random() + random() + random() - 1.5) * 2
}

/** The bot's read on a percent: the truth plus a human-sized miss (sd ~15). */
export function botGuess(answer: number, random: () => number): number {
  return Math.max(0, Math.min(100, Math.round(answer + noise(random) * 15)))
}

/** Act once `min` ms have passed: a small chance per call, certain by `max`. */
function ready(elapsed: number, min: number, max: number, random: () => number, chance: number): boolean {
  if (elapsed < min) return false
  return elapsed >= max || random() < chance
}

/** Pick a bet: the right direction about 62% of the time, "much" when the gap is big. */
export function botBet(guess: number, answer: number, random: () => number): Bet {
  const up = answer === guess ? random() < 0.5 : answer > guess
  const right = random() < 0.62
  const goUp = right ? up : !up
  const gap = Math.abs(answer - guess)
  const much = gap >= MUCH + 5 ? random() < 0.8 : gap >= MUCH ? random() < 0.35 : random() < 0.08
  if (goUp) return much ? 'muchHigher' : 'higher'
  return much ? 'muchLower' : 'lower'
}

/**
 * Bots: as the Spy they lock in the truth plus a miss (sd ~15) after 4 to 12 seconds.
 * As bettors they call the right direction about 62% of the time and go "much" when the
 * Spy is far off. In the final round they guess the truth plus a miss.
 */
export function bot(s: PercentState, id: string, ctx: GameCtx): BotMove | null {
  const q = currentQuestion(s)
  if (!q) return null
  const elapsed = ctx.now - s.stageStartedAt
  if (s.stage === 'spy') {
    if (s.spy !== id || !ready(elapsed, 4000, 12_000, ctx.random, 0.06)) return null
    return { type: 'lock', payload: { value: botGuess(q.answer, ctx.random) } }
  }
  if (s.stage === 'bet') {
    if (s.spy === id || s.bets[id] || s.guess === null) return null
    if (!ready(elapsed, 2500, 10_000, ctx.random, 0.07)) return null
    return { type: 'bet', payload: { bet: botBet(s.guess, q.answer, ctx.random) } }
  }
  if (s.stage === 'final') {
    if (id in s.finalGuesses || !ready(elapsed, 4000, 14_000, ctx.random, 0.05)) return null
    return { type: 'final', payload: { value: botGuess(q.answer, ctx.random) } }
  }
  return null
}
