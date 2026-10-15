import { useEffect, useRef } from 'react'
import type { StageProps } from '../../engine/types'
import { useTicker } from '../../engine/context'
import { sfx } from '../../ui/sfx'
import { INK } from '../board/park/cast'
import { music, useParkMusic, type TrackId } from '../board/park/music'
import '../board/park/show/show.css'
import './arena.css'
import { VS_MS, type ArenaState } from './logic'
import { useArenaSim, type ArenaFeed } from './useArenaSim'
import { ArenaView, closesIn } from './show/Arena'
import { PickScreen, PickStrip } from './show/Pick'
import { PodiumScreen } from './show/Podium'
import { whoFrom } from './show/bits'
import { preloadCritters } from './art/sprites'

/**
 * Kaboom on the TV, and the strip above the controls on apart phones. The host device (TV
 * together, host phone apart) also runs the arena here (useArenaSim); every other screen draws
 * it from the host's snapshots. Each stage is its own screen under show/.
 */
export function ArenaStage({ state: s, room, now, isHost, hostAction, compact, me }: StageProps<ArenaState>) {
  useTicker(compact ? 200 : 120)
  const feed = useArenaSim({ s, room, isHost, hostAction })
  const who = whoFrom(room.players, s)
  const t = now()
  useArenaAudio(s, t, feed)

  // Warm every critter sprite as soon as we know who is who.
  const chars = s.order.map((id) => s.chars[id]).filter(Boolean).join(',')
  useEffect(() => {
    if (!chars) return
    preloadCritters(chars.split(',') as never[], compact ? 120 : 96)
  }, [chars, compact])

  if (compact) {
    return (
      <div data-arena-stage={s.stage} className="grid gap-2">
        {s.stage === 'pick' && <PickStrip s={s} now={t} />}
        {(s.stage === 'intro' || s.stage === 'play' || s.stage === 'over') && <ArenaView s={s} who={who} now={t} feed={feed} compact me={me ?? null} />}
        {(s.stage === 'podium' || s.stage === 'done') && <PodiumScreen s={s} who={who} compact />}
      </div>
    )
  }

  return (
    <div data-arena-stage={s.stage} className="relative h-full min-h-0 w-full overflow-hidden" style={{ color: INK }}>
      {s.stage === 'pick' && <PickScreen s={s} who={who} now={t} />}
      {(s.stage === 'intro' || s.stage === 'play' || s.stage === 'over') && <ArenaView s={s} who={who} now={t} feed={feed} compact={false} me={null} />}
      {(s.stage === 'podium' || s.stage === 'done') && <PodiumScreen s={s} who={who} />}
    </div>
  )
}

/** Music per stage, stingers on the beats: 3-2-1, GO, the park closing, the round's end. */
function useArenaAudio(s: ArenaState, t: number, feed: ArenaFeed) {
  const closing = s.stage === 'play' && closesIn(feed.sim()) === 0
  const track: TrackId | null =
    s.stage === 'pick' ? 'title'
      : s.stage === 'intro' ? 'spin'
        : s.stage === 'play' ? (closing ? 'tense' : 'minigame')
          : s.stage === 'over' ? 'results'
            : 'finale'
  useParkMusic(track)

  const beat = s.stage === 'intro' && t - s.stageAt >= VS_MS ? Math.max(1, Math.ceil((s.startsAt - t) / 1000)) : 0
  const seen = useRef('')
  useEffect(() => {
    if (!beat) return
    sfx.play('tick')
  }, [beat, s.round])
  const key = `${s.round}:${s.stage}`
  useEffect(() => {
    if (seen.current === key) return
    seen.current = key
    if (s.stage === 'play') music.stinger('go')
    else if (s.stage === 'over') music.stinger(s.rounds.at(-1)?.winner ? 'win' : 'lose')
    else if (s.stage === 'podium') music.stinger('win')
    else if (s.stage === 'intro') sfx.play('whoosh')
  }, [key, s.stage, s.rounds])
  const closeKey = closing ? `${s.round}` : ''
  useEffect(() => {
    if (closeKey) music.stinger('event')
  }, [closeKey])
}

