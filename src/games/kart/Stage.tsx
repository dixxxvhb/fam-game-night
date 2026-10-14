import { useEffect } from 'react'
import type { StageProps } from '../../engine/types'
import { useTicker } from '../../engine/context'
import { Avatar, cx, Label } from '../../ui/kit'
import { Countdown } from '../../ui/Countdown'
import { SKY_BG } from '../board/park/ui'
import { critter } from '../board/park/cast'
import { charOf, fmtMs, trackName, TRIAL_MS, TRIAL_RUNS, type KartState } from './logic'
import { getTrack } from './tracks'
import '../board/park/show/show.css'
import './show/show.css'
import { useHostRace } from './show/useHostRace'
import { useShowAudio } from './show/audio'
import { whoFrom } from './show/bits'
import { PickScreen } from './show/Pick'
import { CupIntro } from './show/CupIntro'
import { RaceShell } from './show/Race'
import { RaceResult } from './show/Results'
import { PodiumScreen } from './show/Podium'
import { CompactStrip } from './show/Compact'

/**
 * Turnpike on the TV (and the slim strip on apart phones). The host device also runs the race
 * sim here (useHostRace), compact or not. Every stage is its own screen under show/.
 */
export function KartStage(props: StageProps<KartState>) {
  if (props.state.kind === 'trial') return <TrialBoard {...props} />
  return <RaceStage {...props} />
}

function RaceStage({ state: s, room, now, isHost, hostAction, compact, me }: StageProps<KartState>) {
  useTicker(100)
  const race = useHostRace({ s, room, now, isHost, hostAction })
  useShowAudio(s, now, race)
  const who = whoFrom(room.players, s)
  usePreload(s, room.players)
  const t = now()

  if (compact) return <CompactStrip s={s} who={who} now={t} me={me ?? null} race={race} />

  let layer = null
  switch (s.stage) {
    case 'pick': layer = <PickScreen s={s} who={who} now={t} />; break
    case 'cupIntro': layer = <CupIntro s={s} />; break
    case 'trackIntro': case 'countdown': case 'race': case 'freeze':
      layer = <RaceShell s={s} who={who} now={now} race={race} />
      break
    case 'raceResult': layer = <RaceResult s={s} who={who} now={t} />; break
    case 'podium': case 'done': layer = <PodiumScreen s={s} who={who} />; break
  }
  return (
    <div data-kart-stage={s.stage} className="relative h-full min-h-0 w-full overflow-hidden" style={{ background: SKY_BG }}>
      {layer}
    </div>
  )
}

/**
 * Sprites rasterize lazily and slowly: warm every kart (the room's critters in their room colors),
 * prop and thing as soon as we know who drives what, so the race never shows placeholder blobs.
 */
function usePreload(s: KartState, players: StageProps<KartState>['room']['players']) {
  const ids = s.ids
  const key = ids.map((id) => `${charOf(s, id) ?? ''}:${players.find((p) => p.id === id)?.color ?? ''}`).join(',')
  const track = getTrack(s.track)
  const night = !!track.look?.night
  useEffect(() => {
    // Only karts with a driver (a plain placeholder kart for everyone would double the work).
    const rows = key.split(',').map((r) => r.split(':')).filter(([c]) => critter(c))
    const chars = rows.map(([c]) => (critter(c)?.id ?? null))
    const colors = rows.map(([, col]) => col || '#8C87A6')
    // propKinds (newer garage): warm just this track's props, chase-cam views first.
    const propKinds = [...new Set(track.props.map((p) => p.kind))]
    // Loaded on demand: the garage rasterizes through the DOM at import time.
    void import('./garage/sprites').then(({ preloadGarage }) => preloadGarage(chars, colors, { night, propKinds } as Parameters<typeof preloadGarage>[2]))
  }, [key, night, track])
}

// ---------------- apart mode: the time trial board ----------------

function TrialBoard({ state: s, room, now, compact }: StageProps<KartState>) {
  useTicker(500)
  const who = (id: string) => room.players.find((p) => p.id === id)
  const rows = [...s.ids].sort((a, b) => {
    const x = s.runners[a]?.best ?? Infinity
    const y = s.runners[b]?.best ?? Infinity
    return x - y
  })
  return (
    <div className={cx('grid gap-2', !compact && 'mx-auto max-w-2xl p-8')}>
      <div className="flex items-baseline justify-between gap-3">
        <div className={cx('font-display', compact ? 'text-lg' : 'text-4xl')}>{s.stage === 'trial' ? 'Time trial' : 'Time'}</div>
        <Label>{trackName(s.track)} · best of {TRIAL_RUNS}</Label>
      </div>
      {s.stage === 'trial' && <Countdown endsAt={s.endsAt} total={TRIAL_MS} now={now} />}
      <div className="grid gap-1">
        {rows.map((id, i) => {
          const p = who(id)
          const r = s.runners[id]
          return (
            <div key={id} className="flex items-center gap-2">
              <span className="w-5 font-mono text-sm text-ink-3">{r?.best !== null && r?.best !== undefined ? i + 1 : ''}</span>
              <Avatar name={p?.name ?? id} color={p?.color ?? '#8790B6'} size={compact ? 22 : 36} />
              <span className={cx('min-w-0 flex-1 truncate font-bold', compact ? 'text-sm' : 'text-xl')}>{p?.name ?? id}</span>
              {r?.driving && <span className="font-mono text-xs text-hot">driving</span>}
              <span className="flex gap-1" aria-label={`${r?.runs.length ?? 0} of ${TRIAL_RUNS} runs`}>
                {Array.from({ length: TRIAL_RUNS }, (_, k) => (
                  <span key={k} className={cx('h-2 w-2 rounded-full', k < (r?.runs.length ?? 0) ? 'bg-ink-2' : 'bg-line')} />
                ))}
              </span>
              <span className={cx('w-16 text-right font-mono tabular', compact ? 'text-sm' : 'text-xl')}>{fmtMs(r?.best)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
