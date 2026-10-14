import { CENTER, awayFromHome, homeStarOf, isHome, isStar } from './geometry'
import type { AggroState, LogEvent, Move } from './logic'

type NameOf = (seat: number) => string

/** One log line: "Torii rolled a 6 and Aggro'd Johnnyboy. Roll again." */
export function eventText(ev: LogEvent, name: NameOf): string {
  const who = name(ev.seat)
  const rolled = `${who} rolled a ${ev.roll}`
  const again = ev.extra ? ' Roll again.' : ''
  if (ev.kind === 'none') return `${rolled}. No moves.${again}`
  if (ev.won) return `${rolled} and got all four home.`
  const n = ev.m + 1
  let what: string
  if (ev.hit >= 0) what = `Aggro'd ${name(ev.hit)}`
  else if (ev.kind === 'out') what = `brought out marble ${n}`
  else if (ev.kind === 'center-in') what = 'took the center'
  else if (ev.kind === 'center-out') what = 'came out of the center'
  else if (isHome(ev.to) && !isHome(ev.from)) what = `got marble ${n} home`
  else if (isHome(ev.to)) what = `tucked marble ${n} deeper`
  else if (ev.kind === 'stars') what = 'took the star shortcut'
  else if (isStar(ev.to)) what = 'landed on a star'
  else what = `moved marble ${n}`
  return `${rolled} and ${what}.${again}`
}

/** Button copy for a move: title "Marble 2", detail "5 spaces, lands on a star". */
export function moveText(mv: Move, s: Pick<AggroState, 'arms' | 'turn'>, name: NameOf): { title: string; detail: string } {
  const arm = s.arms[s.turn]
  const parts: string[] = []
  const sp = (n: number) => `${n} ${n === 1 ? 'space' : 'spaces'}`
  if (mv.kind === 'out') parts.push(mv.steps ? `out of base, ${sp(mv.steps)}` : 'out to start')
  else if (mv.kind === 'center-in') parts.push('into the center')
  else if (mv.kind === 'center-out') {
    parts.push(mv.to === homeStarOf(arm) ? 'out of the center to your home star' : `out of the center to a star ${awayFromHome(arm, mv.to)} from home`)
  } else if (mv.kind === 'stars') {
    parts.push(`${mv.hops} star ${mv.hops === 1 ? 'hop' : 'hops'}${mv.steps ? `, then ${sp(mv.steps)}` : ''}`)
  } else parts.push(sp(mv.steps))

  if (mv.hit >= 0) parts.push(`sends ${name(mv.hit)} home`)
  else if (isHome(mv.to) && !isHome(mv.from)) parts.push('into home')
  else if (isStar(mv.to) && mv.kind !== 'center-out') parts.push('lands on a star')
  else if (mv.to !== CENTER && !isHome(mv.to) && awayFromHome(arm, mv.to) <= 6) parts.push(`${awayFromHome(arm, mv.to)} from home`)

  const detail = parts.join(', ')
  return { title: `Marble ${mv.m + 1}`, detail: detail.charAt(0).toUpperCase() + detail.slice(1) }
}
