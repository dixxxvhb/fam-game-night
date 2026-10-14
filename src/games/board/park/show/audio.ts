import { useEffect, useRef } from 'react'
import { sfx } from '../../../../ui/sfx'
import { music, useParkMusic, type TrackId } from '../music'
import { hopsDone, isLastFive, type BoardState } from '../../logic'
import { isStarBought } from './TurnCards'
import { resultIsWin } from './MgResult'
import { MG_COINS_LAND_MS } from './Hud'

/** Which loop plays under each stage. */
export function trackFor(s: BoardState): TrackId | null {
  switch (s.stage) {
    case 'intro': case 'pick': case 'order': return 'title'
    case 'mgSpin': case 'mgIntro': return 'spin'
    case 'mgPlay': return 'minigame'
    case 'mgResult': return 'results'
    case 'bonus': case 'final': case 'done': return 'finale'
    default: return isLastFive(s) ? 'tense' : 'board'
  }
}

/**
 * Music and the moments: one loop per stage, a stinger on each beat that should land
 * (turn banner, Star bought, last five, GO, win or lose, coins, event reveal), and the small
 * sfx that still fit (hops, rolls, picks, block hits, ready checks).
 */
export function useShowAudio(s: BoardState, now: () => number) {
  useParkMusic(trackFor(s))
  const hop = hopsDone(s, now())
  const startAt = s.stage === 'mgPlay' ? (s.mg?.s as { startAt?: number } | null)?.startAt ?? 0 : 0
  const started = startAt > 0 && now() >= startAt
  const picked = Object.values(s.chars).filter(Boolean).length
  const hits = Object.values(s.orderRolls).filter((v) => v !== null).length
  const ready = s.mg?.ready.length ?? 0
  const landed = s.stage === 'mgResult' && !!s.mg?.awards && Object.values(s.mg.awards).some((v) => v > 0) && now() - s.stageAt > MG_COINS_LAND_MS
  const prev = useRef({ stage: s.stage, at: s.stageAt, hop, shown: s.bonus?.shown ?? 0, started, picked, hits, ready, landed })

  useEffect(() => {
    const p = prev.current
    const fresh = s.stage !== p.stage || s.stageAt !== p.at
    if (fresh) {
      const n = s.notice
      switch (s.stage) {
        case 'turnStart': music.stinger('turn'); break
        case 'roll': if (!s.usedItem && !s.event) sfx.play('whoosh'); break
        case 'rolling': sfx.play('whoosh'); break
        case 'lastFive': music.stinger('lastFive'); break
        case 'event': music.stinger('event'); break
        case 'star': sfx.play('reveal'); break
        case 'shop': case 'duelPick': case 'fork': sfx.play('pop'); break
        case 'mgSpin': sfx.play('whoosh'); break
        case 'mgIntro': sfx.play('reveal'); break
        case 'mgResult': music.stinger(resultIsWin(s) ? 'win' : 'lose'); break
        case 'final': music.stinger('win'); break
        case 'land':
          if (!n) break
          if (isStarBought(n)) music.stinger('star')
          else if ((n.delta?.[n.who] ?? 0) > 0) music.stinger('coins')
          else if (n.kind === 'red' || n.kind === 'skip' || (n.delta?.[n.who] ?? 0) < 0) sfx.play('bad')
          else sfx.play('good')
          break
      }
    }
    if (s.stage === 'moving' && hop !== p.hop && hop > 0) sfx.play('pop')
    if (s.bonus && s.bonus.shown !== p.shown && s.bonus.shown > 0) music.stinger('star')
    if (started && !p.started) music.stinger('go')
    if (picked > p.picked) sfx.play('good')
    if (hits > p.hits) sfx.play('pop')
    if (ready > p.ready && s.stage === 'mgIntro') sfx.play('tick')
    if (landed && !p.landed) music.stinger('coins')
    prev.current = { stage: s.stage, at: s.stageAt, hop, shown: s.bonus?.shown ?? 0, started, picked, hits, ready, landed }
  }, [s, hop, started, picked, hits, ready, landed])
}
