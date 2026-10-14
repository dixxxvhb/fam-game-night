import { useRef, useState } from 'react'
import { useTicker } from '../../../engine/context'
import { sfx } from '../../../ui/sfx'
import { INK, critter, type Mood } from '../park/cast'
import { Count, PARK } from '../park/ui'
import {
  frenzy, CART_HH, COOP_GOAL, FRENZY_AT, FRENZY_MS, GRAB_R, STUN_MS, cartHits, cartX, cartsOf, coinsOf, frenzyAt, frenzySpawn, score, stunned,
  type Bonk, type Cart, type Coin, type FrenzyState,
} from './frenzy'
import { STEP, WORLD_W, body, dist, stepWalker } from './rt'
import {
  Burst, CallOut, Joystick, WinStar, callY, NameTag, Plate, Scene, SceneFrame, Sprite, charFor, ownBodies, ownKey, secsLeft, simDraw,
  useBodySender, usePosReport, usePoses, useStepLoop, vibrate,
} from './rt.view'
import { PadShell, TvClock, TvShell, myRole, sideOf, useLatest, type MgPadProps, type MgViewProps } from './ui'

// ---------------- the plaza ----------------

function Plaza({ compact }: { compact: boolean }) {
  const awn = [PARK.coral, PARK.blue, PARK.sun, PARK.good, '#FF7AA2']
  return (
    <g>
      <defs>
        <pattern id="cf-tile" width="10" height="10" patternUnits="userSpaceOnUse">
          <rect width="10" height="10" fill="#F7E9CC" />
          <path d="M0 0 H10 M0 0 V10" stroke="#E6D2A8" strokeWidth="0.45" />
          <rect x="5" y="5" width="5" height="5" fill="#F2DFB8" />
        </pattern>
      </defs>
      <rect x={0} y={0} width={WORLD_W} height={90} fill="url(#cf-tile)" />
      {/* shop fronts along the top */}
      <rect x={0} y={0} width={WORLD_W} height={10} fill="#FFFFFF" />
      {awn.map((c, i) => (
        <g key={i} transform={`translate(${i * 32} 0)`}>
          <rect x={2} y={0} width={28} height={8} fill="#FFF7EA" stroke={INK} strokeWidth={0.4} />
          {[0, 1, 2, 3].map((j) => <rect key={j} x={2 + j * 7} y={7} width={3.5} height={4} fill={c} stroke={INK} strokeWidth={0.3} />)}
          {[0, 1, 2, 3].map((j) => <rect key={`w${j}`} x={5.5 + j * 7} y={7} width={3.5} height={4} fill="#FFFFFF" stroke={INK} strokeWidth={0.3} />)}
        </g>
      ))}
      <rect x={0} y={11} width={WORLD_W} height={1.2} fill={PARK.grassDark} />
      {!compact && (
        <g>
          {[[6, 86], [154, 86]].map(([x, y], i) => (
            <g key={i} transform={`translate(${x} ${y})`}>
              <rect x={-3.5} y={-3} width={7} height={4} rx={1} fill="#B4793F" stroke={INK} strokeWidth={0.4} />
              <circle cy={-5} r={3.4} fill={PARK.grass} stroke={INK} strokeWidth={0.4} />
            </g>
          ))}
        </g>
      )}
      <style>{`
        @keyframes cf-spin { 0%,100% { transform: scaleX(1) } 50% { transform: scaleX(0.25) } }
        .cf-spin { animation: cf-spin 0.9s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
        @keyframes cf-warn { 0%,100% { opacity: 0.18 } 50% { opacity: 0.42 } }
        .cf-warn { animation: cf-warn 0.4s linear infinite; }
      `}</style>
    </g>
  )
}

function CoinArt({ big, spin = true }: { big: boolean; spin?: boolean }) {
  const r = big ? 3.9 : 2.8
  return (
    <g className={spin ? 'cf-spin' : undefined}>
      <circle cy={r * 0.18} r={r} fill={PARK.coinDark} stroke={INK} strokeWidth={0.45} />
      <circle r={r} fill={PARK.coin} stroke={INK} strokeWidth={0.45} />
      {big
        ? <path d="M0 -2 L0.6 -0.6 L2 -0.6 L0.9 0.3 L1.3 1.8 L0 0.9 L-1.3 1.8 L-0.9 0.3 L-2 -0.6 L-0.6 -0.6 Z" fill={PARK.coinDark} />
        : <rect x={-0.5} y={-1.3} width={1} height={2.6} rx={0.5} fill={PARK.coinDark} />}
    </g>
  )
}

function CoinDraw({ c, t, layer }: { c: Coin; t: number; layer: 'ground' | 'air' }) {
  const big = c.v > 1
  if (t < c.land) {
    const p = Math.max(0, Math.min(1, (t - c.at) / (c.land - c.at)))
    if (layer === 'ground') return <ellipse cx={c.x} cy={c.y + 0.6} rx={(big ? 3 : 2) * (0.4 + 0.6 * p)} ry={(big ? 1.2 : 0.8) * (0.4 + 0.6 * p)} fill={INK} opacity={0.15 + 0.2 * p} />
    return <g transform={`translate(${c.x} ${(c.y - 40 * (1 - p * p)).toFixed(2)})`}><CoinArt big={big} spin={false} /></g>
  }
  if (layer === 'air') return null
  const left = c.gone - t
  if (left < 1000 && Math.floor(t / 120) % 2 === 0) return null
  const bounce = t - c.land < 200 ? -Math.sin(((t - c.land) / 200) * Math.PI) * 1.4 : 0
  return (
    <g transform={`translate(${c.x} ${(c.y + bounce).toFixed(2)})`}>
      <ellipse cy={0.7} rx={big ? 3 : 2} ry={big ? 1.1 : 0.75} fill={INK} opacity={0.18} />
      <CoinArt big={big} />
    </g>
  )
}

function CartDraw({ cart, t }: { cart: Cart; t: number }) {
  const x = cartX(cart, t)
  const warn = t >= cart.warn && t < cart.go + 300
  const on = x !== null
  if (!warn && !on) return null
  return (
    <g>
      {warn && (
        <g>
          <rect x={0} y={cart.y - CART_HH - 2} width={WORLD_W} height={(CART_HH + 2) * 2} fill={PARK.coral} className="cf-warn" />
          {[20, 50, 80, 110, 140].map((cx) => (
            <path key={cx} d={cart.dir > 0 ? `M${cx - 2} ${cart.y - 3} L${cx + 2} ${cart.y} L${cx - 2} ${cart.y + 3}` : `M${cx + 2} ${cart.y - 3} L${cx - 2} ${cart.y} L${cx + 2} ${cart.y + 3}`} fill="none" stroke={PARK.coralDark} strokeWidth={1.1} strokeLinecap="round" strokeLinejoin="round" />
          ))}
        </g>
      )}
      {on && (
        <g transform={`translate(${x!.toFixed(2)} ${cart.y}) scale(${cart.dir > 0 ? 1 : -1} 1)`}>
          <ellipse cy={5.8} rx={11} ry={1.6} fill={INK} opacity={0.2} />
          {/* roof + posts */}
          <rect x={-8} y={-10} width={13} height={2} rx={0.8} fill="#FF7AA2" stroke={INK} strokeWidth={0.45} />
          <path d="M-7 -8 V-1 M4 -8 V-1" stroke={INK} strokeWidth={0.7} />
          {/* body */}
          <path d="M-11 -1 H6 Q10 -1 11 3 V4.5 H-11 Z" fill="#FFFFFF" stroke={INK} strokeWidth={0.5} strokeLinejoin="round" />
          <rect x={-11} y={1.2} width={22} height={1.4} fill="#FF7AA2" />
          <circle cx={-6.5} cy={4.8} r={2.2} fill={INK} />
          <circle cx={6.5} cy={4.8} r={2.2} fill={INK} />
          <circle cx={-6.5} cy={4.8} r={0.8} fill="#C9C4DA" />
          <circle cx={6.5} cy={4.8} r={0.8} fill="#C9C4DA" />
          <path d="M-14 -0.5 H-17 M-14 2 H-18.5 M-14 4.5 H-16.5" stroke={INK} strokeWidth={0.5} strokeLinecap="round" opacity={0.5} />
        </g>
      )}
    </g>
  )
}

// ---------------- TV ----------------

interface Drawn { id: string; x: number; y: number; mood: Mood; flip: boolean; dizzy: boolean }

export function FrenzyStage({ s, run, who, now, compact }: MgViewProps<FrenzyState>) {
  const snap = usePoses({
    no: run.no, ids: s.players, compact, now,
    sim: (id, tt) => { const w = frenzyAt(s, tt); const b = w.bodies[id]; if (!b) return null; const [x, y] = simDraw(b, s.startAt, tt, w.step); return { x, y, vx: b.vx, vy: b.vy } },
    spawn: (id) => frenzySpawn(s, id),
  })
  const t = snap?.t ?? now()
  const end = s.startAt + FRENZY_MS
  const over = t >= end
  const w = frenzyAt(s, t)
  const coins = coinsOf(s).filter((c) => c.at <= t && t < c.gone && !(s.taken[c.k] && s.taken[c.k].t <= t) && !w.grabs[c.k])
  const pops = Object.entries(s.taken).filter(([, g]) => t - g.t < 750 && t >= g.t)
  const scores = Object.fromEntries(s.players.map((id) => [id, score(s, id)]))
  const res = over ? frenzy.result(s) : null
  const crit: Drawn[] = snap ? s.players.map((id) => {
    const p = snap.poses[id]
    const dizzy = stunned(s.bonks[id], t)
    const won = !!res && (s.format === 'coop' ? !!res.success : res.places[id] === 1)
    const mood: Mood = won ? 'happy' : dizzy || (res && !won) ? 'sad' : Math.abs(p.vx) + Math.abs(p.vy) > 10 ? 'hop' : 'idle'
    return { id, x: p.x, y: p.y, mood, flip: p.flip, dizzy }
  }).sort((x, y) => x.y - y.y) : []
  const total = s.players.reduce((a, id) => a + scores[id], 0)
  const call = over
    ? s.format === 'coop' ? (total >= COOP_GOAL ? 'GOAL!' : 'SHORT') : 'TIME!'
    : t >= s.startAt + FRENZY_AT && t < s.startAt + FRENZY_AT + 1600 ? 'FRENZY!' : null

  const scene = (
    <SceneFrame compact={compact}>
      <Scene>
        <Plaza compact={compact} />
        {coins.map((c) => <CoinDraw key={c.k} c={c} t={t} layer="ground" />)}
        {crit.map((c) => {
          const ch = charFor(who, s.players, c.id)
          return (
            <Sprite key={c.id} x={c.x} y={c.y} char={ch} mood={c.mood} flip={c.flip} size={compact ? 14 : 13} alpha={c.dizzy && Math.floor(t / 100) % 2 === 0 ? 0.5 : 1}>
              {!compact && <NameTag name={who(c.id).name} char={ch} y={c.y < 32 ? 5.5 : -18} />}
              {c.mood === 'happy' && <WinStar t={t} y={c.y < 32 ? -17 : -25} />}
            </Sprite>
          )
        })}
        {cartsOf(s).map((c) => <CartDraw key={c.c} cart={c} t={t} />)}
        {coins.map((c) => <CoinDraw key={`a${c.k}`} c={c} t={t} layer="air" />)}
        {pops.map(([k, g]) => {
          const c = coinsOf(s)[Number(k)]
          if (!c) return null
          const up = (t - g.t) / 750
          const ch = critter(charFor(who, s.players, g.by))!
          return (
            <text key={`p${k}`} x={c.x} y={c.y - 4 - up * 10} textAnchor="middle" fontSize={c.v > 1 ? 6.5 : 5} className="font-party" fill={ch.color} stroke={INK} strokeWidth={0.5} paintOrder="stroke" opacity={1 - up * 0.7}>+{c.v}</text>
          )
        })}
        {crit.map((c) => {
          const last = (s.bonks[c.id] ?? []).at(-1)
          if (!last || t - last.t > STUN_MS || t < last.t) return null
          return <g key={`b${c.id}`} transform={`translate(${c.x} ${c.y - 21})`}><Burst text={last.lost ? `-${last.lost}` : 'BEEP'} color={PARK.coral} size={4} /></g>
        })}
        {call && <CallOut text={call} color={call === 'FRENZY!' ? PARK.sun : PARK.coral} y={callY(crit.map((c) => c.y))} />}
      </Scene>
    </SceneFrame>
  )

  if (compact) {
    return (
      <div className="grid gap-2" data-rt-tv="frenzy">
        {scene}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm font-bold" style={{ color: INK }}>
          {s.players.map((id) => <span key={id} className="inline-flex items-center gap-1">{who(id).name} <Count kind="coin" n={scores[id]} size={14} /></span>)}
          {s.format === 'coop' && <span>{total} / {COOP_GOAL}</span>}
          <span className="font-party text-xl">{secsLeft(end, t)}</span>
        </div>
      </div>
    )
  }
  return (
    <TvShell run={run} title="Coin Frenzy" right={<TvClock endsAt={end} now={now} />}>
      <div className="flex h-full min-h-0 gap-5" data-rt-tv="frenzy">
        <div className="min-h-0 min-w-0 flex-1">{scene}</div>
        <div className="grid w-60 shrink-0 content-start gap-3">
          {s.format === 'coop' && <CoopMeter total={total} />}
          {[...s.players].sort((a, b) => scores[b] - scores[a]).map((id) => (
            <Plate key={id} who={who} id={id} players={s.players} hot={!!res && res.places[id] === 1 && s.format !== 'coop'} sub={sideOf(run, id)}>
              <Count kind="coin" n={scores[id]} size={24} />
            </Plate>
          ))}
        </div>
      </div>
    </TvShell>
  )
}

function CoopMeter({ total }: { total: number }) {
  const p = Math.min(1, total / COOP_GOAL)
  return (
    <div className="rounded-[20px] border-4 bg-white px-4 py-3" style={{ borderColor: INK, boxShadow: `0 6px 0 ${INK}`, color: INK }}>
      <div className="flex items-baseline justify-between">
        <span className="font-party text-3xl">{total}</span>
        <span className="font-party text-xl" style={{ color: PARK.ink2 }}>of {COOP_GOAL}</span>
      </div>
      <div className="mt-2 h-4 overflow-hidden rounded-full border-[3px]" style={{ borderColor: INK, background: '#F1EEF8' }}>
        <div className="h-full transition-[width] duration-200" style={{ width: `${p * 100}%`, background: p >= 1 ? PARK.good : PARK.coin }} />
      </div>
    </div>
  )
}

// ---------------- phone ----------------

export function FrenzyPad({ s, run, me, who, now, send }: MgPadProps<FrenzyState>) {
  useTicker(100)
  const stick = useRef<[number, number]>([0, 0])
  const [sx, sy] = frenzySpawn(s, me)
  const me0 = useRef(body(sx, sy))
  const mine = useRef(new Map<number, number>())
  const myBonks = useRef<Bonk[]>([...(s.bonks[me] ?? [])])
  const latest = useLatest(s)
  const push = useBodySender(run.no)
  const report = usePosReport(run, who, send)
  const [pop, setPop] = useState<{ v: number; at: number } | null>(null)
  const [pending, setPending] = useState(0)
  const [dizzyAt, setDizzyAt] = useState(-Infinity)

  useStepLoop(s.startAt, now, (_k, t0) => {
    const cur = latest.current
    const b = me0.current
    const t1 = t0 + STEP
    const live = t0 < cur.startAt + FRENZY_MS
    const dizzy = stunned(myBonks.current, t0)
    stepWalker(b, live && !dizzy ? stick.current[0] : 0, live && !dizzy ? stick.current[1] : 0)
    if (live) {
      if (!dizzy) {
        for (const c of coinsOf(cur)) {
          if (c.land > t1) break
          if (c.gone <= t1 || cur.taken[c.k] || mine.current.has(c.k)) continue
          if (dist(b.x, b.y, c.x, c.y) <= GRAB_R) {
            mine.current.set(c.k, c.v)
            send('grab', { k: c.k })
            vibrate(c.v > 1 ? 50 : 20)
            sfx.play(c.v > 1 ? 'good' : 'pop')
            setPop({ v: c.v, at: t1 })
          }
        }
      }
      for (const cart of cartsOf(cur)) {
        if (myBonks.current.some((x) => x.c === cart.c)) continue
        if (cartHits(cart, t1, b.x, b.y)) {
          myBonks.current = [...myBonks.current, { c: cart.c, t: t1, lost: 0 }]
          setDizzyAt(t1)
          send('bonk', { c: cart.c })
          vibrate([60, 40, 120])
          sfx.play('bad')
          setPop({ v: -3, at: t1 })
        }
      }
    }
    // Coins I grabbed that the host has not confirmed yet count right away (unless someone beat me to it).
    let p = 0
    mine.current.forEach((v, k) => { if (!cur.taken[k]) p += v })
    setPending(p)
    ownBodies.set(ownKey(run.no, me), { b, f: dizzy ? 2 : 0 })
    push(b, dizzy ? 2 : 0)
    report(b)
  })

  const t = now()
  const n = score(s, me) + pending
  const over = t >= s.startAt + FRENZY_MS
  const dizzy = t >= dizzyAt && t - dizzyAt < STUN_MS
  const showPop = pop && t - pop.at < 600
  return (
    <PadShell title="Coin Frenzy" sub={myRole(run, me, who) ?? 'Run over the coins. Dodge the golf carts.'} endsAt={s.startAt + FRENZY_MS} total={FRENZY_MS} now={now}>
      <div className="grid gap-4" data-rt="frenzy" data-rt-coins={n}>
        <div className="relative flex items-center justify-between rounded-[20px] border-4 bg-white px-4 py-3" style={{ borderColor: INK, color: INK, boxShadow: `0 6px 0 ${INK}` }}>
          <Count kind="coin" n={n} size={40} />
          <span className="font-party text-3xl" style={{ color: dizzy ? PARK.coral : showPop ? PARK.coinDark : INK }}>
            {over ? 'TIME' : dizzy ? 'BEEP BEEP' : showPop ? (pop!.v > 0 ? `+${pop!.v}` : `${pop!.v}`) : t >= s.startAt + FRENZY_AT ? 'FRENZY' : 'GRAB'}
          </span>
        </div>
        <Joystick onStick={(v) => { stick.current = v }} disabled={over} size={320} color={PARK.sun} label={<span className="font-party text-2xl" style={{ color: INK }}>RUN</span>} />
        <div className="text-center text-lg font-bold" style={{ color: PARK.ink2 }}>
          {s.format === 'coop' ? `Together: ${s.players.reduce((a, id) => a + score(s, id), 0)} of ${COOP_GOAL}. ` : ''}A red stripe means a golf cart. Get out of it.
        </div>
      </div>
    </PadShell>
  )
}

