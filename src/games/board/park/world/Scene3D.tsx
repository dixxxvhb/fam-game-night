import { memo, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { HOP_MS, ROLLING_MS, curId, hopsDone, visualPos, type BoardState, type Stage } from '../../logic'
import { SPACES, WORLD_H, WORLD_W } from '../../map'
import { SPACE_COLOR, type Who } from '../../view'
import { CritterArt, INK, critter, type Mood } from '../cast'
import { Coin, PARK, ParkStar } from '../ui'
import { PERSPECTIVE, STAR_PAN_MS, TILT, chooseCamera } from './camera'
import { LANE_PLACE } from './geo'
import { PROPS } from './layout'
import { SpriteSvg, SPRITES } from './sprites'
import { SEA, SEA_DEEP, Terrain } from './Terrain'

/**
 * The TV world: the park terrain on a plane tilted back in CSS 3D, with decor, tokens, the
 * Star, the dice block and effects standing on it as billboards (counter-rotated so they
 * face the camera). The camera is one transform on the plane's parent; tokens hop with a
 * CSS transition across the ground and a keyframed arc above it. Static layers are memoized,
 * so a tick only touches tokens, the camera and effects.
 */

const TOKEN = 60
const TOKEN_H = TOKEN * (140 / 120)
/** The token's box: room above the head for the block, the bubble and coin bursts. */
const TOK_W = 220
const TOK_H = TOKEN_H + 190
const ARRIVE: Stage[] = ['land', 'event', 'shop', 'duelPick', 'star']
const TURN: Stage[] = ['roll', 'rolling', 'moving', 'fork', 'star', 'land', 'event', 'eventPick', 'shop', 'duelPick']

/** Ground offsets when several tokens share a space (world units). */
const SPREAD: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [[-24, 0], [24, 0]],
  3: [[-30, 4], [30, 4], [0, -12]],
  4: [[-34, 6], [34, 6], [-12, -12], [12, -12]],
}

// ---------------- building blocks ----------------

/** Billboard boxes reach this far below the ground (for squash and shadows under the feet). */
const BELOW = 16
/**
 * Chrome culls the plain (non-layer) contents of a 3D-turned box that paints nothing itself,
 * so every turned box paints an invisible wash.
 */
const WASH = 'rgba(255, 255, 255, 0.004)'

/**
 * Something standing on the plane at x, y, turned to face the camera. The turned box is
 * sized (w x h above the ground): Chrome culls 3D content that overflows a zero-size box.
 * It also paints WASH (see above).
 */
function Stand({ x, y, w, h, children, style, className }: { x: number; y: number; w: number; h: number; children: ReactNode; style?: CSSProperties; className?: string }) {
  return (
    <div className={className} style={{ position: 'absolute', left: x, top: y, width: 0, height: 0, transformStyle: 'preserve-3d', ...style }}>
      <Turn w={w} h={h}>{children}</Turn>
    </div>
  )
}

/** The camera-facing box itself, ground point at its bottom middle (minus BELOW). */
function Turn({ w, h, children }: { w: number; h: number; children: ReactNode }) {
  return (
    <div style={{ position: 'absolute', left: -w / 2, top: -h, width: w, height: h + BELOW, transformOrigin: `50% ${h}px`, transform: `rotateX(${-TILT}deg)`, background: WASH }}>
      {children}
    </div>
  )
}

/** Something lying flat on the ground, centered on x, y (classes animate the transform). */
function Flat({ x, y, size, children, className, z = 0.6, style }: { x: number; y: number; size: number; children: ReactNode; className?: string; z?: number; style?: CSSProperties }) {
  return (
    <div
      className={className}
      style={{ position: 'absolute', left: x, top: y, width: size, height: size, transform: `translate3d(-50%, -50%, ${z}px)`, ...style }}
    >
      {children}
    </div>
  )
}

/** Bottom-anchored content inside a Stand, centered, `lift` px above the ground. */
function Up({ w, lift = 0, children, className, style }: { w: number; lift?: number; children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div className={className} style={{ position: 'absolute', left: `calc(50% - ${w / 2}px)`, bottom: lift + BELOW, width: w, transformOrigin: '50% 100%', ...style }}>
      {children}
    </div>
  )
}

// ---------------- static layers ----------------

const WAVES: [number, number][] = [[120, 140], [1480, 160], [1520, 960], [60, 1050], [1460, 560], [700, 60], [1000, 1095], [30, 420], [1560, 300], [380, 70]]

const Waves = memo(function Waves() {
  return (
    <>
      {WAVES.map(([x, y], i) => (
        <div key={i} className="pw-wave" style={{ position: 'absolute', left: x - 30, top: y - 8, animationDelay: `${-i * 0.7}s` }}>
          <svg width={60} height={16} viewBox="0 0 60 16" aria-hidden><path d="M2 10 Q10 2 18 10 T34 10 T50 10 T58 8" fill="none" stroke="#FFFFFF" strokeWidth={4} strokeLinecap="round" opacity={0.85} /></svg>
        </div>
      ))}
    </>
  )
})

const Decor = memo(function Decor() {
  return (
    <>
      {PROPS.map((p, i) => {
        const d = SPRITES[p.k]
        const s = p.s ?? 1
        const w = (d.w + 16) * s
        return (
          <Stand key={i} x={p.x} y={p.y} w={w} h={(d.h + 8) * s}>
            <Up w={w} lift={-8 * s} className={p.k === 'boat' ? 'pw-boat' : undefined} style={p.k === 'boat' ? { animationDelay: `${-i * 0.9}s` } : undefined}>
              <SpriteSvg k={p.k} scale={s} flip={p.flip} />
            </Up>
          </Stand>
        )
      })}
    </>
  )
})

// ---------------- the dice block ----------------

function Block({ face, tone = 'q', size = 64 }: { face: string | number; tone?: 'q' | 'spin' | 'done'; size?: number }) {
  const front = tone === 'done' ? PARK.coral : tone === 'spin' ? '#FFFFFF' : PARK.sun
  const top = tone === 'done' ? '#FF8A7E' : tone === 'spin' ? '#F1F6FF' : '#FFE07A'
  const side = tone === 'done' ? PARK.coralDark : tone === 'spin' ? '#C9C4DA' : PARK.sunDark
  const fg = tone === 'spin' ? INK : '#FFFFFF'
  return (
    <svg viewBox="-4 -16 76 84" width={size * 1.12} height={size * 1.24} style={{ display: 'block', overflow: 'visible' }} aria-hidden>
      <path d="M4 0 L16 -12 L68 -12 L56 0 Z" fill={top} stroke={INK} strokeWidth={3.5} strokeLinejoin="round" />
      <path d="M56 0 L68 -12 L68 52 L56 64 Z" fill={side} stroke={INK} strokeWidth={3.5} strokeLinejoin="round" />
      <rect x={0} y={0} width={56} height={64} rx={9} fill={front} stroke={INK} strokeWidth={4} />
      <rect x={6} y={6} width={44} height={8} rx={4} fill="#FFFFFF" opacity={0.35} />
      <text x={28} y={47} textAnchor="middle" fontFamily="Lilita One, sans-serif" fontSize={tone === 'q' ? 42 : 40} fill={fg} stroke={INK} strokeWidth={tone === 'spin' ? 0 : 3} paintOrder="stroke">{face}</text>
    </svg>
  )
}

function Dice({ s, now }: { s: BoardState; now: number }) {
  if (s.stage === 'roll') {
    return (
      <div className="pw-block-wait" style={{ display: 'flex', justifyContent: 'center' }}>
        <Block face="?" />
      </div>
    )
  }
  if (s.stage !== 'rolling' || !s.roll) return null
  const t = Math.max(0, now - s.stageAt)
  const settle = Math.min(ROLLING_MS * 0.55, 760)
  const dice = s.roll.dice
  const settled = t >= settle || s.roll.kind === 'pick'
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
      {dice.map((v, i) => {
        const spin = 1 + ((Math.floor(t / 70) * 7 + i * 3) % 10)
        return (
          <div key={`${i}-${settled}`} className={settled ? 'pw-settle' : 'pw-block-spin'}>
            <Block face={settled ? v : spin} tone={settled ? 'done' : 'spin'} />
          </div>
        )
      })}
    </div>
  )
}

// ---------------- tokens ----------------

function StepBubble({ n }: { n: number }) {
  return (
    <div key={n} className="pw-pop" style={{ display: 'flex', justifyContent: 'center' }}>
      <div style={{ position: 'relative', minWidth: 52, height: 52, borderRadius: 999, background: '#FFFFFF', border: `4px solid ${INK}`, boxShadow: `0 4px 0 ${INK}`, display: 'grid', placeItems: 'center', padding: '0 8px' }}>
        <span className="font-party" style={{ fontSize: 34, lineHeight: 1, color: INK }}>{n}</span>
      </div>
    </div>
  )
}

function NameTag({ name, color, on }: { name: string; color: string; on: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <div className="font-party" style={{ whiteSpace: 'nowrap', fontSize: 17, lineHeight: 1, padding: '4px 9px 5px', borderRadius: 10, background: color, color: on, border: `3px solid ${INK}`, boxShadow: `0 3px 0 ${INK}` }}>
        {name}
      </div>
    </div>
  )
}

function CoinBurst({ delta, at }: { delta: number; at: number }) {
  const n = Math.min(10, Math.abs(delta))
  const up = delta > 0
  return (
    <div key={at} style={{ position: 'absolute', left: '50%', bottom: TOKEN_H - 8 + BELOW, width: 0, height: 0 }}>
      {Array.from({ length: n }, (_, i) => {
        const dx = ((i % 2 ? 1 : -1) * (16 + ((i * 23) % 50))) * (up ? 0.8 : 1.6)
        return (
          <div
            key={i}
            className={up ? 'pw-coin-up' : 'pw-coin-away'}
            style={{ position: 'absolute', left: -15, top: -15, animationDelay: `${i * 70}ms`, ['--dx' as string]: `${dx}px` }}
          >
            <Coin size={30} />
          </div>
        )
      })}
      <div className="pw-delta" style={{ position: 'absolute', left: -90, width: 180, bottom: 30, animationDelay: '120ms' }}>
        <svg viewBox="-90 -50 180 64" width={180} height={64} style={{ display: 'block', overflow: 'visible' }} aria-hidden>
          <text x={0} y={6} textAnchor="middle" fontFamily="Lilita One, sans-serif" fontSize={56} fill={INK} transform="translate(0 5)">{up ? `+${delta}` : `${delta}`}</text>
          <text x={0} y={6} textAnchor="middle" fontFamily="Lilita One, sans-serif" fontSize={56} fill={up ? PARK.coin : PARK.coral} stroke={INK} strokeWidth={9} strokeLinejoin="round" paintOrder="stroke">{up ? `+${delta}` : `${delta}`}</text>
        </svg>
      </div>
    </div>
  )
}

interface TokenView { id: string; space: number; x: number; y: number; mover: boolean; hops: number; faceLeft: boolean; stack: number; withMover: boolean }

function Token({ t, s, who, now, hopKey, layer }: { t: TokenView; s: BoardState; who: Who; now: number; hopKey: string | null; layer: 'ground' | 'stand' }) {
  const p = who(t.id)
  const c = critter(p.char)
  const moving = s.stage === 'moving' && t.mover
  const turn = TURN.includes(s.stage)
  const delta = s.stage === 'land' && s.notice?.delta ? s.notice.delta[t.id] ?? 0 : 0
  let mood: Mood = 'idle'
  if (s.stage === 'land' && s.notice) {
    if (s.notice.kind === 'star' && t.mover && (s.notice.delta?.[t.id] ?? 0) < 0) mood = 'happy'
    else if (delta > 0) mood = 'happy'
    else if (delta < 0) mood = 'sad'
  }
  const jumping = s.stage === 'rolling' && t.mover && now - s.stageAt < 520
  const left = moving && s.move ? s.move.path.length - t.hops + s.move.left : s.stage === 'fork' && t.mover ? s.move?.left ?? 0 : 0
  const showDice = t.mover && (s.stage === 'roll' || s.stage === 'rolling')
  const showBubble = t.mover && (moving || s.stage === 'fork') && left > 0
  return (
    <div
      data-world-token={layer === 'stand' ? t.id : undefined}
      data-space={layer === 'stand' ? t.space : undefined}
      style={{
        // Sized like its contents (a zero-size transformed box gets its 3D children culled).
        position: 'absolute', left: -TOK_W / 2, top: -TOK_H, width: TOK_W, height: TOK_H + BELOW, transformStyle: 'preserve-3d',
        transform: `translate3d(${t.x}px, ${t.y}px, 0)`,
        transition: moving ? `transform ${HOP_MS}ms linear` : 'transform 480ms cubic-bezier(0.3, 0.7, 0.3, 1.25)',
      }}
    >
      {/* ground: shadow, and the mover's ring */}
      {layer === 'ground' && t.mover && turn && (
        <div className="pw-you" style={{ position: 'absolute', left: TOK_W / 2, top: TOK_H, width: 78, height: 78, borderRadius: 999, border: `6px solid ${c?.color ?? PARK.coral}`, boxShadow: `0 0 0 3px ${INK}, inset 0 0 0 3px ${INK}` }} />
      )}
      {layer === 'ground' && <div key={hopKey ?? 'still'} className={hopKey ? 'pw-hop-shadow' : undefined} style={{ position: 'absolute', left: TOK_W / 2, top: TOK_H, width: 42, height: 16, borderRadius: 999, background: INK, opacity: 0.2, transform: 'translate3d(-50%, -50%, 0.6px)' }} />}
      {layer === 'stand' && <div style={{ position: 'absolute', inset: 0, transformOrigin: `50% ${TOK_H}px`, transform: `rotateX(${-TILT}deg)`, background: WASH }}>
        <Up w={TOKEN} lift={-TOKEN * (4 / 120)}>
          <div key={hopKey ?? (jumping ? 'jump' : 'still')} className={hopKey ? 'pw-hop' : jumping ? 'pw-jump' : undefined}>
            <CritterArt id={c?.id ?? 'chomp'} size={TOKEN} mood={jumping ? 'hop' : mood} anim={!hopKey && !jumping} flip={t.faceLeft} />
          </div>
        </Up>
        {showDice && (
          <Up w={200} lift={TOKEN_H + 16}>
            <Dice s={s} now={now} />
          </Up>
        )}
        {showBubble && (
          <Up w={120} lift={TOKEN_H + (moving ? 50 : 14)}>
            <StepBubble n={left} />
          </Up>
        )}
        {!showDice && !showBubble && delta === 0 && !(t.withMover && turn) && (
          <Up w={160} lift={TOKEN_H + 6 + t.stack * 26}>
            <NameTag name={p.name} color={c?.color ?? p.color} on={c?.on ?? INK} />
          </Up>
        )}
        {delta !== 0 && s.notice && <CoinBurst delta={delta} at={s.notice.at} />}
      </div>}
    </div>
  )
}

// ---------------- the Star ----------------

function StarGlow({ s }: { s: BoardState }) {
  const sp = SPACES[s.star]
  return (
    <Flat x={sp.x} y={sp.y} size={104} className="pw-glow" z={0.4}>
      <div style={{ width: '100%', height: '100%', borderRadius: 999, background: 'radial-gradient(circle, rgba(255,246,170,1) 0%, rgba(255,218,61,0.75) 42%, rgba(255,218,61,0) 70%)' }} />
    </Flat>
  )
}

function StarOnPedestal({ s }: { s: BoardState }) {
  const sp = SPACES[s.star]
  return (
    <Stand x={sp.x} y={sp.y + 2} w={110} h={130}>
      <Up w={70} key={s.starAt} className="pw-pop">
        <svg viewBox="-36 -28 72 36" width={70} height={35} style={{ display: 'block' }} aria-hidden>
          <path d="M-26 -18 V0 A26 7 0 0 0 26 0 V-18 Z" fill="#E9E4F2" stroke={INK} strokeWidth={3.5} strokeLinejoin="round" />
          <path d="M-26 -10 A26 7 0 0 0 26 -10" fill="none" stroke="#CFC8E0" strokeWidth={4} />
          <ellipse cx={0} cy={-18} rx={26} ry={7} fill={PARK.star} stroke={INK} strokeWidth={3.5} />
        </svg>
      </Up>
      <Up w={76} lift={22} key={`s${s.starAt}`} className="pw-pop-late">
        <div className="pw-float"><ParkStar size={76} /></div>
      </Up>
    </Stand>
  )
}

// ---------------- fork signposts ----------------

/** Where the fork signpost stands (beside the fork, clear of both lanes). */
const SIGN_AT: Record<number, [number, number]> = { 6: [502, 716], 26: [1098, 172] }

/** Pulsing rings on the first spaces of each lane (ground layer). */
function LaneRings({ pos }: { pos: number }) {
  const fork = SPACES[pos]
  return (
    <>
      {fork.next.map((n, i) => {
        const ids = [n, SPACES[n].next[0], SPACES[SPACES[n].next[0]].next[0]]
        return ids.map((id, j) => (
          <Flat key={`${n}-${id}`} x={SPACES[id].x} y={SPACES[id].y} size={70} className="pw-lane" z={0.9} style={{ animationDelay: `${j * 160}ms` }}>
            <div style={{ width: '100%', height: '100%', borderRadius: 999, border: `5px solid ${i === 0 ? PARK.sun : '#FFFFFF'}`, boxShadow: `0 0 0 2px ${INK}` }} />
          </Flat>
        ))
      })}
    </>
  )
}

/** One post, two boards: each names its lane and points along it (stand layer). */
function Signpost({ pos }: { pos: number }) {
  const fork = SPACES[pos]
  if (!fork.lanes) return null
  const place = LANE_PLACE[pos]
  const [x, y] = SIGN_AT[pos] ?? [fork.x + 60, fork.y - 50]
  const cos = Math.cos((TILT * Math.PI) / 180)
  // Long way on top, short cut under it.
  return (
    <Stand x={x} y={y} w={300} h={210}>
      <Up w={260} className="pw-sign">
        <div style={{ display: 'grid', justifyItems: 'center', gap: 6 }}>
          {fork.next.map((n, i) => {
            const a = SPACES[SPACES[n].next[0]]
            const ang = (Math.atan2((a.y - fork.y) * cos, a.x - fork.x) * 180) / Math.PI
            const label = fork.lanes![i]
            return (
              <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8, background: i === 0 ? PARK.sun : '#FFFFFF', border: `4px solid ${INK}`, borderRadius: 14, boxShadow: `0 4px 0 ${INK}`, padding: '6px 10px 6px 12px', transform: `rotate(${i === 0 ? -3 : 2}deg)` }}>
                <div style={{ display: 'grid', justifyItems: 'start' }}>
                  <span className="font-party" style={{ fontSize: 26, lineHeight: 1, color: INK, whiteSpace: 'nowrap' }}>{label.toUpperCase()}</span>
                  {place && <span style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.15, color: '#4A4566', whiteSpace: 'nowrap' }}>{place[i]}</span>}
                </div>
                <svg width={34} height={34} viewBox="-17 -17 34 34" style={{ transform: `rotate(${ang.toFixed(0)}deg)` }} aria-hidden>
                  <path d="M-13 -5 H1 V-12 L14 0 L1 12 V5 H-13 Z" fill={PARK.coral} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
                </svg>
              </div>
            )
          })}
          <div style={{ width: 12, height: 50, marginTop: -6, background: '#A8683A', borderLeft: `3px solid ${INK}`, borderRight: `3px solid ${INK}` }} />
        </div>
      </Up>
    </Stand>
  )
}

// ---------------- the clock ----------------

/** Host time that keeps advancing between the parent's ticks (for hops and the dice). */
function useLiveNow(now: number, fast: boolean): number {
  const offset = useMemo(() => now - Date.now(), [now])
  const [, force] = useState(0)
  useEffect(() => {
    if (!fast) return
    const iv = window.setInterval(() => force((n) => n + 1), 40)
    return () => window.clearInterval(iv)
  }, [fast])
  return Math.max(now, Date.now() + offset)
}

// ---------------- the scene ----------------

export function Scene3D({ s, who, now: nowProp, className }: { s: BoardState; who: Who; now: number; className?: string }) {
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 1280, h: 720 })
  useEffect(() => {
    const el = box.current
    if (!el) return
    const measure = () => {
      const w = el.clientWidth, h = el.clientHeight
      if (w > 0 && h > 0) setSize((o) => (o.w === w && o.h === h ? o : { w, h }))
    }
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    measure()
    return () => ro.disconnect()
  }, [])

  const now = useLiveNow(nowProp, s.stage === 'moving' || s.stage === 'rolling')
  const k = size.w / 1280
  const vh = size.h / k
  const mover = curId(s)
  const at = (id: string) => visualPos(s, id, now)
  const cam = chooseCamera(s, now, at, vh)
  const hops = hopsDone(s, now)

  // tokens: where each stands, spread when sharing a space
  const bySpace = new Map<number, string[]>()
  for (const id of s.order) if (s.chars[id]) bySpace.set(at(id), [...(bySpace.get(at(id)) ?? []), id])
  // Nobody stands on the board before they have picked a critter.
  const tokens: TokenView[] = s.order.filter((id) => s.chars[id]).map((id) => {
    const space = at(id)
    const here = bySpace.get(space) ?? [id]
    const [dx, dy] = here.length > 4 ? [0, 0] : (SPREAD[here.length] ?? SPREAD[1])[here.indexOf(id)] ?? [0, 0]
    const onStar = space === s.star
    const sp = SPACES[space]
    let faceLeft = false
    if (id === mover && s.stage === 'moving' && s.move && hops > 0) {
      const prev = hops === 1 ? s.move.from : s.move.path[hops - 2]
      faceLeft = SPACES[space].x < SPACES[prev].x - 4
    }
    return { id, space, x: sp.x + dx + (onStar ? 46 : 0), y: sp.y + dy + (onStar ? 8 : 0), mover: id === mover, hops: id === mover ? hops : 0, faceLeft, stack: here.indexOf(id), withMover: id !== mover && here.includes(mover) }
  })
  // draw far ones first (the browser sorts by depth too; this keeps ties stable)
  const drawn = [...tokens].sort((a, b) => a.y - b.y)

  const arrived = ARRIVE.includes(s.stage) && s.move && now - s.stageAt < 900
  const landSpace = arrived ? SPACES[visualPos(s, mover, now)] : null
  const starRecent = now - s.starAt < STAR_PAN_MS

  const camStyle: CSSProperties = {
    position: 'absolute', left: '50%', top: '54%', width: 0, height: 0, transformStyle: 'preserve-3d',
    transform: `scale(${(cam.zoom * k).toFixed(4)}) rotateX(${TILT}deg) translate(${(-cam.x).toFixed(1)}px, ${(-cam.y).toFixed(1)}px)`,
    transition: `transform ${cam.ms}ms ${cam.ease}`,
  }
  const forkPos = s.stage === 'fork' ? at(mover) : null
  const hopKeyOf = (t: TokenView) => (t.mover && s.stage === 'moving' && s.move ? `${s.move.at}-${hops}` : null)

  // Two stacked 3D views under the same camera: the ground (and everything lying on it),
  // then everything standing up. Billboards never sink into the ground this way (Chrome's
  // depth sort clips tall billboards behind the camera target against a big ground plane).
  return (
    <div ref={box} className={className} style={{ position: /\b(absolute|fixed|relative|sticky)\b/.test(className ?? '') ? undefined : 'relative', overflow: 'hidden', background: `linear-gradient(180deg, ${SEA_DEEP} 0%, ${SEA} 38%, ${SEA} 100%)` }} data-world-cam={cam.mode}>
      <View k={k} cam={camStyle}>
        <div style={{ position: 'absolute', left: 0, top: 0 }}>
          <Terrain star={s.star} />
        </div>
        <Waves />
        {landSpace && (
          <>
            <Flat key={`f${s.stageAt}`} x={landSpace.x} y={landSpace.y} size={64} className="pw-flash-disc" z={0.5}>
              <div style={{ width: '100%', height: '100%', borderRadius: 999, background: '#FFFFFF' }} />
            </Flat>
            <Flat key={`r${s.stageAt}`} x={landSpace.x} y={landSpace.y} size={70} className="pw-flash" z={1}>
              <div style={{ width: '100%', height: '100%', borderRadius: 999, border: `8px solid ${SPACE_COLOR[landSpace.kind]}`, boxShadow: `0 0 0 3px ${INK}` }} />
            </Flat>
          </>
        )}
        <StarGlow s={s} />
        {forkPos !== null && <LaneRings pos={forkPos} />}
        {drawn.map((t) => <Token key={t.id} t={t} s={s} who={who} now={now} hopKey={hopKeyOf(t)} layer="ground" />)}
      </View>
      <View k={k} cam={camStyle}>
        <Decor />
        <StarOnPedestal s={s} key={starRecent ? `star-${s.starAt}` : 'star'} />
        {forkPos !== null && <Signpost pos={forkPos} />}
        {drawn.map((t) => <Token key={t.id} t={t} s={s} who={who} now={now} hopKey={hopKeyOf(t)} layer="stand" />)}
      </View>
    </div>
  )
}

/** One perspective view of the world plane under the camera transform. */
function View({ k, cam, children }: { k: number; cam: CSSProperties; children: ReactNode }) {
  return (
    <div style={{ position: 'absolute', inset: 0, perspective: `${PERSPECTIVE * k}px`, perspectiveOrigin: '50% 54%', pointerEvents: 'none' }}>
      <div style={cam}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: WORLD_W, height: WORLD_H, transformStyle: 'preserve-3d' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
