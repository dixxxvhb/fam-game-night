import { memo, useRef, useState } from 'react'
import { useTicker } from '../../../engine/context'
import { sfx } from '../../../ui/sfx'
import { CritterArt, INK, critter, type CritterId, type Mood } from '../park/cast'
import { PARK } from '../park/ui'
import {
  tubes, BUMP_GAP_MS, POOL_R0, POOL_X, POOL_Y, TUBES_MS, collide, endAt, floating, isOut, poolR, stepTube, tubeMass, tubeR, tubeSpawn, tubesAt,
  type TubesState,
} from './tubes'
import { STEP, WORLD_H, WORLD_W, body } from './rt'
import {
  Burst, CallOut, Joystick, WinStar, callY, NameTag, Plate, Scene, SceneFrame, charFor, ownBodies, ownKey, secsLeft, simDraw,
  useBodySender, usePosReport, usePoses, useRemoteBodies, useStepLoop, vibrate,
} from './rt.view'
import { PadShell, TvClock, TvShell, myRole, sideOf, useLatest, type MgPadProps, type MgViewProps } from './ui'

// ---------------- the wave pool ----------------

function Pool({ t, startAt, compact }: { t: number; startAt: number; compact: boolean }) {
  const R = poolR(startAt, t)
  const n = 28
  const buoys: [number, number][] = []
  // A ring of buoys at the current edge (a simple polygon walk, no trig needed for drawing).
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    buoys.push([POOL_X + Math.cos(a) * R, POOL_Y + Math.sin(a) * R])
  }
  const shrinking = R < POOL_R0 - 0.01
  return (
    <g>
      <defs>
        <pattern id="bt-deck" width="12" height="12" patternUnits="userSpaceOnUse">
          <rect width="12" height="12" fill="#F4EEE2" />
          <path d="M0 0 H12 M0 0 V12" stroke="#E2D8C4" strokeWidth="0.5" />
        </pattern>
        <radialGradient id="bt-water" cx="0.5" cy="0.45" r="0.6">
          <stop offset="0" stopColor="#7FDcff" />
          <stop offset="1" stopColor={PARK.sea} />
        </radialGradient>
      </defs>
      <rect x={0} y={0} width={WORLD_W} height={WORLD_H} fill="url(#bt-deck)" />
      {!compact && (
        <g>
          {/* loungers and an umbrella on the deck */}
          {[[12, 18, -10], [12, 74, 8], [148, 20, 12], [148, 72, -8]].map(([x, y, r], i) => (
            <g key={i} transform={`translate(${x} ${y}) rotate(${r})`}>
              <rect x={-4} y={-9} width={8} height={18} rx={1.5} fill={i % 2 ? PARK.blue : '#FF7AA2'} stroke={INK} strokeWidth={0.45} />
              <rect x={-4} y={-9} width={8} height={5} rx={1.5} fill="#FFFFFF" stroke={INK} strokeWidth={0.45} />
            </g>
          ))}
          <g transform="translate(150 46)">
            <circle r={7} fill={PARK.sun} stroke={INK} strokeWidth={0.5} />
            <path d="M0 -7 V7 M-7 0 H7 M-5 -5 L5 5 M5 -5 L-5 5" stroke={INK} strokeWidth={0.35} opacity={0.5} />
          </g>
        </g>
      )}
      <circle cx={POOL_X} cy={POOL_Y} r={POOL_R0 + 3.2} fill="#FFFFFF" stroke={INK} strokeWidth={0.7} />
      <circle cx={POOL_X} cy={POOL_Y} r={POOL_R0 + 1.2} fill="url(#bt-water)" stroke={INK} strokeWidth={0.5} />
      {shrinking && <circle cx={POOL_X} cy={POOL_Y} r={(POOL_R0 + 1.2 + R) / 2} fill="none" stroke="#1B7AC0" strokeWidth={POOL_R0 + 1.2 - R} opacity={0.35} />}
      {/* ripples */}
      <g className="bt-ripple" opacity={0.5}>
        <path d={`M${POOL_X - 20} ${POOL_Y - 12} q4 -2 8 0 t8 0`} fill="none" stroke="#FFFFFF" strokeWidth={0.6} strokeLinecap="round" />
        <path d={`M${POOL_X + 6} ${POOL_Y + 16} q4 -2 8 0 t8 0`} fill="none" stroke="#FFFFFF" strokeWidth={0.6} strokeLinecap="round" />
        <path d={`M${POOL_X + 14} ${POOL_Y - 22} q3 -1.5 6 0 t6 0`} fill="none" stroke="#FFFFFF" strokeWidth={0.6} strokeLinecap="round" />
      </g>
      {/* the lane rope */}
      <circle cx={POOL_X} cy={POOL_Y} r={R} fill="none" stroke="#FFFFFF" strokeWidth={0.5} strokeDasharray="1 1" />
      {buoys.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={1.1} fill={i % 2 ? '#FFFFFF' : PARK.coral} stroke={INK} strokeWidth={0.3} />)}
      <style>{`
        @keyframes bt-ripple { 0%,100% { transform: translateX(0) } 50% { transform: translateX(2px) } }
        .bt-ripple { animation: bt-ripple 2.4s ease-in-out infinite; }
      `}</style>
    </g>
  )
}

const TubeCritter = memo(function TubeCritter({ char, mood, size, flip }: { char: CritterId; mood: Mood; size: number; flip: boolean }) {
  return <CritterArt id={char} mood={mood} size={size} flip={flip} />
})

/** A critter in an inner tube: back half of the tube, the critter, the front half over its legs. */
function Tube({ x, y, r, char, mood, flip, sink = 0, wake = 0, wx = 0, wy = 0 }: { x: number; y: number; r: number; char: CritterId; mood: Mood; flip: boolean; sink?: number; wake?: number; wx?: number; wy?: number }) {
  const c = critter(char)!
  const size = r * 2.15
  const h = size * (140 / 120)
  const ry = r * 0.62
  const sw = r * 0.42
  return (
    <g transform={`translate(${x.toFixed(2)} ${y.toFixed(2)})`} opacity={1 - sink}>
      {wake > 0.15 && (
        <g opacity={Math.min(0.7, wake)} stroke="#FFFFFF" strokeWidth={0.6} strokeLinecap="round" fill="none">
          <path d={`M${(-wx * r * 1.3 - wy * r * 0.5).toFixed(2)} ${(-wy * r * 1.3 + wx * r * 0.5).toFixed(2)} l${(-wx * 3).toFixed(2)} ${(-wy * 3).toFixed(2)}`} />
          <path d={`M${(-wx * r * 1.3 + wy * r * 0.5).toFixed(2)} ${(-wy * r * 1.3 - wx * r * 0.5).toFixed(2)} l${(-wx * 3).toFixed(2)} ${(-wy * 3).toFixed(2)}`} />
        </g>
      )}
      <ellipse cy={ry * 0.35} rx={r * 1.05} ry={ry * 1.05} fill="#1B7AC0" opacity={0.35} />
      {/* back half */}
      <path d={`M${-r} 0 A${r} ${ry} 0 0 1 ${r} 0`} fill="none" stroke={INK} strokeWidth={sw + 0.9} />
      <path d={`M${-r} 0 A${r} ${ry} 0 0 1 ${r} 0`} fill="none" stroke={c.color} strokeWidth={sw} />
      <g transform={`translate(${-size / 2} ${-h * 0.7 + sink * h * 0.5})`}>
        <TubeCritter char={char} mood={mood} size={size} flip={flip} />
      </g>
      {/* front half, over the legs */}
      <path d={`M${-r} 0 A${r} ${ry} 0 0 0 ${r} 0`} fill="none" stroke={INK} strokeWidth={sw + 0.9} />
      <path d={`M${-r} 0 A${r} ${ry} 0 0 0 ${r} 0`} fill="none" stroke={c.color} strokeWidth={sw} />
      <path d={`M${-r * 0.55} ${ry * 0.82} A${r} ${ry} 0 0 0 ${r * 0.1} ${ry * 0.99}`} fill="none" stroke="#FFFFFF" strokeWidth={sw * 0.3} strokeLinecap="round" opacity={0.85} />
    </g>
  )
}

// ---------------- TV ----------------

interface Drawn { id: string; x: number; y: number; vx: number; vy: number; flip: boolean; out: boolean; outAt: number | null }

export function TubesStage({ s, run, who, now, compact }: MgViewProps<TubesState>) {
  const bumps = useRef(new Map<string, { x: number; y: number; at: number }>())
  const snap = usePoses({
    no: run.no, ids: s.players, compact, now,
    sim: (id, tt) => { const w = tubesAt(s, tt); const b = w.bodies[id]; if (!b) return null; const [x, y] = simDraw(b, s.startAt, tt, w.step); return { x, y, vx: b.vx, vy: b.vy } },
    spawn: (id) => tubeSpawn(s, id),
    // Bump flashes where two floating tubes touch (looks only; phones and the sim do the physics).
    extra: (poses, tt) => {
      const live = s.players.filter((id) => floating(s, id, tt))
      for (let i = 0; i < live.length; i++) {
        for (let j = i + 1; j < live.length; j++) {
          const a = poses[live[i]]
          const b = poses[live[j]]
          const key = `${live[i]}|${live[j]}`
          const d = Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
          const prev = bumps.current.get(key)
          if (d < tubeR(s, live[i]) + tubeR(s, live[j]) + 0.6 && (!prev || tt - prev.at > 450)) bumps.current.set(key, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, at: tt })
        }
      }
      return [...bumps.current.values()].filter((x) => tt - x.at < 380)
    },
  })
  const t = snap?.t ?? now()
  const end = endAt(s)
  const over = t >= end
  const w = tubesAt(s, t)
  const res = over ? tubes.result(s) : null
  const drawn: Drawn[] = snap ? s.players.map((id) => {
    const p = snap.poses[id]
    const o = s.outs[id] ?? (w.bodies[id] ? w.outs[id] ?? null : null)
    return { id, x: p.x, y: p.y, vx: p.vx, vy: p.vy, flip: p.flip, out: o !== null && o <= t, outAt: o }
  }) : []
  const alive = s.players.filter((id) => floating(s, id, end))
  const call = over
    ? s.format === '1v2' && s.solo ? (floating(s, s.solo, end) ? 'BIG TUBE WINS' : 'SUNK IT') : alive.length === 1 ? 'LAST ONE FLOATING' : alive.length === 0 ? 'EVERYBODY IN' : 'WHISTLE!'
    : t > s.startAt + 11_000 && t < s.startAt + 12_600 ? 'ROPE COMING IN' : null

  const sorted = [...drawn].sort((a, b) => a.y - b.y)
  const scene = (
    <SceneFrame compact={compact}>
      <Scene>
        <Pool t={t} startAt={s.startAt} compact={compact} />
        {sorted.map((d) => {
          const ch = charFor(who, s.players, d.id)
          const flip = d.flip
          const sp = Math.sqrt(d.vx * d.vx + d.vy * d.vy)
          const sink = d.out && d.outAt !== null ? Math.min(1, (t - d.outAt) / 1400) : 0
          if (sink >= 1) return null
          const won = !!res && res.places[d.id] === 1 && !d.out
          const mood: Mood = d.out ? 'sad' : won ? 'happy' : sp > 40 ? 'hop' : 'idle'
          return (
            <g key={d.id}>
              {d.out && d.outAt !== null && t - d.outAt < 900 && (
                <g transform={`translate(${d.x} ${d.y})`}>
                  {[0, 1].map((k) => { const p = Math.min(1, (t - d.outAt! - k * 200) / 700); return p > 0 ? <ellipse key={k} rx={4 + p * 12} ry={(4 + p * 12) * 0.6} fill="none" stroke="#FFFFFF" strokeWidth={0.8} opacity={1 - p} /> : null })}
                </g>
              )}
              <Tube x={d.x} y={d.y} r={tubeR(s, d.id)} char={ch} mood={mood} flip={flip} sink={sink} wake={d.out ? 0 : sp / 70} wx={sp > 1 ? d.vx / sp : 0} wy={sp > 1 ? d.vy / sp : 0} />
              {!compact && !d.out && <g transform={`translate(${d.x} ${d.y})`}><NameTag name={who(d.id).name} char={ch} y={d.y < 30 ? tubeR(s, d.id) * 0.9 + 3 : -tubeR(s, d.id) * 2.3 - 2.5} />{won && <WinStar t={t} y={d.y < 30 ? -tubeR(s, d.id) * 2.3 - 2 : -tubeR(s, d.id) * 2.3 - 9} />}</g>}
            </g>
          )
        })}
        {(snap?.extra ?? []).map((b, i) => (
          <g key={i} transform={`translate(${b.x} ${b.y - 6}) scale(${(0.7 + (t - b.at) / 900).toFixed(2)})`} opacity={1 - (t - b.at) / 380}><Burst text="BUMP" size={3.6} rot={6} /></g>
        ))}
        {drawn.filter((d) => d.out && d.outAt !== null && t - d.outAt < 900).map((d) => (
          <g key={`s${d.id}`} transform={`translate(${d.x} ${d.y - 12})`}><Burst text="SPLASH" color="#BFEFFF" size={3.8} /></g>
        ))}
        {call && <CallOut text={call} color={call === 'ROPE COMING IN' ? PARK.blue : PARK.coral} y={callY(drawn.filter((d) => !d.out).map((d) => d.y))} />}
      </Scene>
    </SceneFrame>
  )

  if (compact) {
    return (
      <div className="grid gap-2" data-rt-tv="tubes">
        {scene}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm font-bold" style={{ color: INK }}>
          {s.players.map((id) => <span key={id} style={{ opacity: floating(s, id, t) ? 1 : 0.45 }}>{who(id).name} {floating(s, id, t) ? 'floating' : 'splashed'}</span>)}
          <span className="font-party text-xl">{secsLeft(s.startAt + TUBES_MS, t)}</span>
        </div>
      </div>
    )
  }
  return (
    <TvShell run={run} title="Bumper Tubes" right={<TvClock endsAt={s.startAt + TUBES_MS} now={now} />}>
      <div className="flex h-full min-h-0 gap-5" data-rt-tv="tubes">
        <div className="min-h-0 min-w-0 flex-1">{scene}</div>
        <div className="grid w-60 shrink-0 content-start gap-3">
          {s.players.map((id) => {
            const fl = floating(s, id, t)
            return (
              <Plate key={id} who={who} id={id} players={s.players} dim={!fl} hot={over && fl} sub={sideOf(run, id) === 'Solo' ? 'Big tube' : sideOf(run, id)}>
                <span className="font-party text-xl" style={{ color: fl ? PARK.blueDark : PARK.ink3 }}>{fl ? 'Floating' : 'Splashed'}</span>
              </Plate>
            )
          })}
        </div>
      </div>
    </TvShell>
  )
}

// ---------------- phone ----------------

export function TubesPad({ s, run, me, who, now, send }: MgPadProps<TubesState>) {
  useTicker(100)
  const stick = useRef<[number, number]>([0, 0])
  const me0 = useRef(body(...tubeSpawn(s, me)))
  const latest = useLatest(s)
  const remote = useRemoteBodies(run.no)
  const [outNow, setOutNow] = useState(!floating(s, me, Infinity))
  const [edgeNow, setEdgeNow] = useState(false)
  const push = useBodySender(run.no)
  const report = usePosReport(run, who, send)
  const lastBump = useRef(new Map<string, number>())
  const outSent = useRef(!floating(s, me, Infinity))
  const [hitAt, setHitAt] = useState(0)

  useStepLoop(s.startAt, now, (_k, t0) => {
    const cur = latest.current
    const b = me0.current
    const t1 = t0 + STEP
    const end = endAt(cur)
    const out = outSent.current
    const live = !out && t0 < end
    if (out) { b.px = b.x; b.py = b.y; b.vx = 0; b.vy = 0 }
    else stepTube(b, live ? stick.current[0] : 0, live ? stick.current[1] : 0)
    if (!out) {
      const myR = tubeR(cur, me)
      const myM = tubeMass(cur, me)
      const sim = tubesAt(cur, t1)
      for (const id of cur.players) {
        if (id === me || !floating(cur, id, t1)) continue
        let o: { x: number; y: number; vx: number; vy: number } | null = null
        const sb = sim.bodies[id]
        const isBot = !!sb
        if (sb) { if (id in sim.outs) continue; o = sb }
        else {
          const r = remote.raw(id)
          if (!r || (r.f & 1)) continue
          const age = Math.min(0.12, (performance.now() - r.at) / 1000)
          o = { x: r.x + r.vx * age, y: r.y + r.vy * age, vx: r.vx, vy: r.vy }
        }
        const h = collide(b, myR, myM, o, tubeR(cur, id), tubeMass(cur, id))
        if (!h) continue
        b.x += h.px
        b.y += h.py
        const last = lastBump.current.get(id) ?? -Infinity
        if (t1 - last < BUMP_GAP_MS || (h.dvx === 0 && h.dvy === 0)) continue
        lastBump.current.set(id, t1)
        b.vx += h.dvx
        b.vy += h.dvy
        if (isBot) send('bump', { to: id, ix: Math.round(h.ovx * 10) / 10, iy: Math.round(h.ovy * 10) / 10 })
        vibrate(35)
        sfx.play('pop')
        setHitAt(t1)
      }
      if (t1 <= end && isOut(cur.startAt, t1, b.x, b.y)) {
        outSent.current = true
        setOutNow(true)
        send('out')
        vibrate([100, 50, 220])
        sfx.play('bad')
      }
    }
    const fromC = Math.sqrt((b.x - POOL_X) ** 2 + (b.y - POOL_Y) ** 2)
    setEdgeNow(!outSent.current && fromC > poolR(cur.startAt, t1) - 7)
    ownBodies.set(ownKey(run.no, me), { b, f: outSent.current ? 1 : 0 })
    push(b, outSent.current ? 1 : 0)
    report(b)
  })

  const t = now()
  const out = outNow || !floating(s, me, t)
  const over = t >= endAt(s)
  const edge = !out && !over && edgeNow
  const bumped = t - hitAt < 400
  return (
    <PadShell title="Bumper Tubes" sub={myRole(run, me, who) ?? 'Ram them out of the pool. Stay inside the rope.'} endsAt={s.startAt + TUBES_MS} total={TUBES_MS} now={now}>
      <div className="grid gap-4" data-rt="tubes" data-rt-out={out ? 1 : 0}>
        <div className="flex items-center justify-between rounded-[20px] border-4 bg-white px-4 py-3" style={{ borderColor: INK, color: INK, boxShadow: `0 6px 0 ${INK}`, background: edge ? '#FFE1DC' : '#FFFFFF' }}>
          <span className="font-party text-3xl" style={{ color: out ? PARK.ink3 : edge ? PARK.coralDark : INK }}>{out ? 'SPLASHED' : over ? 'FLOATING' : edge ? 'EDGE!' : bumped ? 'BUMP!' : 'FLOATING'}</span>
          <span className="font-party text-2xl" style={{ color: PARK.ink2 }}>{secsLeft(s.startAt + TUBES_MS, t)}s</span>
        </div>
        <Joystick onStick={(v) => { stick.current = v }} disabled={out || over} size={320} color={PARK.blue} label={<span className="font-party text-xl text-white" style={{ WebkitTextStroke: `1.5px ${INK}`, paintOrder: 'stroke fill' }}>PADDLE</span>} />
        <div className="text-center text-lg font-bold" style={{ color: PARK.ink2 }}>
          {out ? 'You are in the drink. Watch the rest.' : 'You drift. Hold a direction to paddle, let go to coast. Hit them hard.'}
        </div>
      </div>
    </PadShell>
  )
}
