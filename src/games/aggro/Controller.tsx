import { useEffect, useRef, useState } from 'react'
import type { ControllerProps } from '../../engine/types'
import { useTicker } from '../../engine/context'
import { Avatar, cx } from '../../ui/kit'
import { Countdown } from '../../ui/Countdown'
import { BASE, isHome, isStar } from './geometry'
import { ROLL_SHOW_MS, bestMove, type AggroState } from './logic'
import { Die3D } from './look/Die3D'
import { FlatBoard } from './look/FlatBoard'
import { GlassMarble } from './look/Marble'
import { Skull, StarGlyph } from './look/icons'
import { AGGRO_RED, CARD, TABLE, mix } from './look/palette'
import { settledAt } from './look/moment'
import { HowItWorks } from './Rules'
import { setSelection } from './select'
import { ghostFor } from './Stage'
import { hasLanded, seatInfo, shownLog, shownMarbles, turnStatus, useFrames } from './view'
import { eventText, moveText } from './text'

const TABLE_BG = `radial-gradient(ellipse 90% 60% at 50% 30%, ${TABLE.lamp}, rgba(0,0,0,0) 70%), linear-gradient(${TABLE.top}, ${TABLE.bottom})`

/** Wrapper carries the state version, so QA drivers can tell a stale screen from a live one. */
export function AggroController(props: ControllerProps<AggroState>) {
  const s = props.state
  return (
    <div data-aggro-seq={s.seq} data-aggro-phase={s.phase} data-aggro-turn={s.seats[s.turn]} style={{ background: TABLE_BG, minHeight: '100%' }}>
      <ControllerBody {...props} />
    </div>
  )
}

/** Shake to roll where the phone allows motion without a permission prompt (tap always works). */
function useShake(on: boolean, fire: () => void) {
  const fireRef = useRef(fire)
  fireRef.current = fire
  useEffect(() => {
    if (!on || typeof window === 'undefined' || !('DeviceMotionEvent' in window)) return
    const DM = window.DeviceMotionEvent as unknown as { requestPermission?: unknown }
    if (typeof DM.requestPermission === 'function') return
    let last = 0
    const onMotion = (e: DeviceMotionEvent) => {
      const a = e.acceleration ?? e.accelerationIncludingGravity
      if (!a) return
      const mag = Math.hypot(a.x ?? 0, a.y ?? 0, a.z ?? 0)
      const limit = e.acceleration ? 18 : 28
      const t = performance.now()
      if (mag > limit && t - last > 1500) {
        last = t
        fireRef.current()
      }
    }
    window.addEventListener('devicemotion', onMotion)
    return () => window.removeEventListener('devicemotion', onMotion)
  }, [on])
}

/** Your four marbles as glass: in base (dim, in a ring), out on the board, home (glowing). */
function MarbleStrip({ row, color, name, rules, onRules }: { row: number[]; color: string; name: string; rules: boolean; onRules: () => void }) {
  const home = row.filter(isHome).length
  const base = row.filter((p) => p === BASE).length
  return (
    <div className="flex items-center gap-2.5 rounded-2xl px-3 py-2" style={{ background: CARD.paper, color: CARD.ink, boxShadow: '0 5px 0 rgba(0,0,0,0.35)' }} aria-label={`${name}: ${home} home, ${4 - home - base} out, ${base} in base`}>
      <div className="flex items-center gap-1">
        {row.map((p, m) => (
          <div key={m} className="grid place-items-center rounded-full" style={{ width: 32, height: 32, background: isHome(p) ? mix(color, '#fff', 0.6) : p === BASE ? 'radial-gradient(circle at 50% 40%, #120804, #3A1E0C)' : 'transparent' }}>
            <GlassMarble color={color} size={p === BASE ? 24 : 28} swirl={m * 90} dim={p === BASE} />
          </div>
        ))}
      </div>
      <div className="min-w-0 flex-1 whitespace-nowrap text-[13px] font-bold leading-tight" style={{ color: CARD.ink2 }}>
        <div className="font-party text-[19px] leading-none" style={{ color: CARD.ink }}>{home}<span className="text-sm" style={{ color: CARD.ink2 }}>/4 home</span></div>
        <div>{4 - home - base} out, {base} base</div>
      </div>
      <button
        type="button"
        onClick={onRules}
        aria-expanded={rules}
        className="no-select min-h-11 rounded-xl px-3 font-party text-lg active:scale-95"
        style={{ background: rules ? CARD.ink : 'transparent', color: rules ? CARD.paper : CARD.ink, border: `3px solid ${CARD.ink}` }}
      >
        {rules ? 'Close' : 'Rules'}
      </button>
    </div>
  )
}

function ControllerBody({ state: s, room, me, now, send }: ControllerProps<AggroState>) {
  useTicker(250)
  const [rules, setRules] = useState(false)
  const [pick, setPick] = useState<{ seq: number; i: number } | null>(null)
  // Instant feedback after a tap: the button holds until the host answers (or 2.5s, to allow a retry).
  const [sent, setSent] = useState<number | null>(null)
  const waiting = sent === s.seq
  const act = (type: 'roll' | 'move', payload: Record<string, number> = {}) => {
    if (waiting) return
    setSent(s.seq)
    send(type, { ...payload, seq: s.seq })
  }
  useEffect(() => {
    if (sent === null) return
    const id = setTimeout(() => setSent(null), 2500)
    return () => clearTimeout(id)
  }, [sent])
  const seat = s.seats.indexOf(me)
  const apart = room.mode === 'apart'
  const myTurn = seat >= 0 && s.turn === seat && s.phase !== 'done'
  const choosing = myTurn && s.phase === 'choose' && s.moves.length > 0
  const best = choosing ? bestMove(s.moves) : -1
  const chosen = choosing ? (pick && pick.seq === s.seq && pick.i < s.moves.length ? pick.i : best) : -1
  const canRoll = myTurn && s.phase === 'roll' && !rules
  useShake(canRoll && !waiting, () => act('roll'))

  // Animate the die and the board while something moves.
  useFrames(Math.max(settledAt(s.last), s.rollAt ? s.rollAt + ROLL_SHOW_MS + 100 : 0, waiting && s.phase === 'roll' ? now() + 2600 : 0), now)

  useEffect(() => {
    setSelection(chosen >= 0 ? { seq: s.seq, i: chosen } : null)
  }, [chosen, s.seq])
  useEffect(() => () => setSelection(null), [])

  if (seat < 0) return <div className="p-6 text-center text-ink-2">You're in the next game. Watch the screen.</div>

  const { colors, names } = seatInfo(s, room)
  const nameOf = (k: number) => names[k] ?? '?'
  const color = colors[seat]
  const t = now()
  const latest = shownLog(s, t).at(-1)

  if (s.phase === 'done') {
    const won = s.winner === seat
    return (
      <div className="grid gap-3 p-6 text-center ag-rise">
        <div className="font-display text-4xl" style={{ color: won ? colors[seat] : CARD.paper }}>{won ? 'ALL FOUR HOME' : `${(names[s.winner] ?? 'Someone').toUpperCase()} GOT THERE`}</div>
        <div className="text-lg" style={{ color: CARD.paper2 }}>Adding it up.</div>
      </div>
    )
  }

  const myRow = shownMarbles(s, t)[seat]
  const strip = <MarbleStrip row={myRow} color={color} name={names[seat]} rules={rules} onRules={() => setRules((v) => !v)} />

  if (rules) {
    return (
      <div className="grid gap-3 p-4">
        {strip}
        {myTurn && <div className="rounded-xl px-4 py-2 font-bold" style={{ background: AGGRO_RED, color: '#fff' }}>It's your turn. The clock is running.</div>}
        <HowItWorks speed={s.speed} />
        <button type="button" onClick={() => setRules(false)} className="no-select min-h-14 rounded-2xl font-party text-2xl active:scale-[0.98]" style={{ background: CARD.paper, color: CARD.ink, boxShadow: '0 6px 0 rgba(0,0,0,0.4)' }}>
          Back to the game
        </button>
      </div>
    )
  }

  const die = (size: number) => <Die3D value={s.roll} size={size} t={t} rollAt={s.rollAt} tint={colors[s.rollBy] ?? color} from={[0, -size * 1.5]} />
  const meHit = latest && latest.hit === seat

  // ---------------- not my turn ----------------
  if (!myTurn) {
    return (
      <div className="grid gap-4 p-4">
        {strip}
        {apart ? (
          s.rolls < s.seats.length && <HowItWorks speed={s.speed} />
        ) : (
          <>
            <div className="flex items-center gap-4 rounded-2xl px-4 py-3" style={{ background: mix(colors[s.turn] ?? '#888', '#000', 0.55), boxShadow: `0 0 0 3px ${colors[s.turn]}` }}>
              <Avatar name={names[s.turn]} color={colors[s.turn]} size={44} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-party text-2xl leading-tight text-white">{names[s.turn]}'s turn</div>
                <div className="text-white/75">{turnStatus(s, t)}</div>
              </div>
              {s.roll > 0 && s.rollBy === s.turn && <div style={{ width: 58, height: 58 }}>{die(52)}</div>}
            </div>
            {latest && (
              <div className={cx('rounded-xl px-3 py-2 text-center text-lg leading-snug', meHit ? 'font-display text-2xl' : latest.hit >= 0 ? 'font-bold' : '')} style={{ background: meHit ? AGGRO_RED : 'rgba(0,0,0,0.25)', color: meHit ? '#fff' : CARD.paper }}>
                {meHit ? `${names[latest.seat]} AGGRO'D YOU` : eventText(latest, nameOf)}
              </div>
            )}
            <FlatBoard s={s} colors={colors} t={t} turnSeat={s.turn} />
          </>
        )}
      </div>
    )
  }

  // ---------------- my turn: roll ----------------
  if (s.phase === 'roll') {
    const size = apart ? 84 : 140
    return (
      <div className="grid gap-4 p-4">
        {strip}
        <Countdown endsAt={s.endsAt} total={s.phaseTotal} now={now} />
        <div className="text-center font-display text-3xl" style={{ color: s.again ? color : CARD.paper }}>{s.again ? 'ROLL AGAIN' : 'YOUR ROLL'}</div>
        <button
          type="button"
          aria-label="Roll the die"
          disabled={waiting}
          onClick={() => act('roll')}
          className={cx('no-select relative flex flex-col items-center justify-center gap-4 overflow-hidden rounded-[32px] active:scale-[0.98]', apart ? 'min-h-44 py-4' : 'min-h-80 py-6')}
          style={{
            background: `radial-gradient(ellipse at 50% 35%, ${mix('#2E6B45', '#fff', 0.08)}, #163A25)`,
            boxShadow: `inset 0 0 0 8px ${mix('#6A3C1A', '#000', 0.1)}, inset 0 0 0 11px #3E200C, inset 0 18px 30px rgba(0,0,0,0.45), 0 0 0 4px ${color}, 0 10px 0 rgba(0,0,0,0.45)`,
          }}
        >
          <div className={waiting ? undefined : 'ag-tap-hint'} style={{ width: size, height: size }}>
            <Die3D value={s.roll || 5} size={size} t={t} rollAt={0} tint={color} spinning={waiting} />
          </div>
          <div className="font-display text-2xl" style={{ color: CARD.paper }}>{waiting ? 'ROLLING' : 'TAP TO ROLL'}</div>
        </button>
        <div className="text-center text-sm" style={{ color: CARD.paper2 }}>Tap the die, or give your phone a shake. It rolls itself when the bar runs out.</div>
      </div>
    )
  }

  // ---------------- my turn: moving ----------------
  if (s.phase === 'move') {
    const hit = hasLanded(s, t) && s.last && s.last.hit >= 0
    return (
      <div className="grid gap-4 p-4">
        {strip}
        <div className="flex items-center gap-4 rounded-2xl px-4 py-3" style={{ background: hit ? AGGRO_RED : 'rgba(0,0,0,0.3)', color: '#fff' }}>
          <div style={{ width: 58, height: 58 }}>{die(52)}</div>
          <div className={cx('min-w-0 flex-1 leading-snug', hit ? 'font-display text-2xl' : 'text-lg')}>
            {!hasLanded(s, t) && s.last ? `Moving marble ${s.last.m + 1}.` : hit ? `AGGRO! ${names[s.last!.hit]} goes back to base.` : latest ? eventText(latest, nameOf) : 'Moving.'}
          </div>
        </div>
        {!apart && <FlatBoard s={s} colors={colors} t={t} />}
      </div>
    )
  }

  // ---------------- my turn: choose ----------------
  const settled = t - s.rollAt >= ROLL_SHOW_MS
  const header = (
    <div className="flex items-center gap-4">
      <div style={{ width: 66, height: 66 }}>{die(60)}</div>
      <div className="min-w-0 flex-1">
        <div className="font-display text-2xl leading-tight" style={{ color: CARD.paper }}>{settled ? `YOU ROLLED ${s.roll}` : 'ROLLING'}</div>
        {s.moves.length > 0 && !s.auto ? (
          <Countdown endsAt={s.endsAt} total={s.phaseTotal} now={now} className="mt-1.5" />
        ) : (
          <div style={{ color: CARD.paper2 }}>
            {!s.moves.length ? (s.extra ? 'No moves. The 6 still gets you another roll.' : 'No moves. Turn passes.') : 'One way to go. Moving it.'}
          </div>
        )}
      </div>
    </div>
  )

  if (!s.moves.length) {
    return (
      <div className="grid gap-4 p-4">
        {strip}
        {header}
        {!apart && <FlatBoard s={s} colors={colors} t={t} />}
      </div>
    )
  }

  const mv = s.moves[chosen]
  const ghost = ghostFor(s, chosen)
  const movable = [...new Set(s.moves.map((m) => m.m))]
  const pickMarble = (m: number) => {
    // Tap a marble: its first move, or the next of its moves if it is already picked.
    const mine = s.moves.map((x, i) => ({ x, i })).filter((o) => o.x.m === m)
    if (!mine.length) return
    const at = mine.findIndex((o) => o.i === chosen)
    setPick({ seq: s.seq, i: mine[(at + 1) % mine.length].i })
  }
  const chosenText = mv ? moveText(mv, s, nameOf) : null
  const twoCol = s.moves.length >= 2

  return (
    <div className={cx('grid gap-3 px-4 pt-4', s.auto ? 'pb-4' : 'pb-0')}>
      {apart ? (
        <>
          <div className="font-display text-xl" style={{ color: CARD.paper }}>{s.auto ? 'ONE WAY TO GO' : `YOU ROLLED ${s.roll}. PICK A MOVE.`}</div>
          {!s.auto && <Countdown endsAt={s.endsAt} total={s.phaseTotal} now={now} />}
        </>
      ) : (
        <>
          {header}
          <FlatBoard
            s={s}
            colors={colors}
            t={t}
            ghost={ghost}
            pickable={s.auto ? null : { seat, marbles: movable, chosen: mv?.m ?? -1, onPick: pickMarble }}
            className={s.moves.length > 4 ? 'mx-auto max-w-[300px]' : undefined}
          />
        </>
      )}
      <div className={cx('grid gap-2', twoCol && 'grid-cols-2')} role="radiogroup" aria-label="Your moves">
        {s.moves.map((m, i) => {
          const tx = moveText(m, s, nameOf)
          const on = i === chosen
          const hit = m.hit >= 0
          return (
            <button
              key={`${s.seq}-${i}`}
              type="button"
              role="radio"
              aria-checked={on}
              data-move={i}
              disabled={s.auto}
              onClick={() => setPick({ seq: s.seq, i })}
              className="no-select flex min-h-14 items-center gap-2 rounded-2xl px-2.5 py-1.5 text-left active:scale-[0.98] disabled:active:scale-100"
              style={{
                background: on ? (hit ? mix(AGGRO_RED, CARD.paper, 0.75) : CARD.paper) : 'rgba(246,234,210,0.14)',
                color: on ? CARD.ink : CARD.paper,
                boxShadow: on ? `0 0 0 3px ${hit ? AGGRO_RED : color}, 0 4px 0 rgba(0,0,0,0.4)` : 'inset 0 0 0 2px rgba(246,234,210,0.25)',
              }}
            >
              <span className="relative shrink-0">
                <GlassMarble color={color} size={30} swirl={m.m * 90} />
                <span className="absolute inset-0 grid place-items-center font-display text-[13px] text-white" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>{m.m + 1}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 font-party text-lg leading-tight">
                  {tx.title}
                  {hit && <Skull size={16} color={on ? AGGRO_RED : '#FF8A80'} bg={on ? CARD.paper : '#000'} />}
                  {!hit && isStar(m.to) && <StarGlyph size={16} />}
                </span>
                <span className={cx('block text-[13px] font-bold leading-snug')} style={{ color: hit ? (on ? '#B0201A' : '#FF9C92') : on ? CARD.ink2 : 'rgba(246,234,210,0.8)' }}>{tx.detail}</span>
              </span>
            </button>
          )
        })}
      </div>
      {!s.auto && mv && (
        <div className="sticky bottom-0 -mx-4 px-4 pb-3 pt-2 safe-bottom" style={{ background: `linear-gradient(rgba(20,11,6,0), ${TABLE.bottom} 30%)` }}>
          <button
            type="button"
            disabled={waiting}
            onClick={() => act('move', { i: chosen })}
            className="no-select flex min-h-16 w-full items-center gap-3 rounded-2xl px-4 py-2 text-left active:scale-[0.98] disabled:opacity-70"
            style={{
              background: mv.hit >= 0 ? AGGRO_RED : color,
              color: mv.hit >= 0 ? '#fff' : CARD.ink,
              boxShadow: `0 6px 0 ${mix(mv.hit >= 0 ? AGGRO_RED : color, '#000', 0.5)}, 0 0 0 3px ${CARD.ink}`,
            }}
          >
            {mv.hit >= 0 && <Skull size={34} color="#fff" bg={AGGRO_RED} />}
            <span className="grid min-w-0 flex-1 leading-tight">
              <span className="font-display text-2xl">{waiting ? 'Moving' : `Move marble ${mv.m + 1}`}</span>
              {chosenText && <span className="truncate text-sm font-bold opacity-85">{mv.hit >= 0 ? `Aggro ${names[mv.hit]}` : chosenText.detail}</span>}
            </span>
          </button>
        </div>
      )}
    </div>
  )
}
