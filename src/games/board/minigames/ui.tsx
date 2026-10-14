import { useEffect, useLayoutEffect, useRef, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react'
import type { MgRun } from '../logic'
import type { Who } from '../view'
import { cx } from '../../../ui/kit'
import { useTicker } from '../../../engine/context'
import { CAST_IDS, CritterArt, INK, critter, type CritterId, type Mood } from '../park/cast'
import { PARK, Portrait, SKY_BG } from '../park/ui'
import { minigame } from './registry'

/**
 * The Party Park frame every minigame draws in. TV: a little scene under the park sky with
 * a sticker title plate and a clock. Phone: a title plate, a chunky timer, then giant park
 * buttons. Everything on a light surface is one ink (#1E1838). Motion classes are mg-* (below).
 */

export interface MgViewProps<S> {
  s: S
  run: MgRun
  who: Who
  now: () => number
  /** Phone in apart mode: the pad sits right below, keep this tiny. */
  compact: boolean
}

export interface MgPadProps<S> {
  s: S
  run: MgRun
  me: string
  who: Who
  now: () => number
  send: (type: string, payload?: unknown) => void
}

/** Keep the latest value in a ref without reading refs during render. */
export function useLatest<T>(v: T) {
  const r = useRef(v)
  useLayoutEffect(() => { r.current = v })
  return r
}

/** Run fn every animation frame while mounted. */
export function useFrame(fn: (t: number) => void) {
  const f = useLatest(fn)
  useEffect(() => {
    let raf = 0
    const loop = (t: number) => { f.current(t); raf = requestAnimationFrame(loop) }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [f])
}

/** A short buzz on phones that have it. */
export function buzz(ms: number | number[] = 12) {
  try { if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(ms) } catch { /* ignore */ }
}

// ---------------- motion ----------------

const CSS = `
@keyframes mg-pop { 0% { transform: scale(.4); opacity: 0 } 60% { transform: scale(1.14); opacity: 1 } 80% { transform: scale(.95) } 100% { transform: scale(1) } }
@keyframes mg-in { 0% { transform: translateY(24px) scale(.9); opacity: 0 } 70% { transform: translateY(-4px) scale(1.03); opacity: 1 } 100% { transform: none } }
@keyframes mg-shake { 0%, 100% { transform: translateX(0) } 20% { transform: translateX(-10px) rotate(-2deg) } 40% { transform: translateX(9px) rotate(2deg) } 60% { transform: translateX(-6px) } 80% { transform: translateX(4px) } }
@keyframes mg-beat { 0% { transform: translateY(0) scale(1.12, .86) } 35% { transform: translateY(-9%) scale(.94, 1.07) } 100% { transform: translateY(0) scale(1, 1) } }
@keyframes mg-pose { 0% { transform: translateY(0) scale(1.15, .82) } 30% { transform: translateY(-22%) scale(.9, 1.12) rotate(-6deg) } 65% { transform: translateY(-12%) rotate(4deg) } 100% { transform: translateY(0) scale(1) } }
@keyframes mg-thump { 0% { transform: scale(1.18) } 100% { transform: scale(1) } }
@keyframes mg-flash { 0% { opacity: 1 } 100% { opacity: 0 } }
@keyframes mg-rise { 0% { transform: translateY(0) scale(.7); opacity: 0 } 15% { opacity: 1; transform: translateY(-10px) scale(1.1) } 100% { transform: translateY(-80px) scale(1); opacity: 0 } }
@keyframes mg-wobble { 0%, 100% { transform: rotate(-4deg) } 50% { transform: rotate(4deg) } }
@keyframes mg-jitter { 0%, 100% { transform: translate(0, 0) rotate(0) } 25% { transform: translate(-3px, 1px) rotate(-3deg) } 50% { transform: translate(2px, -2px) rotate(2deg) } 75% { transform: translate(3px, 2px) rotate(-1deg) } }
@keyframes mg-spark { 0%, 100% { transform: scale(1) rotate(0) } 50% { transform: scale(1.35) rotate(25deg) } }
@keyframes mg-drift { 0% { transform: translateX(0) } 100% { transform: translateX(60px) } }
@keyframes mg-spin { to { transform: rotate(360deg) } }
@keyframes mg-pulse { 0%, 100% { transform: scale(1) } 50% { transform: scale(1.05) } }
.mg-pop { animation: mg-pop 420ms cubic-bezier(.2,.9,.3,1.3) both }
.mg-in { animation: mg-in 380ms cubic-bezier(.2,.9,.3,1.2) both }
.mg-shake { animation: mg-shake 380ms ease-out both }
.mg-beat { animation: mg-beat 260ms cubic-bezier(.3,.8,.4,1) both }
.mg-pose { animation: mg-pose 460ms cubic-bezier(.3,.8,.4,1) both }
.mg-thump { animation: mg-thump 180ms ease-out both }
.mg-flash { animation: mg-flash 420ms ease-out both }
.mg-rise { animation: mg-rise 900ms ease-out both }
.mg-wobble { animation: mg-wobble .5s ease-in-out infinite }
.mg-jitter { animation: mg-jitter .22s linear infinite }
.mg-spark { animation: mg-spark .3s ease-in-out infinite }
.mg-drift { animation: mg-drift 14s ease-in-out infinite alternate }
.mg-spin { animation: mg-spin 1.2s linear infinite }
.mg-pulse { animation: mg-pulse .7s ease-in-out infinite }
.mg-press { transition: transform 70ms ease-out, box-shadow 70ms ease-out }
.mg-press:not(:disabled):active { transform: translateY(7px) scale(.985) }
`

/** The mg-* keyframes. Rendered by the shells (a duplicate style tag is harmless). */
export function MgStyles() {
  return <style>{CSS}</style>
}

// ---------------- who looks like what ----------------

/** The critter a player plays as (falls back to a stable cast member before they pick). */
export function charOf(who: Who, id: string, players: string[] = []): CritterId {
  const c = who(id).char
  if (c) return c
  const k = Math.max(0, players.indexOf(id))
  return CAST_IDS[k % CAST_IDS.length]
}

/** The critter's main color (name tags, progress fills). */
export function colorOf(who: Who, id: string, players: string[] = []): string {
  return critter(charOf(who, id, players))?.color ?? PARK.sun
}

export function sideOf(run: MgRun, id: string): string | undefined {
  if (run.format !== '1v2') return undefined
  return id === run.solo ? 'Solo' : 'Team'
}

/** A pill with the player's name in their critter color, plus SOLO / TEAM in 1 vs 2. */
export function NameTag({ id, who, run, size = 26, className }: { id: string; who: Who; run?: MgRun; size?: number; className?: string }) {
  const c = critter(charOf(who, id, run?.players))
  const side = run ? sideOf(run, id) : undefined
  return (
    <span className={cx('inline-flex max-w-full items-center gap-1.5', className)}>
      <span
        className="truncate rounded-full border-[3px] px-3 font-party leading-tight"
        style={{ fontSize: size, borderColor: INK, background: c?.color ?? PARK.white, color: c?.on ?? INK, boxShadow: `0 3px 0 ${INK}` }}
      >
        {who(id).name}
      </span>
      {side && (
        <span className="rounded-full border-[3px] px-2 font-party leading-tight" style={{ fontSize: size * 0.62, borderColor: INK, background: side === 'Solo' ? PARK.coral : PARK.blue, color: '#fff' }}>
          {side.toUpperCase()}
        </span>
      )}
    </span>
  )
}

/** A critter standing on the scene with a soft ground shadow. */
export function Standee({ id, who, players, mood = 'idle', size = 120, flip = false, anim = true, className, style, shadow = true }: {
  id: string; who: Who; players?: string[]; mood?: Mood; size?: number; flip?: boolean; anim?: boolean; className?: string; style?: CSSProperties; shadow?: boolean
}) {
  return (
    <div className={cx('relative grid justify-items-center', className)} style={style}>
      {shadow && <div className="absolute rounded-[50%]" style={{ bottom: size * 0.01, width: size * 0.7, height: size * 0.12, background: 'rgba(30,24,56,.22)' }} />}
      <CritterArt id={charOf(who, id, players)} mood={mood} size={size} flip={flip} anim={anim} className="relative" />
    </div>
  )
}

// ---------------- scenery ----------------

export type Ground = 'grass' | 'sand' | 'boardwalk' | 'stage' | 'pavement'

const GROUND: Record<Ground, { fill: string; edge: string; dots?: string }> = {
  grass: { fill: PARK.grass, edge: PARK.grassDark, dots: '#5CC24D' },
  sand: { fill: PARK.sand, edge: PARK.sandDark, dots: '#F5CF85' },
  boardwalk: { fill: '#E0A764', edge: '#B97B3C' },
  stage: { fill: '#3B2F6B', edge: '#251C4C' },
  pavement: { fill: '#F3E6CF', edge: '#D7C29C', dots: '#E8D6B6' },
}

/** Sky, a couple of drifting clouds, and the ground from `horizon` (% from the top) down. */
export function SceneBg({ ground = 'grass', horizon = 64, sea = false }: { ground?: Ground; horizon?: number; sea?: boolean }) {
  const g = GROUND[ground]
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden style={{ background: SKY_BG }}>
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1280 720" preserveAspectRatio="none">
        <circle cx="1140" cy="70" r="150" fill="#FFF6C8" opacity=".55" />
        <circle cx="1140" cy="70" r="92" fill="#FFE27A" />
        {sea && <rect x="0" y={(horizon / 100) * 720 - 46} width="1280" height="60" fill={PARK.sea} />}
        {sea && <path d={`M0 ${(horizon / 100) * 720 - 40} q40 -10 80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0`} fill="none" stroke={PARK.foam} strokeWidth="4" opacity=".8" />}
        <rect x="0" y={(horizon / 100) * 720} width="1280" height="720" fill={g.fill} />
        <rect x="0" y={(horizon / 100) * 720} width="1280" height="10" fill={g.edge} />
        {ground === 'boardwalk' && Array.from({ length: 9 }, (_, i) => (
          <rect key={i} x="0" y={(horizon / 100) * 720 + 34 + i * 42} width="1280" height="4" fill={g.edge} opacity=".55" />
        ))}
        {ground === 'stage' && Array.from({ length: 14 }, (_, i) => (
          <rect key={i} x={i * 96} y={(horizon / 100) * 720} width="3" height="400" fill={g.edge} />
        ))}
        {g.dots && Array.from({ length: 26 }, (_, i) => (
          <ellipse key={i} cx={(i * 263) % 1280} cy={(horizon / 100) * 720 + 40 + ((i * 97) % 220)} rx="22" ry="5" fill={g.dots} />
        ))}
      </svg>
      <div className="mg-drift absolute" style={{ left: 90, top: 30 }}><Cloud w={170} /></div>
      <div className="mg-drift absolute" style={{ left: 560, top: 70, animationDelay: '-6s' }}><Cloud w={120} /></div>
    </div>
  )
}

function Cloud({ w }: { w: number }) {
  return (
    <svg width={w} height={w * 0.45} viewBox="0 0 100 45" aria-hidden>
      <path d="M14 40 C2 40 2 26 14 25 C14 13 32 9 38 19 C42 6 64 4 68 20 C78 14 92 20 88 32 C98 34 96 42 86 40 Z" fill="#fff" opacity=".92" />
    </svg>
  )
}

/** A starburst (behind a big moment). */
export function Burst({ size = 200, color = PARK.sun, className, style }: { size?: number; color?: string; className?: string; style?: CSSProperties }) {
  const pts: string[] = []
  for (let i = 0; i < 24; i++) {
    const a = (i * Math.PI) / 12
    const r = i % 2 === 0 ? 48 : 34
    pts.push(`${(50 + Math.cos(a) * r).toFixed(1)},${(50 + Math.sin(a) * r).toFixed(1)}`)
  }
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} style={style} aria-hidden>
      <polygon points={pts.join(' ')} fill={color} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
    </svg>
  )
}

/** A speech bubble sticker with a tail pointing down. */
export function Bubble({ children, className, style, tone = PARK.white, small = false }: { children: ReactNode; className?: string; style?: CSSProperties; tone?: string; small?: boolean }) {
  return (
    <div className={cx('relative inline-block', className)} style={style}>
      <div className={cx('rounded-2xl border-[3px] font-party leading-none', small ? 'px-2.5 py-1 text-xl' : 'px-4 py-2 text-3xl')} style={{ borderColor: INK, background: tone, color: tone.toLowerCase() === '#fff' || tone === PARK.white || tone === PARK.sun ? INK : '#fff', boxShadow: `0 4px 0 ${INK}` }}>
        {children}
      </div>
      <svg className="absolute left-1/2 -translate-x-1/2" style={{ bottom: small ? -10 : -13 }} width={small ? 18 : 24} height={small ? 12 : 15} viewBox="0 0 24 15" aria-hidden>
        <path d="M2 0 L12 13 L22 0" fill={tone} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
        <rect x="3" y="-3" width="18" height="4" fill={tone} />
      </svg>
    </div>
  )
}

// ---------------- TV ----------------

const FORMAT_TAG: Record<string, { text: string; bg: string; fg: string }> = {
  ffa: { text: 'FREE FOR ALL', bg: PARK.sun, fg: INK },
  '1v2': { text: '1 VS 2', bg: PARK.coral, fg: '#fff' },
  coop: { text: 'CO-OP VS THE HOUSE', bg: PARK.blue, fg: '#fff' },
  duel: { text: 'DUEL', bg: PARK.coral, fg: '#fff' },
}

/**
 * TV frame for a minigame: the scene fills the box, a sticker title plate top left, the
 * clock (or round) top right. `ground` / `horizon` set the scenery, `backdrop` replaces it,
 * `bare` skips it.
 */
export function TvShell({ run, title, right, children, ground = 'grass', horizon = 64, sea = false, bare = false, backdrop }: {
  run: MgRun; title: string; right?: ReactNode; children: ReactNode; ground?: Ground; horizon?: number; sea?: boolean; bare?: boolean
  /** A custom full-frame backdrop (drawn behind the title plate) instead of the stock scenery. */
  backdrop?: ReactNode
}) {
  const tag = FORMAT_TAG[run.format] ?? FORMAT_TAG.ffa
  const m = minigame(run.id)
  const note = run.format === 'coop' ? m?.coopGoal && `Goal: ${m.coopGoal}` : run.format === '1v2' ? m?.soloRule : undefined
  return (
    <div className="relative h-full min-h-0 overflow-hidden" style={{ color: INK }}>
      <MgStyles />
      {backdrop ? <div className="pointer-events-none absolute inset-0">{backdrop}</div> : !bare && <SceneBg ground={ground} horizon={horizon} sea={sea} />}
      <div className="relative z-10 flex h-full min-h-0 flex-col">
        <div className="flex items-start justify-between gap-6 px-7 pt-5">
          <div className="mg-in min-w-0 rounded-[22px] border-4 bg-white px-5 pb-3 pt-2" style={{ borderColor: INK, boxShadow: `0 6px 0 ${INK}` }}>
            <span className="inline-block rounded-full border-[3px] px-3 py-0.5 font-party text-lg leading-tight" style={{ borderColor: INK, background: tag.bg, color: tag.fg }}>{tag.text}</span>
            <div className="truncate font-party text-[52px] leading-[1.05]">{title}</div>
            {note && <div className="max-w-[640px] text-xl font-bold leading-snug" style={{ color: PARK.ink2 }}>{note}</div>}
          </div>
          {right && <div className="mg-in shrink-0">{right}</div>}
        </div>
        <div className="relative min-h-0 flex-1">{children}</div>
      </div>
    </div>
  )
}

/** A round sticker with a label and a big number (round counters, scores, bpm). */
export function TvBadge({ label, value, tone = PARK.white, hot = false }: { label: string; value: ReactNode; tone?: string; hot?: boolean }) {
  return (
    <div className="grid min-w-[128px] justify-items-center rounded-[22px] border-4 px-4 pb-2 pt-1" style={{ borderColor: INK, background: hot ? PARK.coral : tone, color: hot ? '#fff' : INK, boxShadow: `0 6px 0 ${INK}` }}>
      <span className="font-party text-lg uppercase leading-tight opacity-80">{label}</span>
      <span className="font-party text-6xl leading-none tabular">{value}</span>
    </div>
  )
}

/** Big seconds left, for the TV: a sticker that turns coral and thumps in the last three. */
export function TvClock({ endsAt, now, label = 'Left' }: { endsAt: number; now: () => number; label?: string }) {
  useTicker(100)
  const left = Math.max(0, endsAt - now())
  const sec = Math.ceil(left / 1000)
  const hot = left > 0 && left <= 3000
  return (
    <div key={hot ? sec : 'calm'} className={hot ? 'mg-thump' : undefined}>
      <TvBadge label={label} value={sec} hot={hot} />
    </div>
  )
}

/** A row per player on the TV: critter portrait, name tag, then whatever you put on the right. */
export function TvRow({ id, who, children, dim = false, side, mood = 'idle' }: { id: string; who: Who; children?: ReactNode; dim?: boolean; side?: string; mood?: Mood }) {
  const p = who(id)
  return (
    <div className={cx('flex items-center gap-4 rounded-[22px] border-4 bg-white px-4 py-2.5', dim && 'opacity-55')} style={{ borderColor: INK, boxShadow: `0 5px 0 ${INK}`, color: INK }}>
      <Portrait char={p.char} name={p.name} size={60} mood={mood} dim={dim} />
      <div className="w-48 min-w-0">
        <div className="truncate font-party text-3xl leading-tight">{p.name}</div>
        {side && <div className="font-party text-base uppercase" style={{ color: side === 'Solo' ? PARK.coral : PARK.blue }}>{side}</div>}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

/** The compact (apart phone) one-liner: a small white sticker. */
export function CompactLine({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border-[3px] bg-white px-3 py-1.5 text-sm font-bold leading-snug" style={{ borderColor: INK, color: INK }}>{children}</div>
  )
}

// ---------------- phone ----------------

/** A chunky draining timer bar with the seconds. */
export function ParkTimer({ endsAt, total, now }: { endsAt: number; total: number; now: () => number }) {
  useTicker(100)
  const left = Math.max(0, endsAt - now())
  const frac = total > 0 ? Math.min(1, left / total) : 0
  const sec = Math.ceil(left / 1000)
  const urgent = sec <= 3 && left > 0
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-6 flex-1 overflow-hidden rounded-full border-[3px] bg-white" style={{ borderColor: INK }}>
        <div className="h-full rounded-full transition-[width] duration-100 ease-linear" style={{ width: `${frac * 100}%`, background: urgent ? PARK.coral : PARK.sun, boxShadow: `inset 0 -5px 0 ${urgent ? PARK.coralDark : PARK.sunDark}` }} />
      </div>
      <span key={urgent ? sec : 'n'} className={cx('grid h-11 w-11 place-items-center rounded-full border-[3px] font-party text-2xl tabular', urgent && 'mg-thump')} style={{ borderColor: INK, background: urgent ? PARK.coral : '#fff', color: urgent ? '#fff' : INK }}>{sec}</span>
    </div>
  )
}

/** Phone frame: a title plate (name, one line of how), the timer, then the pad. */
export function PadShell({ title, sub, endsAt, total, now, children }: { title: string; sub?: string; endsAt?: number; total?: number; now: () => number; children: ReactNode }) {
  return (
    <div className="grid gap-3 p-4" style={{ color: INK }}>
      <MgStyles />
      <div className="rounded-[20px] border-4 bg-white px-4 py-2.5" style={{ borderColor: INK, boxShadow: `0 5px 0 ${INK}` }}>
        <div className="truncate font-party text-[28px] leading-tight">{title}</div>
        {sub && <div className="text-[17px] font-bold leading-snug" style={{ color: PARK.ink2 }}>{sub}</div>}
      </div>
      {endsAt !== undefined && total !== undefined && <ParkTimer endsAt={endsAt} total={total} now={now} />}
      {children}
    </div>
  )
}

/**
 * The giant pad button: a colored toy face, a darker edge underneath, ink outline, presses
 * down on touch. `face` = fill, `edge` = the side. Pass data-* and handlers through.
 */
export function ParkPad({ face = PARK.white, edge, className, style, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { face?: string; edge?: string }) {
  return (
    <button
      type="button"
      {...rest}
      className={cx('mg-press touch-none-all no-select relative rounded-[30px] border-4', className)}
      style={{ borderColor: INK, background: face, color: INK, boxShadow: `0 8px 0 ${edge ?? shade(face)}, 0 8px 0 4px ${INK}`, ...style }}
    >
      {children}
    </button>
  )
}

/** A darker version of a hex color, for button edges. */
export function shade(hex: string, k = 0.72): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return '#C9C4DA'
  const n = parseInt(m[1], 16)
  const ch = (v: number) => Math.round(v * k).toString(16).padStart(2, '0')
  return `#${ch((n >> 16) & 255)}${ch((n >> 8) & 255)}${ch(n & 255)}`
}

/** "You vs them" line for a phone. */
export function myRole(run: MgRun, me: string, who: Who): string | undefined {
  const others = run.players.filter((id) => id !== me)
  const list = others.map((id) => who(id).name)
  const join = (w: string[]) => (w.length <= 1 ? w.join('') : `${w.slice(0, -1).join(', ')} and ${w[w.length - 1]}`)
  if (run.format === '1v2') return me === run.solo ? `You, alone, vs ${join(list)}` : `You and ${join(run.players.filter((id) => id !== me && id !== run.solo).map((id) => who(id).name))} vs ${who(run.solo!).name}`
  if (run.format === 'coop') return 'Everyone together vs the House'
  if (run.format === 'duel') return `Duel vs ${join(list)}`
  return undefined
}

export function Big({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return <div className={cx('font-party leading-none tabular', className)} style={style}>{children}</div>
}
