import { useEffect, type ReactNode } from 'react'
import type { StageProps } from '../../engine/types'
import { useTicker } from '../../engine/context'
import { cx } from '../../ui/kit'
import { INK, Mingo } from '../board/park/cast'
import { Portrait } from '../board/park/ui'
import { MusicButton } from '../../room/shared'
import '../board/park/show/show.css'
import './bowl.css'
import { LaneView } from './LaneView'
import { Scoreboard } from './Scoreboard'
import { PICK_DONE_MS, PICK_MS, type BowlState } from './logic'
import { mingoLine } from './lines'
import { NIGHT, ROOM_BG } from './look'
import { preloadSprites } from './sprites'
import { standings } from './stats'
import { useBowlAudio } from './show/audio'
import { ballLine, LanesScreen } from './show/Lanes'
import { Neon, ordinal, placeColor, whoFrom, type WhoFn } from './show/parts'
import { PickScreen } from './show/Pick'
import { PodiumScreen } from './show/Podium'
import { ResultWord } from './show/Reaction'

const WARN_MS = 10_000

/**
 * Gator Lanes on the TV, and the compact version above the controller on apart phones. Every
 * screen that shows the lane also plays the music and the moments.
 */
export function BowlStage({ state: s, room, now, compact, me }: StageProps<BowlState>) {
  useTicker(compact ? 250 : 100)
  useBowlAudio(s, now)
  const who = whoFrom(room.players, s)
  const charKey = s.order.map((id) => s.chars[id] ?? '').join(',')
  useEffect(() => { preloadSprites(Object.values(s.chars)) }, [charKey]) // eslint-disable-line react-hooks/exhaustive-deps

  if (compact) return <Compact s={s} room={room} now={now} me={me ?? null} who={who} />

  let screen = null
  if (s.stage === 'pick') screen = <PickScreen s={s} who={who} now={now()} />
  else if (s.stage === 'podium' || s.stage === 'done') screen = <PodiumScreen s={s} who={who} />
  else screen = <LanesScreen s={s} room={room} now={now} who={who} />
  return (
    <div data-bowl-stage={s.stage} className="relative h-full min-h-0 w-full overflow-hidden" style={{ background: ROOM_BG }}>
      {screen}
      <div className="absolute bottom-2 left-2 z-20 opacity-70"><MusicButton /></div>
    </div>
  )
}

// ---------------- apart: the compact stage above each phone's controller ----------------

function Compact({ s, room, now, me, who }: { s: BowlState; room: StageProps<BowlState>['room']; now: () => number; me: string | null; who: WhoFn }) {
  const t = now()
  const wrap = (body: ReactNode) => (
    <div data-bowl-stage={s.stage} className="-m-3 grid gap-2 p-3" style={{ background: ROOM_BG, color: NIGHT.text }}>
      {body}
    </div>
  )

  if (s.stage === 'pick') {
    const picked = s.order.filter((id) => s.chars[id])
    const all = picked.length === s.order.length
    const left = Math.max(0, s.endsAt - t)
    return wrap(
      <div className="flex items-center gap-3">
        <Neon size={24} color={NIGHT.pink} glowColor={NIGHT.pink}>GATOR LANES</Neon>
        <div className="flex min-w-0 flex-1 justify-end -space-x-2">
          {s.order.map((id) => <Portrait key={id} char={s.chars[id]} name={who(id).name} size={34} dim={!s.chars[id]} />)}
        </div>
        <div className="h-3 w-16 shrink-0 overflow-hidden rounded-full border-2" style={{ borderColor: INK, background: '#fff' }}>
          <div className="h-full" style={{ width: `${Math.min(1, left / (all ? PICK_DONE_MS : PICK_MS)) * 100}%`, background: NIGHT.pink }} />
        </div>
      </div>,
    )
  }

  if (s.stage === 'podium' || s.stage === 'done') {
    const table = standings(s)
    return wrap(
      <>
        <Neon size={26} color={NIGHT.yellow} glowColor={NIGHT.yellow}>LANE CLOSED</Neon>
        <div className="grid gap-1.5">
          {table.map((row) => {
            const w = who(row.id)
            return (
              <div key={row.id} className="flex items-center gap-2 rounded-xl px-2 py-1" style={{ background: row.id === me ? `${w.tint}33` : 'rgba(255,255,255,0.05)' }}>
                <span className="w-10 font-party text-[20px] leading-none" style={{ color: placeColor(row.place) }}>{ordinal(row.place)}</span>
                <Portrait char={w.char} name={w.name} size={30} />
                <span className="min-w-0 flex-1 truncate font-party text-[19px] leading-none">{row.id === me ? 'You' : w.name}</span>
                <span className="font-party text-[22px] leading-none tabular" style={{ color: NIGHT.yellow }}>{row.score}</span>
              </div>
            )
          })}
        </div>
      </>,
    )
  }

  // On the bowler's own phone the pad below already shows the lane while they aim.
  const mine = me === s.bowler && s.stage === 'aim'
  const bowler = who(s.bowler)
  const left = Math.max(0, s.endsAt - t)
  const warn = s.stage === 'aim' && left <= WARN_MS
  const r = s.stage === 'result' ? s.result : null
  return wrap(
    <>
      {!mine && (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2">
              <span className="rounded-full" style={{ boxShadow: `0 0 0 3px ${bowler.tint}, 0 0 10px ${bowler.tint}` }}><Portrait char={bowler.char} name={bowler.name} size={30} /></span>
              <span className="truncate font-party text-[20px] leading-none">{bowler.name}{s.stage === 'aim' ? ' is up' : ''}</span>
            </span>
            <span className="shrink-0 font-mono text-xs" style={{ color: NIGHT.text2 }}>{s.stage === 'roll' && s.roll ? `${s.roll.mph} mph` : ballLine(s)}</span>
          </div>
          <div className="relative h-[210px] overflow-hidden rounded-[16px] border-[3px]" style={{ borderColor: INK, boxShadow: `0 0 0 2px ${NIGHT.pink}66, 0 0 16px ${NIGHT.pink}44` }}>
            <LaneView s={s} room={room} now={now} className="absolute inset-0" neighbors />
            {r && (
              <div key={r.n} className={cx('pointer-events-none absolute inset-0 grid place-items-center', (r.kind === 'gutter' || r.kind === 'miss') && 'bg-[rgba(11,5,34,0.5)]')}>
                <ResultWord r={r} size={r.kind === 'count' ? 50 : 54} />
              </div>
            )}
            {warn && (
              <div className="absolute inset-x-0 bottom-2 flex justify-center">
                <span className="rounded-full border-[3px] bg-white px-3 py-0.5 font-party text-[17px]" style={{ borderColor: INK, color: NIGHT.red }}>Rolls itself in {Math.ceil(left / 1000)}</span>
              </div>
            )}
          </div>
          {r && (
            <div key={`m${r.n}`} className="gl-pop flex items-center gap-2">
              <div className="shrink-0"><Mingo size={46} mood={r.kind === 'strike' ? 'happy' : r.kind === 'gutter' ? 'sad' : 'idle'} /></div>
              <div className="min-w-0 rounded-2xl border-[3px] bg-white px-3 py-1.5 font-party text-[15px] leading-tight" style={{ borderColor: INK, color: INK }}>{mingoLine(r, !!s.roll?.auto)}</div>
            </div>
          )}
        </>
      )}
      <Scoreboard s={s} players={room.players} size="compact" />
    </>,
  )
}
