import { useEffect, useLayoutEffect, useRef } from 'react'
import { sfx } from '../../../ui/sfx'
import { music, useParkMusic, type TrackId } from '../../board/park/music'
import type { BowlState } from '../logic'
import { msAt, WINDUP_MS } from '../timeline'

/** Which Party Park loop plays under each stage. */
export function trackFor(s: BowlState): TrackId | null {
  switch (s.stage) {
    case 'pick': return 'title'
    case 'aim': case 'roll': case 'result': return s.frame >= s.frames - 1 ? 'tense' : 'board'
    case 'podium': case 'done': return 'finale'
  }
  return null
}

/**
 * Music and moments on every screen that shows the lane (the TV, apart phones): the loop for the
 * stage, a whoosh at release and the crash when the ball meets the pins (on the replay clock, slow
 * motion included), a stinger per result, the turn sting for a new bowler, the podium fanfare.
 */
export function useBowlAudio(s: BowlState, now: () => number) {
  useParkMusic(trackFor(s))
  const clock = useRef(now)
  useLayoutEffect(() => { clock.current = now })

  const roll = s.stage === 'roll' ? s.roll : null
  const rollN = roll?.n ?? 0
  useEffect(() => {
    if (!roll) return
    const timers: number[] = []
    const at = (ms: number, fn: () => void) => {
      const wait = roll.at + ms - clock.current()
      if (wait < -200) return
      timers.push(window.setTimeout(fn, Math.max(0, wait)))
    }
    at(WINDUP_MS - 120, () => sfx.play('whoosh'))
    if (roll.hit >= 0) at(WINDUP_MS + msAt({ n: roll.replay.n, dt: roll.replay.dt, hit: roll.hit }, roll.hit), () => sfx.play('pop'))
    return () => timers.forEach((t) => window.clearTimeout(t))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one set of sounds per throw
  }, [rollN])

  const resN = useRef(s.result?.n ?? 0)
  useEffect(() => {
    const r = s.result
    if (!r || s.stage !== 'result' || r.n === resN.current) return
    resN.current = r.n
    if (r.kind === 'strike') { music.stinger((r.streak ?? 1) >= 3 ? 'win' : 'star'); sfx.play('good') }
    else if (r.kind === 'spare') { music.stinger('coins'); sfx.play('good') }
    else if (r.kind === 'gutter' || r.kind === 'miss') { music.stinger('lose'); sfx.play('bad') }
    else if (r.kind === 'split') sfx.play('bad')
  }, [s.result, s.stage])

  // A new bowler steps up (first ball of their frame): the turn sting. The very first ball: go.
  const turnKey = s.stage === 'aim' && s.standing.length === 10 ? `${s.frame}:${s.turn}` : ''
  const lastTurn = useRef(turnKey)
  useEffect(() => {
    if (!turnKey || turnKey === lastTurn.current) return
    const first = lastTurn.current === '' && s.throwNo === 0
    lastTurn.current = turnKey
    if (first) music.stinger('go')
    else music.stinger('turn')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnKey])

  const podium = s.stage === 'podium'
  useEffect(() => { if (podium) music.stinger('win') }, [podium])
}
