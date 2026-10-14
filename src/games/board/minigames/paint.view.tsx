import { memo, useRef, useState } from 'react'
import { useTicker } from '../../../engine/context'
import { sfx } from '../../../ui/sfx'
import { INK, Mingo, critter, type Mood } from '../park/cast'
import { PARK } from '../park/ui'
import {
  paint, CELLS, CELL_H, CELL_W, COLS, PAINT_MS, cellAt, counts, endAt, paintAt, paintSpawn, painted, washNow, washX,
  type PaintState,
} from './paint'
import { FIELD, WORLD_H, WORLD_W, body, stepWalker } from './rt'
import {
  CallOut, Joystick, SvgTag, Plate, Scene, SceneFrame, Sprite, WinStar, callY, ownBodies, ownKey, secsLeft, simDraw,
  useBodySender, usePosReport, wonRound, usePoses, useStepLoop,
} from './rt.view'
import { CompactLine, PadShell, TvClock, TvShell, buzz, charOf, myRole, sideOf, useLatest, type MgPadProps, type MgViewProps } from './ui'
import type { Who } from '../view'

const WOOD = '#E9C48C'
const WOOD_DARK = '#C99A5B'

// ---------------- the boardwalk ----------------

const Water = memo(function Water() {
  return (
    <g>
      <rect x={0} y={0} width={WORLD_W} height={WORLD_H} fill={PARK.sea} />
      {[[14, 8], [60, 5], [118, 9], [30, 88], [96, 87], [146, 86]].map(([x, y], i) => (
        <path key={i} d={`M${x} ${y} q3 -1.6 6 0 t6 0`} fill="none" stroke={PARK.foam} strokeWidth={0.6} strokeLinecap="round" opacity={0.8} />
      ))}
      <rect x={FIELD.x0 - 2.2} y={FIELD.y0 - 2.2} width={FIELD.x1 - FIELD.x0 + 4.4} height={FIELD.y1 - FIELD.y0 + 4.4} rx={1.6} fill={WOOD_DARK} stroke={INK} strokeWidth={0.6} />
      {/* posts */}
      {[FIELD.x0 - 2, (FIELD.x0 + FIELD.x1) / 2, FIELD.x1 + 2].map((x, i) => (
        <g key={i}>
          <rect x={x - 1.4} y={FIELD.y1 + 2} width={2.8} height={2.6} fill="#8A5A2C" stroke={INK} strokeWidth={0.35} />
          <rect x={x - 1.4} y={FIELD.y0 - 4.6} width={2.8} height={2.6} fill="#8A5A2C" stroke={INK} strokeWidth={0.35} />
        </g>
      ))}
    </g>
  )
})

function popOf(at: number, t: number, owner: number): number {
  const age = t - at
  return owner >= 0 && age < 260 ? Math.round((0.55 + (age / 260) * 0.55) * 50) / 50 : owner >= 0 && age < 420 ? Math.round((1.1 - ((age - 260) / 160) * 0.1) * 50) / 50 : 1
}

const Plank = memo(function Plank({ i, owner, color, pop }: { i: number; owner: number; color: string | null; pop: number }) {
  const c = i % COLS
  const r = Math.floor(i / COLS)
  const x = FIELD.x0 + c * CELL_W
  const y = FIELD.y0 + r * CELL_H
  return (
    <g transform={`translate(${(x + CELL_W / 2).toFixed(2)} ${(y + CELL_H / 2).toFixed(2)})`}>
      <rect x={-CELL_W / 2 + 0.35} y={-CELL_H / 2 + 0.35} width={CELL_W - 0.7} height={CELL_H - 0.7} rx={0.8} fill={WOOD} stroke={WOOD_DARK} strokeWidth={0.3} />
      {owner < 0 && <path d={`M${-CELL_W / 2 + 1.4} ${-1} H${CELL_W / 2 - 2.4} M${-CELL_W / 2 + 2.6} ${2} H${CELL_W / 2 - 1.6}`} stroke={WOOD_DARK} strokeWidth={0.3} opacity={0.6} />}
      {owner >= 0 && color && (
        <g transform={`scale(${pop.toFixed(3)})`}>
          <rect x={-CELL_W / 2 + 0.6} y={-CELL_H / 2 + 0.6} width={CELL_W - 1.2} height={CELL_H - 1.2} rx={1.2} fill={color} stroke={INK} strokeWidth={0.35} />
          <path d={`M${-CELL_W / 2 + 1.6} ${-CELL_H / 2 + 1.7} H${CELL_W / 2 - 3}`} stroke="#FFFFFF" strokeWidth={0.7} strokeLinecap="round" opacity={0.55} />
          <circle cx={CELL_W / 2 - 2.2} cy={CELL_H / 2 - 1.2} r={0.7} fill={color} stroke={INK} strokeWidth={0.25} />
        </g>
      )}
    </g>
  )
})

function Washer({ x, rows, dir }: { x: number; rows: [number, number]; dir: 1 | -1 }) {
  const y0 = FIELD.y0 + rows[0] * CELL_H
  const y1 = FIELD.y0 + (rows[1] + 1) * CELL_H
  const mid = (y0 + y1) / 2
  return (
    <g>
      <rect x={x - 2} y={y0} width={4} height={y1 - y0} fill="#FFFFFF" opacity={0.55} />
      <path d={`M${x} ${y0 + 1} V${y1 - 1}`} stroke="#BFEFFF" strokeWidth={1.4} strokeDasharray="1.2 1" />
      <g transform={`translate(${x - dir * 7} ${mid + 9}) scale(${dir > 0 ? 1 : -1} 1)`}>
        <g transform="translate(-7.3 -22)"><Mingo size={22} mood="idle" /></g>
      </g>
    </g>
  )
}

// ---------------- TV ----------------

const SPARE_PAINT = ['#FF5D4E', '#3E7BFA', '#FFC83A', '#9B5CF6', '#FF7AA2', '#2C9C86']

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function near(a: string, b: string): boolean {
  const [r1, g1, b1] = rgb(a)
  const [r2, g2, b2] = rgb(b)
  return Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2) < 140
}

/** Paint colors per seat: the critter's color, unless it is too close to someone else's (Chomp and Zippy are both green). */
function colorsOf(s: PaintState, who: Who): (string | null)[] {
  const out: string[] = []
  for (const id of s.players) {
    let c = critter(charOf(who, id, s.players))!.color
    if (out.some((o) => near(o, c))) c = SPARE_PAINT.find((x) => !out.some((o) => near(o, x))) ?? c
    out.push(c)
  }
  return out
}

export function PaintStage({ s, run, who, now, compact }: MgViewProps<PaintState>) {
  const changed = useRef<{ cells: number[]; at: number[] }>({ cells: s.cells, at: s.cells.map(() => -1e12) })
  const snap = usePoses({
    no: run.no, ids: s.players, compact, now,
    sim: (id, tt) => { const w = paintAt(s, tt); const b = w.bodies[id]; if (!b) return null; const [x, y] = simDraw(b, s.startAt, tt, w.step); return { x, y, vx: b.vx, vy: b.vy } },
    spawn: (id) => paintSpawn(s, id),
    // When each plank last changed color (for the splat pop).
    extra: (_poses, tt) => {
      if (changed.current.cells !== s.cells) {
        const prev = changed.current.cells
        changed.current = { cells: s.cells, at: changed.current.at.map((v, i) => (prev[i] !== s.cells[i] ? tt : v)) }
      }
      return changed.current.at
    },
  })
  const t = snap?.t ?? now()
  const end = endAt(s)
  const over = t >= end
  const res = over ? paint.result(s) : null
  const colors = colorsOf(s, who)
  const changedAt = snap?.extra ?? []
  const sc = counts(s)
  const crit = snap ? s.players.map((id) => {
    const p = snap.poses[id]
    const won = wonRound(res, s, id)
    const mood: Mood = won ? 'happy' : res ? 'sad' : Math.abs(p.vx) + Math.abs(p.vy) > 10 ? 'hop' : 'idle'
    return { id, x: p.x, y: p.y, flip: p.flip, mood }
  }).sort((a, b) => a.y - b.y) : []
  const wash = washNow(s, t)
  const wx = washX(s, t)
  const total = painted(s)
  const call = over
    ? s.format === 'coop' ? (total >= CELLS ? 'ALL PAINTED' : 'WASHED OUT') : 'WET PAINT!'
    : wash && t - s.startAt - wash.from < 1500 ? 'MINGO IS WASHING' : null

  const scene = (
    <SceneFrame compact={compact}>
      <Scene>
        <Water />
        {s.cells.map((o, i) => <Plank key={i} i={i} owner={o} color={o >= 0 ? colors[o] : null} pop={popOf(changedAt[i] ?? -1e12, t, o)} />)}
        {wash && wx !== null && <Washer x={wx} rows={wash.rows} dir={wash.dir} />}
        {crit.map((c) => {
          const ch = charOf(who, c.id, s.players)
          return (
            <Sprite key={c.id} x={c.x} y={c.y} char={ch} mood={c.mood} flip={c.flip} size={compact ? 13 : 12}>
              {!compact && <SvgTag name={who(c.id).name} char={ch} y={c.y < 32 ? 5.5 : -17} />}
              {c.mood === 'happy' && <WinStar t={t} y={c.y < 32 ? -16 : -24} />}
            </Sprite>
          )
        })}
        {call && <CallOut text={call} color={call === 'MINGO IS WASHING' ? PARK.blue : PARK.coral} y={callY(crit.filter((c) => c.mood === 'happy').map((c) => c.y))} />}
      </Scene>
    </SceneFrame>
  )

  if (compact) {
    return (
      <div className="grid gap-2" data-rt-tv="paint">
        {scene}
        <CompactLine><div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          {s.players.map((id, i) => <span key={id} className="inline-flex items-center gap-1"><span className="inline-block h-3 w-4 rounded-sm border-2" style={{ background: colors[i] ?? INK, borderColor: INK }} /> {who(id).name} {sc[id]}</span>)}
          <span className="font-party text-xl">{secsLeft(s.startAt + PAINT_MS, t)}</span>
        </div></CompactLine>
      </div>
    )
  }
  return (
    <TvShell run={run} title="Wet Paint" ground="boardwalk" sea right={<TvClock endsAt={s.startAt + PAINT_MS} now={now} />}>
      <div className="flex h-full min-h-0 gap-5 px-7 pb-5 pt-3" data-rt-tv="paint">
        <div className="min-h-0 min-w-0 flex-1">{scene}</div>
        <div className="grid w-60 shrink-0 content-start gap-3">
          {s.format === 'coop' && (
            <div className="rounded-[20px] border-4 bg-white px-4 py-3" style={{ borderColor: INK, boxShadow: `0 6px 0 ${INK}`, color: INK }}>
              <div className="flex items-baseline justify-between"><span className="font-party text-3xl">{total}</span><span className="font-party text-xl" style={{ color: PARK.ink2 }}>of {CELLS}</span></div>
              <div className="mt-2 h-4 overflow-hidden rounded-full border-[3px]" style={{ borderColor: INK, background: '#F1EEF8' }}>
                <div className="h-full transition-[width] duration-200" style={{ width: `${(total / CELLS) * 100}%`, background: total >= CELLS ? PARK.good : PARK.coral }} />
              </div>
            </div>
          )}
          {[...s.players].sort((a, b) => sc[b] - sc[a]).map((id) => (
            <Plate key={id} who={who} id={id} players={s.players} hot={s.format !== 'coop' && wonRound(res, s, id)} sub={sideOf(run, id)}>
              <PlankBar n={sc[id]} color={colors[s.players.indexOf(id)] ?? INK} />
            </Plate>
          ))}
        </div>
      </div>
    </TvShell>
  )
}

function PlankBar({ n, color }: { n: number; color: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg viewBox="0 0 20 14" width={26} height={18} aria-hidden><rect x={1.5} y={1.5} width={17} height={11} rx={2.5} fill={color} stroke={INK} strokeWidth={2.4} /></svg>
      <span className="font-party text-2xl leading-none tabular" style={{ color: INK }}>{n}</span>
    </span>
  )
}

// ---------------- phone ----------------

export function PaintPad({ s, run, me, who, now, send }: MgPadProps<PaintState>) {
  useTicker(100)
  const stick = useRef<[number, number]>([0, 0])
  const me0 = useRef(body(...paintSpawn(s, me)))
  const latest = useLatest(s)
  const push = useBodySender(run.no)
  const [overlay, setOverlay] = useState<number[]>([])
  const [mePos, setMePos] = useState<[number, number]>(() => paintSpawn(s, me))
  const report = usePosReport(run, who, send)
  const lastCell = useRef(-1)
  const batch = useRef<number[]>([])
  const flushed = useRef(0)
  /** My paint the host has not echoed yet (cell -> when). */
  const mine = useRef(new Map<number, number>())
  const seat = s.players.indexOf(me)

  useStepLoop(s.startAt, now, (_k, t0) => {
    const cur = latest.current
    const b = me0.current
    const live = t0 < endAt(cur)
    stepWalker(b, live ? stick.current[0] : 0, live ? stick.current[1] : 0)
    if (live) {
      const c = cellAt(b.x, b.y)
      if (c !== lastCell.current) {
        lastCell.current = c
        if (cur.cells[c] !== seat) {
          batch.current.push(c)
          mine.current.set(c, t0)
          if (cur.cells[c] >= 0) buzz(15)
        }
      }
      if (batch.current.length && (t0 - flushed.current >= 250 || batch.current.length >= 30)) {
        send('paint', { c: batch.current.slice(0, 40) })
        batch.current = []
        flushed.current = t0
        sfx.play('tick')
      }
    }
    // Drop optimistic paint once the host has echoed it (or a second has passed).
    mine.current.forEach((at, c) => { if (cur.cells[c] === seat || t0 - at > 1200) mine.current.delete(c) })
    const pend = [...mine.current.keys()]
    setOverlay((o) => (o.length === pend.length && o.every((c, k) => c === pend[k]) ? o : pend))
    setMePos((m) => (Math.abs(m[0] - b.x) < 0.05 && Math.abs(m[1] - b.y) < 0.05 ? m : [b.x, b.y]))
    ownBodies.set(ownKey(run.no, me), { b, f: 0 })
    push(b, 0)
    report(b)
  })

  const t = now()
  const view = s.cells.map((o, i) => (overlay.includes(i) ? seat : o))
  const myN = view.filter((o) => o === seat).length
  const colors = colorsOf(s, who)
  const over = t >= endAt(s)
  const total = view.filter((o) => o >= 0).length
  const [meX, meY] = mePos
  return (
    <PadShell title="Wet Paint" sub={myRole(run, me, who) ?? 'Run over planks to paint them your color.'} endsAt={s.startAt + PAINT_MS} total={PAINT_MS} now={now}>
      <div className="grid gap-3" data-rt="paint" data-rt-planks={myN}>
        <div className="flex items-center justify-between rounded-[20px] border-4 bg-white px-4 py-2" style={{ borderColor: INK, color: INK, boxShadow: `0 6px 0 ${INK}` }}>
          <PlankBar n={myN} color={colors[seat] ?? INK} />
          <span className="font-party text-2xl" style={{ color: PARK.ink2 }}>{s.format === 'coop' ? `${total} / ${CELLS}` : over ? 'DONE' : 'PAINT'}</span>
        </div>
        {/* A mini boardwalk: where the paint is, and you. */}
        <svg viewBox={`${FIELD.x0} ${FIELD.y0} ${FIELD.x1 - FIELD.x0} ${FIELD.y1 - FIELD.y0}`} className="block w-full rounded-[14px] border-4" style={{ borderColor: INK, background: WOOD, aspectRatio: `${FIELD.x1 - FIELD.x0} / ${FIELD.y1 - FIELD.y0}` }} aria-hidden>
          {view.map((o, i) => {
            const c = i % COLS
            const r = Math.floor(i / COLS)
            return <rect key={i} x={FIELD.x0 + c * CELL_W + 0.4} y={FIELD.y0 + r * CELL_H + 0.4} width={CELL_W - 0.8} height={CELL_H - 0.8} rx={0.8} fill={o >= 0 ? colors[o] ?? WOOD : WOOD} stroke={o >= 0 ? INK : WOOD_DARK} strokeWidth={0.35} />
          })}
          <circle cx={meX} cy={meY} r={3.4} fill="#FFFFFF" stroke={INK} strokeWidth={1.1} />
          <circle cx={meX} cy={meY} r={1.4} fill={colors[seat] ?? INK} />
        </svg>
        <Joystick onStick={(v) => { stick.current = v }} disabled={over} size={280} color={colors[seat] ?? PARK.coral} label={<span className="font-party text-xl text-white" style={{ WebkitTextStroke: `1.5px ${INK}`, paintOrder: 'stroke fill' }}>RUN</span>} />
      </div>
    </PadShell>
  )
}

