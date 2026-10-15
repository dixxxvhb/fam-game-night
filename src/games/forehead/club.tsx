import { useId, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react'
import { cx } from '../../ui/kit'

/**
 * Forehead at the Club: the look kit. A neon comedy club: brick wall, red curtains, a plank
 * stage, a spotlight, neon tubes. Everything is drawn here as inline SVG or CSS, nothing loaded.
 * Display faces: Monoton (the neon sign), Pacifico (neon script), Bungee (cards, numbers).
 */

export const CLUB = {
  ink: '#140812',
  night: '#0d0610',
  brick: '#6b2633',
  brickDark: '#4d1824',
  brickLight: '#83303f',
  mortar: '#25101a',
  curtain: '#8c1028',
  curtainDark: '#560818',
  floor: '#3b2216',
  floorLight: '#5c3622',
  pink: '#ff3fa4',
  cyan: '#35e8ff',
  yellow: '#ffd23f',
  orange: '#ff8a2a',
  green: '#31e981',
  greenDeep: '#0f9f52',
  red: '#ff3b4e',
  card: '#fff6e3',
  cardEdge: '#e9d6b4',
} as const

export const FONTS = ['Monoton', 'Pacifico']
export const MONOTON = { fontFamily: '"Monoton", "Bungee", sans-serif' } as const
export const PACIFICO = { fontFamily: '"Pacifico", "Brush Script MT", cursive' } as const

// ---------------- color helpers ----------------

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
/** Mix a color toward another by t (0..1). */
export function mix(a: string, b: string, t: number): string {
  const x = rgb(a)
  const y = rgb(b)
  const m = x.map((v, i) => Math.round(v + (y[i] - v) * t))
  return `#${m.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}
export const shade = (c: string, t: number) => mix(c, '#000000', t)
export const tint = (c: string, t: number) => mix(c, '#ffffff', t)

/** Deterministic scatter from an index, for confetti and dust (render only, never logic). */
export function hash(i: number, salt = 1): number {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453
  return x - Math.floor(x)
}

// ---------------- the room ----------------

/** The brick wall, with a neon wash and a dark vignette. Fills its positioned parent. */
export function BrickWall({ wash = CLUB.pink, scale = 1, className }: { wash?: string; scale?: number; className?: string }) {
  const id = useId().replace(/:/g, '')
  const w = 96 * scale
  const h = 44 * scale
  return (
    <svg className={cx('pointer-events-none absolute inset-0 h-full w-full', className)} aria-hidden preserveAspectRatio="none">
      <defs>
        <pattern id={`b${id}`} width={w} height={h} patternUnits="userSpaceOnUse">
          <rect width={w} height={h} fill={CLUB.mortar} />
          <rect x={2 * scale} y={2 * scale} width={w / 2 - 4 * scale} height={h / 2 - 4 * scale} rx={2 * scale} fill={CLUB.brick} />
          <rect x={w / 2 + 2 * scale} y={2 * scale} width={w / 2 - 4 * scale} height={h / 2 - 4 * scale} rx={2 * scale} fill={CLUB.brickDark} />
          <rect x={-w / 4 + 2 * scale} y={h / 2 + 2 * scale} width={w / 2 - 4 * scale} height={h / 2 - 4 * scale} rx={2 * scale} fill={CLUB.brickLight} />
          <rect x={w / 4 + 2 * scale} y={h / 2 + 2 * scale} width={w / 2 - 4 * scale} height={h / 2 - 4 * scale} rx={2 * scale} fill={CLUB.brick} />
          <rect x={(3 * w) / 4 + 2 * scale} y={h / 2 + 2 * scale} width={w / 2 - 4 * scale} height={h / 2 - 4 * scale} rx={2 * scale} fill={CLUB.brickDark} />
          <rect x={2 * scale} y={2 * scale} width={w / 2 - 4 * scale} height={2 * scale} fill="#ffffff" opacity="0.06" />
          <rect x={w / 4 + 2 * scale} y={h / 2 + 2 * scale} width={w / 2 - 4 * scale} height={2 * scale} fill="#ffffff" opacity="0.05" />
        </pattern>
        <radialGradient id={`w${id}`} cx="30%" cy="10%" r="70%">
          <stop offset="0%" stopColor={wash} stopOpacity="0.35" />
          <stop offset="100%" stopColor={wash} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`v${id}`} cx="50%" cy="45%" r="75%">
          <stop offset="45%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.78" />
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill={`url(#b${id})`} />
      <rect width="100%" height="100%" fill="#1a0610" opacity="0.35" />
      <rect width="100%" height="100%" fill={`url(#w${id})`} />
      <rect width="100%" height="100%" fill={`url(#v${id})`} />
    </svg>
  )
}

/** Plank stage floor along the bottom of its positioned parent. */
export function StageFloor({ height = 120, className }: { height?: number; className?: string }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg className={cx('pointer-events-none absolute inset-x-0 bottom-0 w-full', className)} style={{ height }} viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={`f${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={CLUB.floorLight} />
          <stop offset="100%" stopColor={CLUB.floor} />
        </linearGradient>
      </defs>
      <rect x="0" y="6" width="1000" height="94" fill={`url(#f${id})`} />
      <rect x="0" y="0" width="1000" height="8" fill="#1e0f0a" />
      <rect x="0" y="8" width="1000" height="3" fill="#8a5a3a" opacity="0.6" />
      {Array.from({ length: 5 }, (_, i) => <rect key={i} x="0" y={24 + i * 16} width="1000" height="1.5" fill="#1e0f0a" opacity="0.55" />)}
      {Array.from({ length: 14 }, (_, i) => <rect key={`v${i}`} x={(i * 137 + (i % 2) * 60) % 1000} y={11 + (i % 5) * 16} width="1.5" height="13" fill="#1e0f0a" opacity="0.5" />)}
    </svg>
  )
}

/** Red velvet curtain swag on one side. */
export function Curtain({ side, className, style }: { side: 'left' | 'right'; className?: string; style?: CSSProperties }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg className={cx('pointer-events-none absolute top-0 h-full', side === 'left' ? 'left-0' : 'right-0', className)} style={{ ...style, transform: side === 'right' ? 'scaleX(-1)' : undefined }} viewBox="0 0 120 600" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={`c${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={CLUB.curtainDark} />
          <stop offset="18%" stopColor={CLUB.curtain} />
          <stop offset="32%" stopColor={CLUB.curtainDark} />
          <stop offset="50%" stopColor={CLUB.curtain} />
          <stop offset="66%" stopColor={CLUB.curtainDark} />
          <stop offset="84%" stopColor={CLUB.curtain} />
          <stop offset="100%" stopColor={CLUB.curtainDark} />
        </linearGradient>
      </defs>
      <path d="M0 0 H120 C112 140 70 230 58 300 C50 360 64 470 84 600 H0 Z" fill={`url(#c${id})`} />
      <path d="M120 0 C112 140 70 230 58 300 C50 360 64 470 84 600" fill="none" stroke="#2a0008" strokeWidth="4" />
      <path d="M44 286 C58 300 74 300 82 292 L76 318 C66 324 52 320 44 308 Z" fill={CLUB.yellow} stroke="#6b4a00" strokeWidth="2" />
    </svg>
  )
}

/** A cone of light from above onto the stage. Fills its positioned parent; aim with x (0..1). */
export function Spotlight({ x = 0.5, width = 0.34, color = '#fff5d6', className }: { x?: number; width?: number; color?: string; className?: string }) {
  const id = useId().replace(/:/g, '')
  const top = x * 1000
  const half = (width * 1000) / 2
  return (
    <svg className={cx('pointer-events-none absolute inset-0 h-full w-full fh-beam', className)} viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={`s${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.55" />
          <stop offset="100%" stopColor={color} stopOpacity="0.16" />
        </linearGradient>
        <radialGradient id={`p${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={color} stopOpacity="0.55" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d={`M${top - 18} 0 L${top + 18} 0 L${top + half} 930 L${top - half} 930 Z`} fill={`url(#s${id})`} />
      <ellipse cx={top} cy="930" rx={half * 1.05} ry="46" fill={`url(#p${id})`} />
    </svg>
  )
}

// ---------------- neon ----------------

/** The club's sign: FOREHEAD in neon tubes, "at the Club" in script. */
export function NeonSign({ size = 1, className }: { size?: number; className?: string }) {
  return (
    <div className={cx('relative inline-grid justify-items-center leading-none', className)} style={{ fontSize: 16 * size }}>
      <div className="fh-neon-pink fh-flicker" style={{ ...MONOTON, fontSize: '3.4em', letterSpacing: '0.04em' }}>FOREHEAD</div>
      <div className="fh-neon-cyan -mt-[0.2em] -rotate-3" style={{ ...PACIFICO, fontSize: '1.9em' }}>at the Club</div>
    </div>
  )
}

/** A neon tube frame around children. */
export function NeonFrame({ color = CLUB.pink, children, className, style }: { color?: string; children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div
      className={cx('rounded-[22px] border-[3px]', className)}
      style={{ borderColor: tint(color, 0.55), boxShadow: `0 0 6px ${color}, 0 0 18px ${color}, inset 0 0 10px ${color}`, ...style }}
    >
      {children}
    </div>
  )
}

// ---------------- cast ----------------

export type GuesserMood = 'think' | 'happy' | 'oops' | 'bow' | 'sad'

/**
 * The Guesser on stage: a stand-up in a jacket of their color, phone held to the forehead.
 * 200 x 300 box, feet on y = 290.
 */
export function GuesserFigure({ color, mood = 'think', phone = true, size = 300, className }: { color: string; mood?: GuesserMood; phone?: boolean; size?: number; className?: string }) {
  const jacket = color
  const lapel = shade(color, 0.32)
  const skin = tint(color, 0.62)
  const skinShade = mix(skin, color, 0.3)
  const hair = shade(color, 0.6)
  const ink = CLUB.ink
  const o = { stroke: ink, strokeWidth: 4, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  const bowing = mood === 'bow'
  const head = bowing ? 'translate(18 26) rotate(16 100 120)' : undefined
  const armUp = phone && !bowing
  return (
    <svg viewBox="0 0 200 300" width={size * (2 / 3)} height={size} className={className} aria-hidden>
      <ellipse cx="100" cy="292" rx="62" ry="8" fill="#000" opacity="0.45" />
      {/* legs */}
      <path d="M78 205 L74 282" {...o} strokeWidth={26} stroke={ink} />
      <path d="M122 205 L126 282" {...o} strokeWidth={26} stroke={ink} />
      <path d="M78 205 L74 280" stroke="#2a2235" strokeWidth={18} strokeLinecap="round" />
      <path d="M122 205 L126 280" stroke="#2a2235" strokeWidth={18} strokeLinecap="round" />
      <ellipse cx="68" cy="286" rx="18" ry="8" fill={ink} />
      <ellipse cx="132" cy="286" rx="18" ry="8" fill={ink} />
      <g transform={bowing ? 'rotate(14 100 210)' : undefined}>
        {/* left arm: hangs, or on the hip, or thrown up in joy */}
        {mood === 'happy' ? (
          <>
            <path d="M58 138 C40 120 30 96 34 70" fill="none" stroke={ink} strokeWidth={26} strokeLinecap="round" />
            <path d="M58 138 C40 120 30 96 34 70" fill="none" stroke={jacket} strokeWidth={18} strokeLinecap="round" />
            <circle cx="34" cy="64" r="12" fill={skin} {...o} />
          </>
        ) : (
          <>
            <path d="M58 140 C46 164 46 188 52 210" fill="none" stroke={ink} strokeWidth={26} strokeLinecap="round" />
            <path d="M58 140 C46 164 46 188 52 210" fill="none" stroke={jacket} strokeWidth={18} strokeLinecap="round" />
            <circle cx="53" cy="216" r="12" fill={skin} {...o} />
          </>
        )}
        {/* torso: jacket, shirt, tie */}
        <path d="M56 132 C62 118 80 112 100 112 C120 112 138 118 144 132 L148 214 C130 222 70 222 52 214 Z" fill={jacket} {...o} />
        <path d="M86 114 L100 160 L114 114 Z" fill="#fbf4ea" stroke={ink} strokeWidth={3} strokeLinejoin="round" />
        <path d="M96 122 L104 122 L106 150 L100 160 L94 150 Z" fill={CLUB.pink} stroke={ink} strokeWidth={2.5} strokeLinejoin="round" />
        <path d="M86 114 L100 160 L80 136 L72 120 Z" fill={lapel} stroke={ink} strokeWidth={3} strokeLinejoin="round" />
        <path d="M114 114 L100 160 L120 136 L128 120 Z" fill={lapel} stroke={ink} strokeWidth={3} strokeLinejoin="round" />
        <circle cx="100" cy="178" r="3.5" fill={ink} />
        <circle cx="100" cy="196" r="3.5" fill={ink} />
        <path d="M60 140 L64 206" stroke="#fff" strokeOpacity="0.18" strokeWidth={5} strokeLinecap="round" />
        {/* right arm: up to the forehead with the phone */}
        {armUp ? (
          <>
            <path d="M142 138 C164 124 166 92 148 62" fill="none" stroke={ink} strokeWidth={26} strokeLinecap="round" />
            <path d="M142 138 C164 124 166 92 148 62" fill="none" stroke={jacket} strokeWidth={18} strokeLinecap="round" />
          </>
        ) : (
          <>
            <path d="M142 140 C154 164 154 188 148 210" fill="none" stroke={ink} strokeWidth={26} strokeLinecap="round" />
            <path d="M142 140 C154 164 154 188 148 210" fill="none" stroke={jacket} strokeWidth={18} strokeLinecap="round" />
            <circle cx="147" cy="216" r="12" fill={skin} {...o} />
          </>
        )}
        {/* head */}
        <g transform={head}>
          <path d="M100 100 L100 116" stroke={ink} strokeWidth={22} strokeLinecap="round" />
          <path d="M100 100 L100 116" stroke={skinShade} strokeWidth={14} strokeLinecap="round" />
          <ellipse cx="60" cy="74" rx="8" ry="11" fill={skin} {...o} />
          <ellipse cx="140" cy="74" rx="8" ry="11" fill={skin} {...o} />
          <ellipse cx="100" cy="68" rx="40" ry="42" fill={skin} {...o} />
          <path d="M64 52 C64 26 90 18 104 22 C124 18 140 32 138 50 C128 38 112 34 100 38 C88 34 72 40 64 52 Z" fill={hair} stroke={ink} strokeWidth={3.5} strokeLinejoin="round" />
          <Face mood={mood} />
          <ellipse cx="72" cy="84" rx="7" ry="4" fill={CLUB.pink} opacity={mood === 'happy' ? 0.55 : 0.3} />
          <ellipse cx="128" cy="84" rx="7" ry="4" fill={CLUB.pink} opacity={mood === 'happy' ? 0.55 : 0.3} />
        </g>
        {/* the phone on the forehead, screen out at the room */}
        {armUp && (
          <g>
            <rect x="66" y="22" width="68" height="34" rx="7" fill={ink} />
            <rect x="71" y="26" width="58" height="26" rx="4" fill="#fffbe8" />
            <rect x="77" y="34" width="46" height="5" rx="2.5" fill={ink} opacity="0.8" />
            <rect x="84" y="42" width="32" height="4" rx="2" fill={ink} opacity="0.55" />
            <circle cx="148" cy="52" r="12" fill={skin} {...o} />
          </g>
        )}
      </g>
    </svg>
  )
}

function Face({ mood }: { mood: GuesserMood }) {
  const ink = CLUB.ink
  if (mood === 'happy' || mood === 'bow') {
    return (
      <g>
        <path d="M76 70 Q84 60 92 70" fill="none" stroke={ink} strokeWidth={4} strokeLinecap="round" />
        <path d="M108 70 Q116 60 124 70" fill="none" stroke={ink} strokeWidth={4} strokeLinecap="round" />
        <path d="M80 86 Q100 112 120 86 Z" fill="#6E1838" stroke={ink} strokeWidth={3.5} strokeLinejoin="round" />
        <path d="M84 88 H116" stroke="#fff" strokeWidth={4} />
      </g>
    )
  }
  if (mood === 'oops') {
    return (
      <g>
        <path d="M78 62 L90 72 M90 62 L78 72" stroke={ink} strokeWidth={4} strokeLinecap="round" />
        <path d="M110 62 L122 72 M122 62 L110 72" stroke={ink} strokeWidth={4} strokeLinecap="round" />
        <path d="M82 94 Q88 88 94 94 Q100 100 106 94 Q112 88 118 94" fill="none" stroke={ink} strokeWidth={4} strokeLinecap="round" />
      </g>
    )
  }
  if (mood === 'sad') {
    return (
      <g>
        <ellipse cx="84" cy="70" rx="5" ry="6" fill={ink} />
        <ellipse cx="116" cy="70" rx="5" ry="6" fill={ink} />
        <path d="M76 58 L92 62 M124 58 L108 62" stroke={ink} strokeWidth={3.5} strokeLinecap="round" />
        <path d="M86 98 Q100 88 114 98" fill="none" stroke={ink} strokeWidth={4} strokeLinecap="round" />
      </g>
    )
  }
  // think: eyes rolled up at the phone, little o mouth
  return (
    <g>
      <ellipse cx="84" cy="70" rx="8" ry="9" fill="#fff" stroke={ink} strokeWidth={3} />
      <ellipse cx="116" cy="70" rx="8" ry="9" fill="#fff" stroke={ink} strokeWidth={3} />
      <circle cx="85" cy="65" r="4.2" fill={ink} />
      <circle cx="117" cy="65" r="4.2" fill={ink} />
      <path d="M76 56 Q84 50 92 55 M108 55 Q116 50 124 56" fill="none" stroke={ink} strokeWidth={3.5} strokeLinecap="round" />
      <ellipse cx="104" cy="94" rx="6" ry="7" fill="#6E1838" stroke={ink} strokeWidth={3} />
    </g>
  )
}

/** A front-row audience member seen from behind, in their color, rim-lit by the stage. */
export function FrontRowHead({ color, size = 120, className }: { color: string; size?: number; className?: string }) {
  const body = shade(color, 0.25)
  const head = shade(color, 0.45)
  const rim = tint(color, 0.5)
  return (
    <svg viewBox="0 0 120 100" width={size} height={(size * 100) / 120} className={className} aria-hidden>
      <path d="M10 100 C12 72 34 62 60 62 C86 62 108 72 110 100 Z" fill={body} stroke={CLUB.ink} strokeWidth="3" />
      <path d="M18 84 C24 70 40 64 60 64" fill="none" stroke={rim} strokeWidth="3.5" strokeLinecap="round" opacity="0.9" />
      <rect x="50" y="52" width="20" height="16" fill={head} />
      <ellipse cx="60" cy="36" rx="26" ry="28" fill={head} stroke={CLUB.ink} strokeWidth="3" />
      <ellipse cx="34" cy="38" rx="5" ry="8" fill={head} stroke={CLUB.ink} strokeWidth="2.5" />
      <ellipse cx="86" cy="38" rx="5" ry="8" fill={head} stroke={CLUB.ink} strokeWidth="2.5" />
      <path d="M38 24 C46 10 74 10 82 24" fill="none" stroke={rim} strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}

// ---------------- props + glyphs ----------------

/** A flame. Animated when `live`. */
export function Flame({ size = 48, live = true, className }: { size?: number; live?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 60 80" width={size * 0.75} height={size} className={cx(className)} aria-hidden>
      <g className={live ? 'fh-flame' : undefined}>
        <path d="M30 78 C10 78 4 62 8 48 C12 36 20 32 18 18 C28 24 32 32 32 40 C36 34 38 24 34 6 C50 18 58 36 56 54 C54 70 44 78 30 78 Z" fill={CLUB.red} stroke={CLUB.ink} strokeWidth="3" strokeLinejoin="round" />
        <path d="M30 76 C18 76 14 66 16 58 C18 50 24 48 24 40 C30 44 32 50 32 56 C36 52 38 46 37 38 C46 46 48 56 46 64 C44 72 38 76 30 76 Z" fill={CLUB.orange} />
        <path d="M30 75 C24 75 22 70 23 66 C24 62 27 60 28 56 C31 60 33 63 33 66 C35 64 36 62 36 60 C40 64 40 68 38 71 C36 74 34 75 30 75 Z" fill={CLUB.yellow} />
      </g>
    </svg>
  )
}

/** A check in a circle. */
export function CheckGlyph({ size = 28, color = CLUB.green, className }: { size?: number; color?: string; className?: string }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} className={className} aria-hidden>
      <circle cx="16" cy="16" r="14" fill={color} stroke={CLUB.ink} strokeWidth="2.5" />
      <path d="M9 16.5 L14 21.5 L23 11" fill="none" stroke={CLUB.ink} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** An X in a circle (pass). */
export function PassGlyph({ size = 28, color = CLUB.orange, className }: { size?: number; color?: string; className?: string }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} className={className} aria-hidden>
      <circle cx="16" cy="16" r="14" fill={color} stroke={CLUB.ink} strokeWidth="2.5" />
      <path d="M11 11 L21 21 M21 11 L11 21" fill="none" stroke={CLUB.ink} strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  )
}

/** A phone tilting with an arrow: down (got it) or up (pass). */
export function TiltGlyph({ dir, size = 56, color }: { dir: 'down' | 'up'; size?: number; color?: string }) {
  const c = color ?? (dir === 'down' ? CLUB.green : CLUB.orange)
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden>
      <g transform={`rotate(${dir === 'down' ? 28 : -28} 32 32)`}>
        <rect x="10" y="20" width="44" height="24" rx="5" fill={CLUB.ink} stroke={c} strokeWidth="3" />
        <rect x="15" y="24" width="34" height="16" rx="2" fill={tint(c, 0.75)} />
      </g>
      {dir === 'down'
        ? <path d="M50 44 L50 60 M44 54 L50 60 L56 54" fill="none" stroke={c} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        : <path d="M50 20 L50 4 M44 10 L50 4 L56 10" fill="none" stroke={c} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  )
}

/** A mouth with a bar across: no saying the word. */
export function HushGlyph({ size = 56 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden>
      <circle cx="32" cy="32" r="26" fill={CLUB.ink} stroke={CLUB.pink} strokeWidth="3" />
      <path d="M18 34 Q32 46 46 34 Q32 38 18 34 Z" fill={CLUB.pink} />
      <path d="M14 50 L50 14" stroke={CLUB.yellow} strokeWidth="5" strokeLinecap="round" />
    </svg>
  )
}

/** A stand mic, for set dressing. */
export function MicStand({ height = 220, className }: { height?: number; className?: string }) {
  return (
    <svg viewBox="0 0 60 220" width={(height * 60) / 220} height={height} className={className} aria-hidden>
      <ellipse cx="30" cy="214" rx="24" ry="5" fill="#000" opacity="0.4" />
      <path d="M8 212 L30 196 L52 212" fill="none" stroke="#2b2b33" strokeWidth="5" strokeLinecap="round" />
      <path d="M30 196 L30 52" stroke="#3a3a46" strokeWidth="5" />
      <path d="M30 120 L30 52" stroke="#9a9ab0" strokeWidth="2" opacity="0.6" />
      <path d="M30 56 L40 34" stroke="#2b2b33" strokeWidth="5" strokeLinecap="round" />
      <rect x="34" y="8" width="16" height="30" rx="8" transform="rotate(24 42 23)" fill="#56566a" stroke={CLUB.ink} strokeWidth="2.5" />
      <path d="M37 14 L49 20 M35 19 L47 25 M33 24 L45 30" stroke="#8a8aa2" strokeWidth="1.5" transform="rotate(24 42 23)" />
    </svg>
  )
}

/** The rubber stamp that lands on a passed card. */
export function PassStamp({ size = 1, className, style }: { size?: number; className?: string; style?: CSSProperties }) {
  return (
    <div
      className={cx('inline-block rounded-xl border-[6px] px-5 py-1 font-display uppercase leading-none tracking-[0.08em]', className)}
      style={{ fontSize: 56 * size, borderWidth: Math.max(3, 6 * size), color: CLUB.red, borderColor: CLUB.red, background: 'rgba(255,246,227,0.6)', ...style }}
    >
      Pass
    </div>
  )
}

/** Confetti burst from the middle of its positioned parent. */
export function Confetti({ count = 32, spread = 1, className }: { count?: number; spread?: number; className?: string }) {
  const colors = [CLUB.pink, CLUB.cyan, CLUB.yellow, CLUB.green, '#ffffff', CLUB.orange]
  return (
    <div className={cx('pointer-events-none absolute inset-0 overflow-hidden', className)} aria-hidden>
      {Array.from({ length: count }, (_, i) => {
        const a = hash(i, 3) * Math.PI * 2
        const d = (220 + hash(i, 5) * 380) * spread
        const style = {
          '--dx': `${Math.cos(a) * d}px`,
          '--dy': `${Math.sin(a) * d * 0.8 + 160 * spread}px`,
          '--r': `${(hash(i, 7) - 0.5) * 900}deg`,
          left: '50%',
          top: '45%',
          width: 10 + hash(i, 9) * 10,
          height: 6 + hash(i, 11) * 8,
          background: colors[i % colors.length],
          borderRadius: i % 3 === 0 ? 999 : 2,
          animationDelay: `${hash(i, 13) * 0.08}s`,
        } as CSSProperties
        return <span key={i} className="fh-confetti absolute" style={style} />
      })}
    </div>
  )
}

// ---------------- the timer + streak ----------------

/** The big ring timer. Pulses on the beat in the last ten seconds. */
export function RingTimer({ left, total, size = 150, label, className }: { left: number; total: number; size?: number; label?: string; className?: string }) {
  const secs = Math.max(0, Math.ceil(left / 1000))
  const frac = total > 0 ? Math.max(0, Math.min(1, left / total)) : 0
  const hot = secs <= 10
  const color = hot ? CLUB.red : frac < 0.4 ? CLUB.yellow : CLUB.cyan
  const r = 44
  const c = 2 * Math.PI * r
  return (
    <div className={cx('relative grid place-items-center', hot && secs > 0 && 'fh-pulse', className)} style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} className="absolute inset-0" aria-hidden>
        <circle cx="50" cy="50" r="49" fill={CLUB.ink} opacity="0.85" />
        <circle cx="50" cy="50" r={r} fill="none" stroke="#2a1a2a" strokeWidth="7" />
        <circle
          cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - frac)} transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dashoffset 0.25s linear, stroke 0.3s' }}
        />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="12" opacity="0.18" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} transform="rotate(-90 50 50)" />
      </svg>
      <div className="relative grid justify-items-center leading-none">
        <span className="font-display tabular" style={{ fontSize: size * 0.36, color: hot ? '#ffd9dd' : '#fff', textShadow: `0 0 12px ${color}` }}>{secs}</span>
        {label && <span className="mt-1 font-mono font-bold uppercase tracking-[0.18em]" style={{ fontSize: Math.max(10, size * 0.085), color: tint(color, 0.3) }}>{label}</span>}
      </div>
    </div>
  )
}

/** Five bulbs that heat up with the streak. ON FIRE with a flame at three or more. */
export function StreakMeter({ streak, onFireAt = 3, size = 1, className }: { streak: number; onFireAt?: number; size?: number; className?: string }) {
  const heat = [CLUB.cyan, CLUB.yellow, CLUB.orange, CLUB.red, '#ff2a6a']
  const fire = streak >= onFireAt
  return (
    <div className={cx('flex items-center', className)} style={{ gap: 10 * size }} data-fh-streak={streak}>
      <div className="flex items-end" style={{ gap: 6 * size }}>
        {heat.map((c, i) => {
          const lit = i < streak
          return (
            <span
              key={i}
              className={cx('block rounded-full border-[3px]', lit && fire && 'fh-heat')}
              style={{
                width: 22 * size,
                height: (22 + i * 7) * size,
                borderColor: CLUB.ink,
                background: lit ? c : '#2b1a26',
                boxShadow: lit ? `0 0 ${10 * size}px ${c}, 0 0 ${22 * size}px ${c}` : 'none',
              }}
            />
          )
        })}
      </div>
      {fire ? (
        <div className="flex items-center" style={{ gap: 4 * size }}>
          <Flame size={58 * size} />
          <span className="fh-neon-orange whitespace-nowrap" style={{ ...PACIFICO, fontSize: 34 * size, lineHeight: 1.1 }}>On fire</span>
        </div>
      ) : (
        <span className="whitespace-nowrap font-mono font-bold uppercase tracking-[0.16em] text-white/60" style={{ fontSize: 15 * size }}>
          {streak ? `${streak} in a row` : 'Streak'}
        </span>
      )}
    </div>
  )
}

// ---------------- the card ----------------

/** The giant cue card. `back` shows the club's card back instead of a word. */
export function CueCard({ children, back = false, className, style }: { children?: ReactNode; back?: boolean; className?: string; style?: CSSProperties }) {
  if (back) {
    return (
      <div
        className={cx('relative grid place-items-center overflow-hidden rounded-[28px] border-[6px]', className)}
        style={{
          borderColor: CLUB.ink,
          background: `repeating-linear-gradient(45deg, ${CLUB.pink} 0 18px, #e02a8c 18px 36px)`,
          boxShadow: `0 14px 0 rgba(0,0,0,0.55), 0 0 40px rgba(255,63,164,0.45)`,
          ...style,
        }}
      >
        <div className="absolute inset-4 rounded-[18px] border-4 border-dashed" style={{ borderColor: 'rgba(255,255,255,0.55)' }} />
        {children}
      </div>
    )
  }
  return (
    <div
      className={cx('relative overflow-hidden rounded-[28px] border-[6px]', className)}
      style={{ borderColor: CLUB.ink, background: CLUB.card, color: CLUB.ink, boxShadow: `0 14px 0 rgba(0,0,0,0.55), 0 0 0 3px ${CLUB.pink}, 0 0 36px rgba(255,63,164,0.55)`, ...style }}
    >
      <div className="absolute inset-x-0 top-0 h-3" style={{ background: `repeating-linear-gradient(90deg, ${CLUB.pink} 0 40px, ${CLUB.cyan} 40px 80px, ${CLUB.yellow} 80px 120px)` }} />
      <div className="absolute inset-x-6 bottom-6 top-8" style={{ backgroundImage: `repeating-linear-gradient(180deg, transparent 0 46px, ${CLUB.cardEdge} 46px 48px)` }} />
      {children}
    </div>
  )
}

/** The club's flat button for phones: neon-edged, chunky, presses down. */
export function ClubButton({ tone = 'pink', big = false, className, style, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'pink' | 'green' | 'orange' | 'ghost'; big?: boolean }) {
  const t = {
    pink: { bg: CLUB.pink, fg: '#fff', edge: '#a3105e' },
    green: { bg: CLUB.green, fg: CLUB.ink, edge: CLUB.greenDeep },
    orange: { bg: CLUB.orange, fg: CLUB.ink, edge: '#b04e0a' },
    ghost: { bg: '#25101e', fg: '#ffd1ec', edge: '#0b0409' },
  }[tone]
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'no-select relative inline-flex items-center justify-center gap-2 rounded-[20px] border-4 font-display uppercase leading-none transition-transform duration-75 active:translate-y-[5px] disabled:opacity-50',
        big ? 'min-h-20 px-6 text-3xl' : 'min-h-14 px-5 text-xl',
        className,
      )}
      style={{ borderColor: CLUB.ink, background: t.bg, color: t.fg, boxShadow: `0 6px 0 ${t.edge}, 0 6px 0 4px ${CLUB.ink}, 0 0 24px ${t.bg}55`, ...style }}
    >
      {children}
    </button>
  )
}
