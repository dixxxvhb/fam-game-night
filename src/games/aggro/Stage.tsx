import { useLayoutEffect, useRef, useState } from 'react'
import type { StageProps } from '../../engine/types'
import { useTicker } from '../../engine/context'
import { Avatar, cx } from '../../ui/kit'
import { isStar } from './geometry'
import { ROLL_SHOW_MS, type AggroState } from './logic'
import { AggroBanner, TURN_BANNER_MS, TurnBanner } from './look/Banners'
import { Die3D } from './look/Die3D'
import { FlatBoard } from './look/FlatBoard'
import { frameAt, settledAt, type Fx } from './look/moment'
import { CARD, TABLE, mix } from './look/palette'
import { Plate } from './look/Plate'
import type { Ghost } from './look/Plane'
import { Table } from './look/Table'
import { useAggroSounds } from './look/useSounds'
import { WinScene } from './look/WinScene'
import { useSelection } from './select'
import { eventText } from './text'
import { hasLanded, seatInfo, shownLog, shownMarbles, turnStatus, useFrames } from './view'

/** The TV stage is laid out at this size and scaled to fit. */
const W = 1280
const H = 660

const RULES = [
  'A 1 or a 6 brings a marble out of base.',
  'A 6 rolls again.',
  'Move one marble the whole roll, clockwise.',
  'Land on anyone and they go back to base. Aggro.',
  'Stop on a star, then hop star to star.',
  'Center: in from a star on a 1, out on a 1.',
  'Exact count into home. All four home wins.',
]
const QUICK_RULE = 'Quick: one marble starts out, a 6 can launch one.'

/** Plate corner per board arm: 0 top right, 1 bottom right, 2 bottom left, 3 top left. */
const CORNER: { left?: number; right?: number; top?: number; bottom?: number; tilt: number }[] = [
  { right: 26, top: 22, tilt: 1.5 },
  { right: 26, bottom: 22, tilt: -1.2 },
  { left: 26, bottom: 22, tilt: 1.2 },
  { left: 26, top: 22, tilt: -1.5 },
]

/** Where the die flies in from: the roller's side of the table. */
const DIE_FROM: [number, number][] = [[760, -170], [760, 190], [0, 230], [0, -230]]

/** The moment on screen, for QA drivers (data-aggro-moment). */
function momentName(fx: Fx): string {
  if (fx.win >= 0) return 'win'
  if (fx.aggro >= 0) return 'aggro'
  if (fx.moving) return 'hop'
  if (fx.home >= 0) return 'home'
  if (fx.swirl >= 0) return 'center'
  if (fx.star >= 0 || fx.zap >= 0) return 'star'
  if (fx.pop >= 0) return 'out'
  return ''
}

export function phaseStart(s: AggroState) {
  return s.endsAt - s.phaseTotal
}

/** Re-render every frame while anything on the board is moving. */
function useBoardClock(s: AggroState, now: () => number) {
  const until = Math.max(
    settledAt(s.last),
    s.rollAt ? s.rollAt + ROLL_SHOW_MS + 120 : 0,
    s.phase === 'roll' ? phaseStart(s) + TURN_BANNER_MS + 60 : 0,
    s.phase === 'move' && s.winner >= 0 ? s.endsAt : 0,
  )
  useFrames(until, now)
}

export function ghostFor(s: AggroState, i: number | undefined): Ghost | null {
  if (i === undefined || s.phase !== 'choose') return null
  const mv = s.moves[i]
  if (!mv) return null
  return { seat: s.turn, m: mv.m, from: mv.from, path: mv.path, to: mv.to, hit: mv.hit >= 0, star: isStar(mv.to) }
}

export function AggroStage(props: StageProps<AggroState>) {
  useAggroSounds(props.state, props.now)
  return props.compact ? <CompactStage {...props} /> : <TvStage {...props} />
}

function useFit() {
  const ref = useRef<HTMLDivElement>(null)
  const [k, setK] = useState(1)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const fit = () => setK(Math.min(el.clientWidth / W, el.clientHeight / H) || 1)
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, k] as const
}

function TvStage({ state: s, room, now }: StageProps<AggroState>) {
  useTicker(250)
  useBoardClock(s, now)
  const [ref, k] = useFit()
  const { colors, names } = seatInfo(s, room)
  const t = now()
  const { fx } = frameAt(s, t)
  const L = s.last
  const marbles = shownMarbles(s, t)
  const landed = hasLanded(s, t)
  const log = shownLog(s, t)
  const latest = log.at(-1)
  const nameOf = (i: number) => names[i] ?? '?'
  const shake = fx.shake * 16
  const turnColor = colors[s.turn] ?? '#fff'
  const bannerAge = s.phase === 'roll' ? t - phaseStart(s) : -1
  const bannerText = s.again ? 'ROLL AGAIN' : `${(names[s.turn] ?? '').toUpperCase()}'S ROLL`
  const winning = s.winner >= 0 && fx.win >= 900
  const showClock = s.phase === 'roll' || (s.phase === 'choose' && !s.auto)
  const firstRound = s.rolls < s.seats.length + 1
  const rule = (() => {
    const list = s.speed === 'quick' ? [QUICK_RULE, ...RULES] : RULES
    return list[Math.floor(t / 4200) % list.length]
  })()
  const rollerArm = s.arms[Math.max(0, s.rollBy)] ?? 0
  const dieAge = t - s.rollAt
  const dieSettled = s.rollAt > 0 && dieAge >= ROLL_SHOW_MS

  return (
    <div ref={ref} data-aggro-moment={momentName(fx)} className="relative h-full w-full overflow-hidden" style={{ background: `radial-gradient(ellipse 70% 75% at 50% 38%, ${TABLE.lamp}, rgba(0,0,0,0) 70%), repeating-linear-gradient(90deg, rgba(0,0,0,0) 0 158px, rgba(0,0,0,0.22) 158px 161px), linear-gradient(${TABLE.top}, ${TABLE.bottom})` }}>
      <div
        style={{ position: 'absolute', left: '50%', top: '50%', width: W, height: H, marginLeft: -W / 2, marginTop: -H / 2, transform: `scale(${k})` }}
      >
        <Table s={s} colors={colors} t={t} scale={0.62} shake={shake} turnSeat={s.phase === 'done' || s.winner >= 0 ? -1 : s.turn} />

        {s.seats.map((id, seat) => {
          const arm = s.arms[seat]
          const c = CORNER[arm]
          const hurt = L !== null && L.hit === seat && fx.aggro >= 0 && fx.aggro < 1400
          return (
            <div key={id} className="absolute" style={{ left: c.left, right: c.right, top: c.top, bottom: c.bottom, zIndex: 20, transform: shake ? `translate(${(Math.sin(t / 19) * shake * 0.4).toFixed(1)}px, 0)` : undefined }}>
              <Plate
                name={names[seat]}
                color={colors[seat]}
                row={marbles[seat]}
                hits={s.hits[seat] - (!landed && L?.seat === seat && L.hit >= 0 ? 1 : 0)}
                up={seat === s.turn && s.winner < 0}
                flinchKey={hurt ? L!.seq : 0}
                hurt={hurt}
                winner={s.winner === seat && landed}
                tilt={c.tilt}
                homeGlow={fx.home >= 0 && fx.homeSeat === seat}
              />
            </div>
          )
        })}

        {/* The die on the table, left of the board. */}
        <div className="absolute grid justify-items-center" style={{ left: 70, top: 252, width: 170, zIndex: 25 }}>
          <Die3D value={s.roll || 5} size={104} t={t} rollAt={s.rollAt} tint={colors[s.rollBy] ?? turnColor} from={DIE_FROM[rollerArm]} dim={s.phase === 'roll' || s.roll === 0} />
          <div className="mt-5 h-10">
            {s.roll > 0 && s.phase !== 'roll' && dieSettled && (
              <div key={s.rollAt} className="ag-rise rounded-full px-4 py-1 font-display text-xl" style={{ background: s.roll === 6 ? colors[s.rollBy] : CARD.paper, color: CARD.ink, boxShadow: '0 4px 0 rgba(0,0,0,0.4)' }}>
                {s.roll === 6 ? 'ROLL AGAIN' : `ROLLED ${s.roll}`}
              </div>
            )}
          </div>
        </div>

        {/* The ticket: whose turn, the clock, what just happened. */}
        <div className="absolute" style={{ right: 34, top: 238, width: 238, zIndex: 25 }}>
          <div className="rounded-2xl px-4 py-3" style={{ background: CARD.paper, color: CARD.ink, boxShadow: '0 8px 0 rgba(0,0,0,0.35)', transform: 'rotate(1deg)' }}>
            <div className="flex items-center gap-2">
              <Avatar name={names[s.turn] ?? '?'} color={turnColor} size={30} />
              <div className="min-w-0 flex-1 truncate font-party text-2xl leading-none">{names[s.turn]}</div>
            </div>
            <div className="mt-1.5 text-[17px] font-bold leading-snug" style={{ color: CARD.ink2 }}>
              {s.roll === 0 && s.phase === 'roll' ? 'Tap Roll on your phone.' : turnStatus(s, t)}
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full" style={{ background: CARD.line }}>
              {showClock && (
                <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(1, (s.endsAt - t) / s.phaseTotal)) * 100}%`, background: turnColor }} />
              )}
            </div>
            {latest && (
              <div key={latest.seq} className={cx('ag-rise mt-2.5 border-t pt-2 text-[16px] leading-snug')} style={{ borderColor: CARD.line, color: latest.hit >= 0 ? '#C0261C' : CARD.ink, fontWeight: latest.hit >= 0 ? 800 : 500 }}>
                {eventText(latest, nameOf)}
              </div>
            )}
            {firstRound && (
              <div key={rule} className="ag-rise mt-2.5 rounded-xl px-3 py-2 text-[15px] font-bold leading-snug" style={{ background: mix(CARD.paper2, '#000', 0.06), color: CARD.ink2 }}>
                {rule}
              </div>
            )}
          </div>
        </div>
      </div>

      <TurnBanner text={bannerText} color={turnColor} age={bannerAge} />
      {L && L.hit >= 0 && <AggroBanner age={fx.aggro} color={colors[L.seat]} by={names[L.seat]} victim={names[L.hit]} />}
      {winning && <WinScene s={s} colors={colors} names={names} />}
    </div>
  )
}

function CompactStage({ state: s, room, now, me }: StageProps<AggroState>) {
  useTicker(250)
  useBoardClock(s, now)
  const sel = useSelection()
  const { colors, names } = seatInfo(s, room)
  const t = now()
  const { fx } = frameAt(s, t)
  const L = s.last
  const latest = shownLog(s, t).at(-1)
  const nameOf = (i: number) => names[i] ?? '?'
  const mine = me != null && s.seats[s.turn] === me
  const ghost = mine && sel && sel.seq === s.seq ? ghostFor(s, sel.i) : null
  const turnColor = colors[s.turn] ?? '#fff'
  const bannerAge = s.phase === 'roll' ? t - phaseStart(s) : -1
  const bannerText = s.again ? 'ROLL AGAIN' : `${(names[s.turn] ?? '').toUpperCase()}'S ROLL`
  const winning = s.winner >= 0 && fx.win >= 900
  // The phone may still be scrolled down from the lobby: bring the board into view once.
  const top = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    try { top.current?.scrollIntoView({ block: 'start' }) } catch { /* old browsers */ }
  }, [])

  return (
    <div ref={top} className="grid gap-2 rounded-2xl p-2.5" style={{ background: `radial-gradient(ellipse 90% 70% at 50% 35%, ${TABLE.lamp}, rgba(0,0,0,0) 70%), linear-gradient(${TABLE.top}, ${TABLE.bottom})` }}>
      <div className="flex items-center gap-2.5">
        <Avatar name={names[s.turn] ?? '?'} color={turnColor} size={28} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate font-party text-xl" style={{ color: CARD.paper }}>{names[s.turn]}</div>
          <div className="truncate text-sm" style={{ color: CARD.paper2 }}>{turnStatus(s, t)}</div>
        </div>
        {s.roll > 0 && (
          <div style={{ width: 44, height: 44 }}>
            <Die3D value={s.roll} size={38} t={t} rollAt={s.rollAt} tint={colors[s.rollBy] ?? turnColor} dim={s.phase === 'roll'} />
          </div>
        )}
      </div>
      <FlatBoard
        s={s}
        colors={colors}
        t={t}
        ghost={ghost}
        turnSeat={s.winner >= 0 ? -1 : s.turn}
        overlay={
          <>
            <TurnBanner text={bannerText} color={turnColor} age={bannerAge} big={false} />
            {L && L.hit >= 0 && <AggroBanner age={fx.aggro} color={colors[L.seat]} by={names[L.seat]} victim={names[L.hit]} big={false} />}
            {winning && <WinScene s={s} colors={colors} names={names} compact />}
          </>
        }
      />
      {latest && (
        <div className="truncate text-sm" style={{ color: latest.hit >= 0 ? '#FF9C92' : CARD.paper2, fontWeight: latest.hit >= 0 ? 800 : 400 }}>{eventText(latest, nameOf)}</div>
      )}
    </div>
  )
}
