import { useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { useTicker } from '../../../engine/context'
import { sfx } from '../../../ui/sfx'
import { INK, type Mood } from '../park/cast'
import { PARK } from '../park/ui'
import {
  coconut, COCO_MS, DROP_GAP_MS, FALL_MS, INVULN_MS, bonks, cocoAt, cocoSpawn, dodgers, endAt, livesLeft, nutsOf, outAt,
  type CocoHit, type CocoState, type Nut,
} from './coconut'
import { BODY_R, WORLD_H, WORLD_W, body, stepWalker, STEP } from './rt'
import {
  Burst, CallOut, Joystick, SvgTag, Plate, Scene, SceneFrame, Sprite, WinStar, callY, ownBodies, ownKey, secsLeft, simDraw,
  useBodySender, usePosReport, usePoses, useRemoteAim, useStepLoop,
} from './rt.view'
import { CompactLine, PadShell, TvClock, TvShell, buzz, charOf, myRole, useLatest, type MgPadProps, type MgViewProps } from './ui'

const PALM: [number, number] = [WORLD_W / 2 - 8, 9]

// ---------------- the beach ----------------

function Beach({ compact }: { compact: boolean }) {
  return (
    <g>
      <defs>
        <linearGradient id="cd-sand" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFE9B8" />
          <stop offset="1" stopColor="#FFD58A" />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={WORLD_W} height={WORLD_H} fill="url(#cd-sand)" />
      {/* the sea along the top */}
      <path d={`M0 0 H${WORLD_W} V7 Q${WORLD_W * 0.875} 10 ${WORLD_W * 0.75} 7 T${WORLD_W / 2} 7 T${WORLD_W / 4} 7 T0 7 Z`} fill={PARK.sea} />
      <path d={`M0 7 Q${WORLD_W * 0.125} 10 ${WORLD_W / 4} 7 T${WORLD_W / 2} 7 T${WORLD_W * 0.75} 7 T${WORLD_W} 7`} fill="none" stroke={PARK.foam} strokeWidth={1.2} className="cd-wave" />
      <path d={`M0 0 H${WORLD_W} V3.2 H0 Z`} fill={PARK.seaDeep} opacity={0.5} />
      {!compact && (
        <g opacity={0.95}>
          {/* towels */}
          <g transform="translate(14 70) rotate(-12)">
            <rect x={-8} y={-5} width={16} height={10} rx={1.2} fill="#FF7AA2" stroke={INK} strokeWidth={0.45} />
            <rect x={-8} y={-1.4} width={16} height={2.8} fill="#FFFFFF" />
          </g>
          <g transform="translate(146 74) rotate(9)">
            <rect x={-8} y={-5} width={16} height={10} rx={1.2} fill={PARK.blue} stroke={INK} strokeWidth={0.45} />
            <rect x={-3} y={-5} width={2.6} height={10} fill={PARK.sun} />
          </g>
          {/* a sandcastle that has seen better days */}
          <g transform="translate(130 28)">
            <rect x={-5} y={-3} width={10} height={6} fill={PARK.sandDark} stroke={INK} strokeWidth={0.45} />
            <rect x={-2} y={-7} width={4} height={4} fill={PARK.sandDark} stroke={INK} strokeWidth={0.45} />
            <path d="M0 -7 V-10.5 L2.6 -9.4 L0 -8.4" fill={PARK.coral} stroke={INK} strokeWidth={0.35} />
          </g>
          {/* shells */}
          {[[30, 30], [62, 80], [104, 60], [44, 52], [120, 84]].map(([x, y], i) => (
            <path key={i} d={`M${x - 1.4} ${y} Q${x} ${y - 2.4} ${x + 1.4} ${y} Z`} fill="#FFFFFF" stroke={INK} strokeWidth={0.3} />
          ))}
        </g>
      )}
      <style>{`
        @keyframes cd-wave { 0%,100% { transform: translateX(0) } 50% { transform: translateX(-3px) } }
        .cd-wave { animation: cd-wave 3.2s ease-in-out infinite; }
      `}</style>
    </g>
  )
}

/** The palm the 1 vs 2 solo throws from. */
function Palm() {
  return (
    <g transform={`translate(${PALM[0]} ${PALM[1]})`}>
      <path d="M-2 14 Q-1 4 0 -2 L2 -2 Q2 6 2.6 14 Z" fill="#B4793F" stroke={INK} strokeWidth={0.45} />
      {[[-11, -1, -25], [11, -1, 25], [-8, -6, -60], [8, -6, 60], [0, -8, 0]].map(([x, y, r], i) => (
        <ellipse key={i} cx={x} cy={y} rx={8} ry={2.6} transform={`rotate(${r} ${x} ${y})`} fill={PARK.grass} stroke={INK} strokeWidth={0.45} />
      ))}
      <circle cx={-1.6} cy={0.6} r={1.5} fill="#7A4A22" stroke={INK} strokeWidth={0.35} />
      <circle cx={1.8} cy={0.9} r={1.5} fill="#7A4A22" stroke={INK} strokeWidth={0.35} />
    </g>
  )
}

function Coconut({ r }: { r: number }) {
  return (
    <g>
      <circle r={r} fill="#8A5428" stroke={INK} strokeWidth={0.5} />
      <path d={`M${-r * 0.55} ${-r * 0.35} A${r * 0.7} ${r * 0.7} 0 0 1 ${r * 0.1} ${-r * 0.72}`} fill="none" stroke="#C4874E" strokeWidth={0.6} strokeLinecap="round" />
      <circle cx={-r * 0.25} cy={r * 0.05} r={r * 0.13} fill={INK} />
      <circle cx={r * 0.22} cy={r * 0.05} r={r * 0.13} fill={INK} />
      <circle cx={0} cy={r * 0.38} r={r * 0.13} fill={INK} />
    </g>
  )
}

/** One coconut: the warning ring and growing shadow, then the drop, then a bounce and a puff. */
function NutDraw({ n, t, layer }: { n: Nut; t: number; layer: 'ground' | 'air' }) {
  const p = Math.max(0, Math.min(1, (t - n.at) / (n.land - n.at)))
  const landed = t >= n.land
  const since = t - n.land
  const hot = n.kind === 'drop' || n.kind === 'big'
  if (layer === 'ground') {
    if (landed) {
      const fade = Math.max(0, 1 - since / 650)
      const sq = since < 120 ? 1 - since / 400 : 1
      return (
        <g transform={`translate(${n.x} ${n.y})`} opacity={fade}>
          <circle r={n.r * (1 + since / 300)} fill="none" stroke="#FFFFFF" strokeWidth={0.8} opacity={Math.max(0, 1 - since / 300)} />
          <g transform={`scale(${(2 - sq).toFixed(3)} ${sq.toFixed(3)})`}><Coconut r={n.r * 0.6} /></g>
        </g>
      )
    }
    return (
      <g transform={`translate(${n.x} ${n.y})`}>
        <circle r={n.r} fill={hot ? PARK.coral : INK} opacity={0.08 + 0.16 * p} />
        <circle r={n.r} fill="none" stroke={hot ? PARK.coralDark : INK} strokeWidth={0.5} strokeDasharray="1.6 1.2" opacity={0.35 + 0.5 * p} />
        <ellipse rx={n.r * (0.25 + 0.6 * p)} ry={n.r * (0.18 + 0.42 * p)} fill={INK} opacity={0.18 + 0.3 * p} />
      </g>
    )
  }
  if (landed || p < 0.2) return null
  const h = 80 * (1 - p * p)
  return (
    <g transform={`translate(${n.x} ${(n.y - h).toFixed(2)}) rotate(${(p * 260).toFixed(0)})`}>
      <Coconut r={n.r * 0.6} />
    </g>
  )
}

// ---------------- who is where ----------------

interface Drawn { id: string; x: number; y: number; vx: number; mood: Mood; flip: boolean; out: boolean; blink: boolean }

/** Who is where this frame (sim for bots, stream for phones) plus their mood. */
function useCritters(s: CocoState, no: number, now: () => number, compact: boolean): { t: number; crit: Drawn[] } | null {
  const snap = usePoses({
    no, ids: dodgers(s), compact, now,
    sim: (id, t) => { const w = cocoAt(s, t); const b = w.bodies[id]; if (!b) return null; const [x, y] = simDraw(b, s.startAt, t, w.step); return { x, y, vx: b.vx, vy: b.vy } },
    spawn: (id) => cocoSpawn(s, id),
  })
  if (!snap) return null
  const t = snap.t
  const end = endAt(s)
  const res = t >= end ? coconut.result(s) : null
  const crit = dodgers(s).map((id): Drawn => {
    const p = snap.poses[id]
    const o = outAt(s, id)
    const isOut = o !== null && o <= t
    const hits = s.hits[id] ?? []
    const last = hits[hits.length - 1]
    const hurt = !!last && t - last.t < INVULN_MS && t >= last.t
    const moving = Math.abs(p.vx) + Math.abs(p.vy) > 10
    const won = !!res && (s.format === 'coop' ? !!res.success : res.places[id] === 1)
    const mood: Mood = isOut || (res && !won) ? 'sad' : won ? 'happy' : hurt ? 'sad' : moving ? 'hop' : 'idle'
    return { id, x: p.x, y: p.y, vx: p.vx, mood, flip: p.flip, out: isOut, blink: hurt && !isOut && Math.floor(t / 110) % 2 === 0 }
  })
  return { t, crit: crit.sort((x, y) => x.y - y.y) }
}

function Lives({ n, of, size = 18 }: { n: number; of: number; size?: number }) {
  return (
    <span className="inline-flex gap-1" aria-label={`${n} of ${of} lives`}>
      {Array.from({ length: of }, (_, i) => (
        <svg key={i} viewBox="-10 -10 20 20" width={size} height={size} aria-hidden>
          <circle r={8} fill={i < n ? '#8A5428' : '#E9E6F2'} stroke={INK} strokeWidth={2.4} />
          {i < n ? <circle cx={-2.4} cy={-1} r={1.6} fill={INK} /> : <path d="M-5 -5 L5 5 M5 -5 L-5 5" stroke={INK} strokeWidth={2.4} strokeLinecap="round" />}
        </svg>
      ))}
    </span>
  )
}

// ---------------- TV ----------------

export function CocoStage({ s, run, who, now, compact }: MgViewProps<CocoState>) {
  const snap = useCritters(s, run.no, now, compact)
  const solo = s.format === '1v2' ? s.solo : null
  const streamAim = useRemoteAim(run.no, solo && !who(solo).bot ? solo : null)
  const t = snap?.t ?? now()
  const crit = snap?.crit ?? []
  const nuts = nutsOf(s).filter((n) => n.at <= t && t <= n.land + 700)
  const end = endAt(s)
  const ds = dodgers(s)
  const alive = ds.filter((id) => { const o = outAt(s, id); return o === null || o > end })
  const over = t >= end
  let aim: [number, number] | null = null
  if (solo && !over) {
    if (streamAim) aim = streamAim
    else if (who(solo).bot && s.drops.length) { const d = s.drops[s.drops.length - 1]; if (t - d.t < 900) aim = [d.x, d.y] }
  }
  const call = over
    ? s.format === '1v2' ? (alive.length ? 'TEAM SURVIVES' : 'ALL BONKED') : s.format === 'coop' ? (alive.length === ds.length ? 'EVERYBODY MADE IT' : 'BONKED OUT') : alive.length === 1 ? 'LAST ONE STANDING' : t >= s.startAt + COCO_MS ? 'TIME!' : 'BONKED'
    : null
  const late = !over && t > s.startAt + COCO_MS - 5000

  const scene = (
    <SceneFrame compact={compact}>
      <Scene>
        <Beach compact={compact} />
        {solo && <Palm />}
        {nuts.map((n) => <NutDraw key={n.k} n={n} t={t} layer="ground" />)}
        {aim && (
          <g transform={`translate(${aim[0]} ${aim[1]})`} opacity={0.9}>
            <circle r={7} fill="none" stroke={PARK.coralDark} strokeWidth={0.8} />
            <path d="M-10 0 H-4 M4 0 H10 M0 -10 V-4 M0 4 V10" stroke={PARK.coralDark} strokeWidth={0.8} strokeLinecap="round" />
          </g>
        )}
        {crit.map((c) => (
          <Sprite key={c.id} x={c.x} y={c.y} char={charOf(who, c.id, s.players)} mood={c.mood} flip={c.flip} alpha={c.out ? 0.55 : c.blink ? 0.35 : 1} lie={c.out} size={compact ? 14 : 13}>
            {!compact && <SvgTag name={who(c.id).name} char={charOf(who, c.id, s.players)} y={c.out ? -8 : c.y < 32 ? 5.5 : -18} />}
            {c.mood === 'happy' && <WinStar t={t} y={c.y < 32 ? -17 : -25} />}
          </Sprite>
        ))}
        {solo && (
          <Sprite x={PALM[0] + 13} y={PALM[1] + 15} char={charOf(who, solo, s.players)} mood={over ? (alive.length ? 'sad' : 'happy') : 'hop'} size={12}>
            {!compact && <SvgTag name={who(solo).name} char={charOf(who, solo, s.players)} y={5} />}
            {over && !alive.length && <WinStar t={t} y={-17} />}
          </Sprite>
        )}
        {nuts.map((n) => <NutDraw key={`a${n.k}`} n={n} t={t} layer="air" />)}
        {crit.map((c) => {
          const last = (s.hits[c.id] ?? []).at(-1)
          if (!last || t - last.t > 650 || t < last.t) return null
          const up = (t - last.t) / 650
          return <g key={`b${c.id}`} transform={`translate(${c.x} ${c.y - 20 - up * 4}) scale(${(0.7 + Math.min(1, up * 4) * 0.4).toFixed(2)})`} opacity={1 - up * 0.6}><Burst text="BONK!" size={4.2} /></g>
        })}
        {call && <CallOut text={call} y={callY(crit.filter((c) => !c.out).map((c) => c.y))} />}
        {late && !compact && (
          <text x={WORLD_W / 2} y={WORLD_H - 4} textAnchor="middle" fontSize={5} className="font-party" fill={PARK.coralDark} stroke="#FFFFFF" strokeWidth={0.6} paintOrder="stroke">COCONUT SEASON</text>
        )}
      </Scene>
    </SceneFrame>
  )

  if (compact) {
    return (
      <div className="grid gap-2" data-rt-tv="coconut">
        {scene}
        <CompactLine><div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          {ds.map((id) => <span key={id} className="inline-flex items-center gap-1">{who(id).name} <Lives n={livesLeft(s, id, Math.min(t, end))} of={s.lives[id]} size={14} /></span>)}
          <span className="font-party text-xl">{secsLeft(s.startAt + COCO_MS, t)}</span>
        </div></CompactLine>
      </div>
    )
  }
  return (
    <TvShell run={run} title="Coconut Drop" ground="sand" sea right={<TvClock endsAt={s.startAt + COCO_MS} now={now} />}>
      <div className="flex h-full min-h-0 gap-5 px-7 pb-5 pt-3" data-rt-tv="coconut">
        <div className="min-h-0 min-w-0 flex-1">{scene}</div>
        <div className="grid w-60 shrink-0 content-start gap-3">
          {solo && <Plate who={who} id={solo} players={s.players} sub="In the palm tree" hot={over && !alive.length}><span className="font-party text-xl">{ds.reduce((a, id) => a + (s.hits[id] ?? []).filter((h) => h.t <= Math.min(t, end)).length, 0)} bonks</span></Plate>}
          {ds.map((id) => {
            const isOut = outAt(s, id) !== null && outAt(s, id)! <= t
            return (
              <Plate key={id} who={who} id={id} players={s.players} dim={isOut} hot={over && !isOut} sub={isOut ? 'Bonked out' : undefined}>
                <Lives n={livesLeft(s, id, Math.min(t, end))} of={s.lives[id]} size={22} />
              </Plate>
            )
          })}
        </div>
      </div>
    </TvShell>
  )
}

// ---------------- phones ----------------

export function CocoPad(props: MgPadProps<CocoState>) {
  if (props.s.format === '1v2' && props.me === props.s.solo) return <DropPad {...props} />
  return <DodgePad {...props} />
}

function DodgePad({ s, run, me, who, now, send }: MgPadProps<CocoState>) {
  useTicker(100)
  const stick = useRef<[number, number]>([0, 0])
  const [sx, sy] = cocoSpawn(s, me)
  const me0 = useRef(body(sx, sy))
  const lives = s.lives[me] ?? 0
  const hits = useRef<CocoHit[]>([...(s.hits[me] ?? [])])
  const latest = useLatest(s)
  const push = useBodySender(run.no)
  const report = usePosReport(run, who, send)
  const [flash, setFlash] = useState(0)
  const [left, setLeft] = useState(Math.max(0, lives - (s.hits[me] ?? []).length))

  useStepLoop(s.startAt, now, (_k, t0) => {
    const cur = latest.current
    const b = me0.current
    const end = endAt(cur)
    const dead = hits.current.length >= lives
    const live = !dead && t0 < end
    stepWalker(b, live ? stick.current[0] : 0, live ? stick.current[1] : 0)
    if (live) {
      for (const n of nutsOf(cur)) {
        if (n.land <= t0 || n.land > t0 + STEP) continue
        if (bonks(n, b.x, b.y, hits.current, lives)) {
          hits.current.push({ k: n.k, t: n.land })
          send('hit', { k: n.k })
          buzz(hits.current.length >= lives ? [80, 60, 200] : 140)
          sfx.play('bad')
          setFlash(n.land)
          setLeft(Math.max(0, lives - hits.current.length))
        }
      }
    }
    const last = hits.current[hits.current.length - 1]
    const f = (hits.current.length >= lives ? 1 : 0) | (last && t0 - last.t < INVULN_MS ? 2 : 0)
    ownBodies.set(ownKey(run.no, me), { b, f })
    push(b, f)
    report(b)
  })

  const t = now()
  const out = left === 0
  const over = t >= endAt(s)
  const hurt = flash && t - flash < 700
  return (
    <PadShell title="Coconut Drop" sub={myRole(run, me, who) ?? 'Watch the shadows on the TV. Run.'} endsAt={s.startAt + COCO_MS} total={COCO_MS} now={now}>
      <div className="grid gap-4" data-rt="coconut" data-rt-lives={left}>
        <div className="flex items-center justify-between rounded-[20px] border-4 bg-white px-4 py-3" style={{ borderColor: INK, color: INK, boxShadow: `0 6px 0 ${INK}` }}>
          <Lives n={left} of={lives} size={34} />
          <span className="font-party text-3xl" style={{ color: hurt ? PARK.coral : INK }}>
            {out ? 'OUT' : over ? 'SAFE' : hurt ? 'BONK!' : `${left} ${left === 1 ? 'life' : 'lives'}`}
          </span>
        </div>
        <Joystick onStick={(v) => { stick.current = v }} disabled={out || over} size={320} label={<span className="font-party text-2xl text-white" style={{ WebkitTextStroke: `1.5px ${INK}`, paintOrder: 'stroke fill' }}>RUN</span>} />
        <div className="text-center text-lg font-bold" style={{ color: PARK.ink2 }}>
          {out ? 'Bonked out. You can watch the carnage now.' : 'Hold the stick toward where you want to run. Watch the TV.'}
        </div>
      </div>
    </PadShell>
  )
}

function DropPad({ s, run, who, now, send }: MgPadProps<CocoState>) {
  const map = useRef<SVGSVGElement>(null)
  const [aim, setAimState] = useState<[number, number] | null>(null)
  const aimRef = useRef<[number, number] | null>(null)
  const [held, setHeld] = useState(false)
  const [lastSent, setLastSent] = useState(-Infinity)
  const push = useBodySender(run.no)
  const ds = dodgers(s)
  const snap = usePoses({
    no: run.no, ids: ds, compact: false, now,
    sim: (id, t) => cocoAt(s, t).bodies[id] ?? null,
    spawn: (id) => cocoSpawn(s, id),
  })
  const t = snap?.t ?? now()
  const lastDrop = s.drops[s.drops.length - 1]
  const reload = Math.max(0, DROP_GAP_MS - (t - Math.max(lastDrop?.t ?? -Infinity, lastSent)))
  const over = t >= endAt(s) || t > s.startAt + COCO_MS - FALL_MS

  function toWorld(e: RPointerEvent<SVGSVGElement>): [number, number] {
    const r = map.current!.getBoundingClientRect()
    // The SVG letterboxes (meet); work out the drawn box.
    const scale = Math.min(r.width / WORLD_W, r.height / WORLD_H)
    const ox = r.left + (r.width - WORLD_W * scale) / 2
    const oy = r.top + (r.height - WORLD_H * scale) / 2
    return [Math.max(0, Math.min(WORLD_W, (e.clientX - ox) / scale)), Math.max(0, Math.min(WORLD_H, (e.clientY - oy) / scale))]
  }
  function setAim(p: [number, number] | null) {
    aimRef.current = p
    setAimState(p)
    push({ x: PALM[0], y: PALM[1], vx: 0, vy: 0 }, 0, p, true)
  }
  function fire() {
    const p = aimRef.current
    const tt = now()
    const ld = s.drops[s.drops.length - 1]
    if (!p || over || tt - Math.max(ld?.t ?? -Infinity, lastSent) < DROP_GAP_MS) return
    setLastSent(tt)
    send('drop', { x: Math.round(p[0] * 10) / 10, y: Math.round(p[1] * 10) / 10 })
    buzz(40)
    sfx.play('whoosh')
  }

  const nuts = nutsOf(s).filter((n) => n.at <= t && t <= n.land + 300)
  const bonked = ds.reduce((a, id) => a + (s.hits[id] ?? []).length, 0)
  return (
    <PadShell title="Coconut Drop" sub="You are in the palm. Tap the beach to throw. Bonk them both out." endsAt={s.startAt + COCO_MS} total={COCO_MS} now={now}>
      <div className="grid gap-4" data-rt="coconut-drop">
        <div className="flex items-center justify-between rounded-[20px] border-4 bg-white px-4 py-3" style={{ borderColor: INK, color: INK, boxShadow: `0 6px 0 ${INK}` }}>
          <span className="font-party text-3xl">{bonked} / {ds.reduce((a, id) => a + s.lives[id], 0)} bonks</span>
          <span className="font-party text-2xl" style={{ color: reload > 0 ? PARK.ink3 : PARK.good }}>{over ? 'Done' : reload > 0 ? 'Reloading' : 'Ready'}</span>
        </div>
        <div className="overflow-hidden rounded-[20px] border-4" style={{ borderColor: INK, boxShadow: `0 6px 0 ${INK}` }}>
          <svg
            ref={map}
            data-drop-map
            viewBox={`0 0 ${WORLD_W} ${WORLD_H}`}
            className="touch-none-all no-select block w-full"
            style={{ aspectRatio: `${WORLD_W} / ${WORLD_H}`, background: '#FFE3A6' }}
            onPointerDown={(e) => { e.preventDefault(); map.current?.setPointerCapture(e.pointerId); setHeld(true); setAim(toWorld(e)) }}
            onPointerMove={(e) => { if (held) setAim(toWorld(e)) }}
            onPointerUp={(e) => { setAim(toWorld(e)); fire(); setHeld(false) }}
            onPointerCancel={() => { setHeld(false) }}
          >
            <Beach compact />
            {nuts.map((n) => <NutDraw key={n.k} n={n} t={t} layer="ground" />)}
            {ds.map((id) => {
              const p = snap?.poses[id]
              if (!p) return null
              return (
                <g key={id} transform={`translate(${p.x} ${p.y})`}>
                  <circle r={BODY_R + 1.5} fill={who(id).color} stroke={INK} strokeWidth={0.8} opacity={outAt(s, id) !== null ? 0.35 : 1} />
                  <text y={1.6} textAnchor="middle" fontSize={5} className="font-party" fill="#FFFFFF" stroke={INK} strokeWidth={0.4} paintOrder="stroke">{who(id).name.slice(0, 1)}</text>
                </g>
              )
            })}
            {aim && (
              <g transform={`translate(${aim[0]} ${aim[1]})`}>
                <circle r={8} fill={PARK.coral} opacity={0.25} stroke={PARK.coralDark} strokeWidth={0.9} />
                <path d="M-12 0 H-5 M5 0 H12 M0 -12 V-5 M0 5 V12" stroke={PARK.coralDark} strokeWidth={1} strokeLinecap="round" />
              </g>
            )}
          </svg>
        </div>
        <div className="text-center text-lg font-bold" style={{ color: PARK.ink2 }}>Drag to aim, let go to throw. Lead them: it takes a second to land.</div>
      </div>
    </PadShell>
  )
}
