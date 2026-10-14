import type { BotMove, GameCtx } from '../../engine/types'
import { botStyle, simJar, stepsAt, type BotJar } from './botjar'
import type { MelonState } from './logic'

/**
 * Odds per second that a bot's jar tops out: nothing while there's room, climbing as the
 * jar crowds, and (in Race) climbing again late in the clock when bots get greedy.
 */
export function topOutRate(s: Pick<MelonState, 'mode' | 'startsAt' | 'total'>, jar: Pick<BotJar, 'fill'>, now: number): number {
  const frac = Math.max(0, (now - s.startsAt) / s.total)
  const late = s.mode === 'race' ? Math.max(0, (frac - 0.45) / 0.55) : Math.min(1, frac * 2)
  return Math.max(0, jar.fill - 0.7) * 0.03 * (1 + 3 * late)
}

/**
 * Bots can't run the phone's physics, so their jar is the model in botjar.ts, advanced by the
 * clock. The bot reports what the model says, the way a phone would: score in bursts as
 * merges land, its best fruit, junk thrown at rivals in Attack (one 'attack' per big merge),
 * junk taken in ('absorb', a beat after it arrives, and it lands in the model jar), and 'over'
 * when the jar overflows or its luck runs out.
 */
export function bot(s: MelonState, id: string, ctx: GameCtx): BotMove | null {
  if (s.stage !== 'play') return null
  const me = s.players[id]
  if (!me?.alive) return null
  if (me.incoming.length && ctx.random() < 0.3) return { type: 'absorb', payload: { id: me.incoming[0].id } }
  const style = botStyle(id, s.startsAt)
  const jar = simJar(style, stepsAt(style, s.startsAt, ctx.now), s.startsAt, me.junkIn)
  if (jar.fill >= 1 || ctx.random() < topOutRate(s, jar, ctx.now) / 5) return { type: 'over', payload: { score: Math.max(jar.score, me.score) } }
  if (jar.best > me.best) return { type: 'best', payload: { tier: jar.best } }
  if (jar.score > me.score) return { type: 'score', payload: { score: jar.score } }
  const sent = me.sent ?? 0
  if (s.mode === 'attack' && jar.attacks.length > sent) return { type: 'attack', payload: { n: jar.attacks[sent] } }
  return null
}
