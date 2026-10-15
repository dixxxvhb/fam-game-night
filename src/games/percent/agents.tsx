import type { ReactNode } from 'react'
import type { RoomPlayer } from '../../engine/types'
import { cx } from '../../ui/kit'
import { OP, STENCIL, TYPE } from './look'

/**
 * The agents. Every player is drawn as an agency mugshot (head and shoulders, suit, a tie in
 * their color). Hair, hat and skin come from a hash of their id so each player always looks
 * the same. The Spy wears the dark glasses. Moods: idle, win (smirk), lose (sweating).
 */

export type AgentMood = 'idle' | 'win' | 'lose'

function hash(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

const SKIN = ['#E8C29C', '#C8916B', '#9B6644', '#F0D0B0', '#B27A52']
const SKIN_SHADE = ['#CFA47E', '#AD7653', '#7F5034', '#D9B592', '#956240']
const HAIR = ['#2A1D15', '#56351F', '#161616', '#8A5A2B', '#B9894E', '#3B2A20']

/** Fixed looks for the three regulars, so nobody gets a random hat. */
const FIXED: Record<string, { hair: number; style: number; skin: number }> = {
  johnnyboy: { hair: 2, style: 3, skin: 0 },
  dixxx: { hair: 1, style: 0, skin: 3 },
  torii: { hair: 0, style: 1, skin: 1 },
}

export function look(id: string) {
  const f = FIXED[id]
  if (f) return f
  const h = hash(id)
  return { hair: h % HAIR.length, style: (h >> 4) % 4, skin: (h >> 8) % SKIN.length }
}

const LINE = OP.ink
const SW = 2.6

/** Head and shoulders in a 100 x 100 box. */
export function AgentFace({ id, color, spy = false, mood = 'idle', size = 64, className }: {
  id: string; color: string; spy?: boolean; mood?: AgentMood; size?: number; className?: string
}) {
  const lk = look(id)
  const skin = SKIN[lk.skin]
  const shade = SKIN_SHADE[lk.skin]
  const hair = HAIR[lk.hair]
  const hat = lk.style === 2
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={cx('shrink-0', className)} aria-hidden>
      {/* long hair sits behind the head */}
      {lk.style === 1 && (
        <path d="M29 58 C24 30 36 15 51 15 C67 15 77 29 71 58 C69 66 64 68 60 66 L40 66 C35 68 31 66 29 58 Z" fill={hair} stroke={LINE} strokeWidth={SW} strokeLinejoin="round" />
      )}
      {/* suit */}
      <path d="M6 101 C8 80 22 70 50 69 C78 70 92 80 94 101 Z" fill="#2A2C33" stroke={LINE} strokeWidth={SW} strokeLinejoin="round" />
      {/* shirt + tie */}
      <path d="M39 70 L50 94 L61 70 Z" fill="#F5F1E6" stroke={LINE} strokeWidth={SW * 0.8} strokeLinejoin="round" />
      <path d="M47 75 L53 75 L55.5 91 L50 98 L44.5 91 Z" fill={color} stroke={LINE} strokeWidth={SW * 0.8} strokeLinejoin="round" />
      <path d="M46.5 71 L53.5 71 L52.5 76 L47.5 76 Z" fill={color} stroke={LINE} strokeWidth={SW * 0.8} strokeLinejoin="round" />
      {/* lapels */}
      <path d="M38 70 L46 92 L36 82 L40 78 L33 74 Z" fill="#363944" stroke={LINE} strokeWidth={SW * 0.7} strokeLinejoin="round" />
      <path d="M62 70 L54 92 L64 82 L60 78 L67 74 Z" fill="#363944" stroke={LINE} strokeWidth={SW * 0.7} strokeLinejoin="round" />
      {/* earpiece wire for the Spy */}
      {spy && <path d="M68 47 C74 56 70 64 63 71" fill="none" stroke="#D9D4C6" strokeWidth="1.6" strokeLinecap="round" />}
      {/* neck */}
      <path d="M42 56 L42 70 C46 73 54 73 58 70 L58 56 Z" fill={shade} stroke={LINE} strokeWidth={SW * 0.8} />
      {/* ears */}
      <ellipse cx="32.5" cy="45" rx="4" ry="5.5" fill={skin} stroke={LINE} strokeWidth={SW * 0.8} />
      <ellipse cx="67.5" cy="45" rx="4" ry="5.5" fill={skin} stroke={LINE} strokeWidth={SW * 0.8} />
      {/* head */}
      <path d="M33 40 C33 25 41 19 50 19 C59 19 67 25 67 40 C67 54 60 63 50 63 C40 63 33 54 33 40 Z" fill={skin} stroke={LINE} strokeWidth={SW} />
      {/* hair */}
      {lk.style === 0 && (
        <path d="M32 40 C29 22 42 14 54 16 C65 18 71 27 68 41 C66 33 61 28 53 27 C49 31 41 30 36 29 C34 32 33 36 32 40 Z" fill={hair} stroke={LINE} strokeWidth={SW} strokeLinejoin="round" />
      )}
      {lk.style === 1 && (
        <path d="M32 44 C30 26 41 17 52 18 C63 19 70 28 68 44 C64 34 58 29 50 28 C46 33 38 36 32 44 Z" fill={hair} stroke={LINE} strokeWidth={SW} strokeLinejoin="round" />
      )}
      {lk.style === 3 && (
        <path d="M33.5 37 C33 24 41 18 50 18 C59 18 67 24 66.5 37 C63 30 57 27 50 27 C43 27 37 30 33.5 37 Z" fill={hair} stroke={LINE} strokeWidth={SW} strokeLinejoin="round" />
      )}
      {hat && (
        <g stroke={LINE} strokeWidth={SW} strokeLinejoin="round">
          <path d="M37 29 C36 17 42 11 50 11 C58 11 64 17 63 29 Z" fill="#3E3830" />
          <path d="M37.5 25 L62.5 25 L63 29.5 L37 29.5 Z" fill="#141210" />
          <path d="M22 31 C30 26 70 26 78 31 C70 35 30 35 22 31 Z" fill="#3E3830" />
          <path d="M45 14 C48 16 52 16 55 14" fill="none" strokeWidth={SW * 0.7} />
        </g>
      )}
      {/* brows */}
      {mood === 'lose' ? (
        <g stroke={LINE} strokeWidth={SW} strokeLinecap="round">
          <path d="M38 34 L46 31.5" /><path d="M62 34 L54 31.5" />
        </g>
      ) : mood === 'win' && !spy ? (
        <g stroke={LINE} strokeWidth={SW} strokeLinecap="round">
          <path d="M38 33 L46 33" /><path d="M54 31 L62 33" />
        </g>
      ) : !spy ? (
        <g stroke={LINE} strokeWidth={SW} strokeLinecap="round">
          <path d="M38 33 L46 32" /><path d="M54 32 L62 33" />
        </g>
      ) : null}
      {/* eyes */}
      {spy ? (
        <g>
          <path d="M34 36 L66 36" stroke={LINE} strokeWidth="2.6" />
          <path d="M35 36 L47.5 36 L46.5 44 C46 46.5 44 47.5 41.5 47.5 C38 47.5 36 46 35.5 43 Z" fill="#101114" stroke={LINE} strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M65 36 L52.5 36 L53.5 44 C54 46.5 56 47.5 58.5 47.5 C62 47.5 64 46 64.5 43 Z" fill="#101114" stroke={LINE} strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M38 38.5 L42 38.5" stroke="#FFFFFF" strokeOpacity="0.7" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M55.5 38.5 L59.5 38.5" stroke="#FFFFFF" strokeOpacity="0.7" strokeWidth="1.6" strokeLinecap="round" />
        </g>
      ) : (
        <g fill={LINE}>
          <ellipse cx="42" cy="40" rx="2.3" ry={mood === 'win' ? 1.4 : 2.6} />
          <ellipse cx="58" cy="40" rx="2.3" ry={mood === 'win' ? 1.4 : 2.6} />
        </g>
      )}
      {/* nose */}
      <path d="M50 42 L48 50 L51.5 50.5" fill="none" stroke={LINE} strokeWidth={SW * 0.7} strokeLinecap="round" strokeLinejoin="round" />
      {/* mouth */}
      {mood === 'win' ? (
        <path d="M43 55 C47 57.5 53 57.5 58 53" fill="none" stroke={LINE} strokeWidth={SW} strokeLinecap="round" />
      ) : mood === 'lose' ? (
        <path d="M44 57.5 C47 54.5 53 54.5 56 57.5" fill="none" stroke={LINE} strokeWidth={SW} strokeLinecap="round" />
      ) : (
        <path d="M45 55.5 L55 55" fill="none" stroke={LINE} strokeWidth={SW} strokeLinecap="round" />
      )}
      {/* sweat */}
      {mood === 'lose' && (
        <path className="pc-sweat" d="M70 26 C68 30 67 32 67 33.5 C67 35.5 68.5 36.5 70 36.5 C71.5 36.5 73 35.5 73 33.5 C73 32 72 30 70 26 Z" fill="#8FD0FF" stroke={LINE} strokeWidth="1.4" />
      )}
    </svg>
  )
}

/** A square mugshot photo: the face on a height-chart backdrop, ringed in the player color. */
export function Mugshot({ p, spy = false, mood = 'idle', size = 56, className }: { p: RoomPlayer | undefined; spy?: boolean; mood?: AgentMood; size?: number; className?: string }) {
  const color = p?.color ?? '#888'
  return (
    <span
      className={cx('relative inline-block shrink-0 overflow-hidden', className)}
      style={{
        width: size,
        height: size,
        borderRadius: Math.max(3, size * 0.08),
        background: 'repeating-linear-gradient(180deg, #CFC7B3 0 9%, #BDB49E 9% 10%)',
        boxShadow: `0 0 0 ${Math.max(2, size * 0.05)}px ${color}, 0 0 0 ${Math.max(3, size * 0.05) + 1.5}px ${OP.ink}`,
      }}
      aria-hidden
    >
      <AgentFace id={p?.id ?? '?'} color={color} spy={spy} mood={mood} size={size} className="absolute inset-0" />
    </span>
  )
}

/** A short agent number from the id: "AGENT 041". Stable per player. */
export function agentNo(id: string): string {
  const fixed: Record<string, string> = { johnnyboy: '007', dixxx: '013', torii: '022' }
  return fixed[id] ?? String(hash(id) % 900 + 100)
}

/**
 * The laminated agency ID badge: color strip, mugshot, typed name, role, barcode, and an
 * optional right side (score). Used on the TV roster and on phone headers.
 */
export function AgentBadge({ p, spy = false, mood = 'idle', role, right, dim = false, size = 'md', className, flag }: {
  p: RoomPlayer | undefined; spy?: boolean; mood?: AgentMood; role?: ReactNode; right?: ReactNode; dim?: boolean; size?: 'sm' | 'md'; className?: string; flag?: ReactNode
}) {
  const color = p?.color ?? '#888'
  const sm = size === 'sm'
  const photo = sm ? 40 : 52
  return (
    <div
      className={cx('relative flex items-center overflow-hidden', dim && 'opacity-60', className)}
      style={{
        gap: sm ? 9 : 10,
        padding: sm ? '7px 10px 7px 12px' : '10px 12px 10px 14px',
        borderRadius: 10,
        background: `linear-gradient(160deg, rgba(255,255,255,0.35), rgba(255,255,255,0) 40%), ${OP.paper}`,
        color: OP.ink,
        boxShadow: `inset 6px 0 0 ${color}, 0 2px 0 rgba(0,0,0,0.25), 0 8px 14px rgba(0,0,0,0.35)`,
      }}
    >
      <Mugshot p={p} spy={spy} mood={mood} size={photo} />
      <div className="grid min-w-0 flex-1 leading-tight">
        <span className="truncate uppercase" style={{ fontFamily: STENCIL, fontSize: sm ? 16 : 18, letterSpacing: '0.01em' }}>{p?.name ?? 'Agent'}</span>
        <span className="truncate uppercase" style={{ fontFamily: TYPE, fontSize: sm ? 12 : 14, color: OP.ink2, letterSpacing: '0.06em' }}>
          {role ?? `Agent ${agentNo(p?.id ?? '')}`}
        </span>
        {!sm && <Barcode seed={p?.id ?? ''} />}
      </div>
      {right}
      {flag}
    </div>
  )
}

function Barcode({ seed }: { seed: string }) {
  let h = hash(seed) || 1
  const bars: number[] = []
  for (let i = 0; i < 22; i++) { h = Math.imul(h ^ (h >>> 13), 1103515245) >>> 0; bars.push(1 + (h % 3)) }
  let x = 0
  return (
    <svg width="92" height="9" viewBox="0 0 92 9" className="mt-0.5" aria-hidden>
      {bars.map((w, i) => {
        const r = i % 2 === 0 ? <rect key={i} x={x} y={0} width={w} height={9} fill={OP.ink} opacity={0.75} /> : null
        x += w + 1
        return r
      })}
    </svg>
  )
}
