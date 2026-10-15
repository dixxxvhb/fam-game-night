import { useEffect, useRef } from 'react'
import { isHome, isStar } from '../geometry'
import { HOP_MS, type AggroState } from '../logic'
import { KNOCK_DELAY, KNOCK_MS, hopEndOf, hopStyle } from './moment'
import { foley } from './sound'

/**
 * Plays the board's foley from state changes: the die on a roll, a click per hop, and the
 * moment on landing. Mounted once per screen that shows the game (the Stage).
 */
export function useAggroSounds(s: AggroState, now: () => number) {
  const heard = useRef({ roll: s.rollAt, move: s.last?.seq ?? 0, turn: s.seq })

  useEffect(() => {
    if (!s.rollAt || s.rollAt === heard.current.roll) return
    heard.current.roll = s.rollAt
    const at = (s.rollAt - now()) / 1000
    if (at > -0.4) foley.rattle(Math.max(0, at))
  }, [s.rollAt, now])

  const L = s.last
  useEffect(() => {
    if (!L || L.seq === heard.current.move) return
    heard.current.move = L.seq
    const base = (L.at - now()) / 1000
    if (base < -1) return
    L.path.forEach((p, i) => {
      const style = hopStyle(L, i)
      const at = base + ((i + 1) * HOP_MS) / 1000
      if (style === 'zap') foley.zap(at - HOP_MS / 1000, HOP_MS / 1000)
      else if (style === 'pop') foley.pop(at - HOP_MS / 1000)
      else if (style === 'swirl') foley.swirl(at - HOP_MS / 1000)
      foley.click(at, isHome(p) ? 1.25 : 1)
    })
    const land = base + (hopEndOf(L) - L.at) / 1000
    const to = L.path[L.path.length - 1]
    if (L.hit >= 0) {
      foley.aggro(land)
      foley.plunk(land + (KNOCK_DELAY + KNOCK_MS) / 1000)
    } else if (isHome(to) && !isHome(L.from)) foley.chime(land)
    else if (isStar(to)) foley.ting(land)
    if (L.won) foley.win(land + 0.5)
  }, [L, now])

  // Turn change: a soft swoosh with the banner.
  useEffect(() => {
    if (s.phase !== 'roll' || s.seq === heard.current.turn) return
    heard.current.turn = s.seq
    foley.swoosh()
  }, [s.phase, s.seq])
}
