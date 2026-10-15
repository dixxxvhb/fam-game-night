import { useId } from 'react'
import { cx } from '../../../ui/kit'
import { HOTEL } from './look'

/**
 * The Grand Palmetto cast, inline SVG.
 *  - The Night Manager: tall, gaunt, polite about your death. Brass badge, ring of keys, lantern.
 *  - Guests: the players, little tourists in a straw sun hat and a shirt in their color.
 *  - Ghosts: what guests become. A sheet that glows in their color. They keep the hat.
 * One dark ink outline; motion lives in survive.css (sv-* classes).
 */

const INK = '#0B0705'
const SW = 3

// ---------------- the Night Manager ----------------

export type ManagerMood = 'polite' | 'grin' | 'sorry' | 'shock'
export type ManagerPose = 'stand' | 'raise' | 'point' | 'bow'

const SKIN = '#C9D1BA'
const SKIN_SHADE = '#9DA88E'
const COAT = '#5E1C26'
const COAT_SHADE = '#43121A'
const LAPEL = '#2E0A10'
const TROUSER = '#171211'

function Arm({ d }: { d: string }) {
  return (
    <>
      <path d={d} fill="none" stroke={INK} strokeWidth={18 + SW * 2} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={COAT} strokeWidth={18} strokeLinecap="round" strokeLinejoin="round" />
    </>
  )
}

function Hand({ x, y }: { x: number; y: number }) {
  return <circle cx={x} cy={y} r={8} fill={SKIN} stroke={INK} strokeWidth={SW} />
}

/** The lantern. (x, y) is the top of the handle. */
export function Lantern({ x, y, swing = true, glowId }: { x: number; y: number; swing?: boolean; glowId: string }) {
  return (
    <g className={swing ? 'sv-swing' : undefined} style={{ transformOrigin: `${x}px ${y}px`, transformBox: 'view-box' }}>
      <circle cx={x} cy={y + 34} r={70} fill={`url(#${glowId})`} />
      <path d={`M${x - 10} ${y + 10} Q${x} ${y - 8} ${x + 10} ${y + 10}`} fill="none" stroke={INK} strokeWidth={3} />
      <path d={`M${x - 14} ${y + 16} L${x + 14} ${y + 16} L${x + 9} ${y + 9} L${x - 9} ${y + 9} Z`} fill={HOTEL.brass} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
      <rect x={x - 12} y={y + 16} width={24} height={34} rx={3} fill="#FFE2A0" stroke={INK} strokeWidth={2.5} />
      <rect x={x - 12} y={y + 16} width={24} height={34} rx={3} fill={HOTEL.candle} opacity={0.55} />
      <path d={`M${x} ${y + 22} C${x + 5} ${y + 30} ${x + 5} ${y + 36} ${x} ${y + 40} C${x - 5} ${y + 36} ${x - 5} ${y + 30} ${x} ${y + 22} Z`} fill="#FFF6D0" />
      <path d={`M${x - 4} ${y + 16} V${y + 50} M${x + 4} ${y + 16} V${y + 50}`} stroke={HOTEL.brassDark} strokeWidth={1.5} />
      <path d={`M${x - 15} ${y + 50} H${x + 15} L${x + 11} ${y + 57} H${x - 11} Z`} fill={HOTEL.brass} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
    </g>
  )
}

function Keys({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <circle cx={x} cy={y + 8} r={8} fill="none" stroke={HOTEL.brass} strokeWidth={3} />
      {[-12, -3, 7, 15].map((a, i) => (
        <g key={i} transform={`rotate(${a} ${x} ${y + 14})`}>
          <rect x={x - 2} y={y + 14} width={4} height={18 + (i % 2) * 5} rx={1.5} fill={i === 2 ? HOTEL.brassLight : HOTEL.brass} stroke={INK} strokeWidth={1.2} />
          <rect x={x + 1} y={y + 26 + (i % 2) * 5} width={5} height={3} fill={HOTEL.brass} stroke={INK} strokeWidth={1} />
        </g>
      ))}
    </g>
  )
}

function ManagerFace({ mood }: { mood: ManagerMood }) {
  const closed = mood === 'sorry'
  return (
    <g>
      {/* sunken sockets */}
      <ellipse cx="88" cy="91" rx="10" ry="8" fill={SKIN_SHADE} />
      <ellipse cx="112" cy="91" rx="10" ry="8" fill={SKIN_SHADE} />
      {closed ? (
        <g stroke={INK} strokeWidth={2.6} fill="none" strokeLinecap="round">
          <path d="M81 92 Q88 97 95 92" /><path d="M105 92 Q112 97 119 92" />
        </g>
      ) : (
        <g className="sv-blink" style={{ transformOrigin: '100px 91px', transformBox: 'view-box' }}>
          <ellipse cx="88" cy="91" rx={mood === 'shock' ? 7 : 6} ry={mood === 'shock' ? 7 : 4.5} fill="#F4EEDC" stroke={INK} strokeWidth={2} />
          <ellipse cx="112" cy="91" rx={mood === 'shock' ? 7 : 6} ry={mood === 'shock' ? 7 : 4.5} fill="#F4EEDC" stroke={INK} strokeWidth={2} />
          <circle cx="89" cy="91.5" r={mood === 'shock' ? 2 : 2.6} fill={INK} />
          <circle cx="113" cy="91.5" r={mood === 'shock' ? 2 : 2.6} fill={INK} />
        </g>
      )}
      {/* brows: high and thin */}
      <g stroke={INK} strokeWidth={2.8} fill="none" strokeLinecap="round">
        {mood === 'sorry'
          ? <><path d="M78 80 Q86 76 95 80" /><path d="M105 80 Q114 76 122 80" /></>
          : mood === 'grin'
            ? <><path d="M78 79 Q87 72 96 80" /><path d="M104 80 Q113 72 122 79" /></>
            : <><path d="M78 78 Q87 71 96 77" /><path d="M104 77 Q113 71 122 78" /></>}
      </g>
      {/* hollow cheeks */}
      <path d="M78 104 Q82 116 86 122" stroke={SKIN_SHADE} strokeWidth={3} fill="none" strokeLinecap="round" />
      <path d="M122 104 Q118 116 114 122" stroke={SKIN_SHADE} strokeWidth={3} fill="none" strokeLinecap="round" />
      {/* long nose */}
      <path d="M100 92 L97 112 Q100 115 104 112" fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
      {/* pencil mustache */}
      <path d="M89 119 Q100 115 111 119" fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
      {mood === 'grin' ? (
        <g>
          <path d="M84 123 Q100 140 116 123 Q100 129 84 123 Z" fill="#F4EEDC" stroke={INK} strokeWidth={2.4} strokeLinejoin="round" />
          <path d="M90 125 V131 M96 126 V134 M102 126 V134 M108 125 V132" stroke={INK} strokeWidth={1.4} />
        </g>
      ) : mood === 'shock' ? (
        <ellipse cx="100" cy="128" rx="5" ry="7" fill="#2A0E0E" stroke={INK} strokeWidth={2.2} />
      ) : mood === 'sorry' ? (
        <path d="M91 128 Q100 124 109 128" fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round" />
      ) : (
        <path d="M88 124 Q100 131 112 124" fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round" />
      )}
    </g>
  )
}

/** The Night Manager, full figure. 240 x 420 box, feet at y = 410. */
export function NightManager({ mood = 'polite', pose = 'stand', size = 380, className, still = false }: { mood?: ManagerMood; pose?: ManagerPose; size?: number; className?: string; still?: boolean }) {
  const glow = useId().replace(/:/g, '')
  const lanternAt = pose === 'raise' ? { x: 26, y: 96 } : { x: 48, y: 300 }
  const leftArm = pose === 'raise' ? 'M70 164 L36 158 L28 100' : 'M68 166 L54 236 L50 296'
  const rightArm = pose === 'point' ? 'M132 166 L176 162 L212 150' : pose === 'bow' ? 'M132 166 L128 232 L104 270' : 'M132 166 L148 236 L144 292'
  const rightHand = pose === 'point' ? { x: 214, y: 150 } : pose === 'bow' ? { x: 102, y: 270 } : { x: 144, y: 294 }
  const upper = pose === 'bow' ? 'rotate(7 100 300)' : undefined
  return (
    <svg viewBox="-20 0 240 420" width={size * 240 / 420} height={size} className={cx('block overflow-visible', !still && 'sv-sway', className)} aria-hidden>
      <defs>
        <radialGradient id={glow}>
          <stop offset="0" stopColor={HOTEL.candle} stopOpacity="0.55" />
          <stop offset="0.45" stopColor={HOTEL.candle} stopOpacity="0.16" />
          <stop offset="1" stopColor={HOTEL.candle} stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* shadow */}
      <ellipse cx="100" cy="410" rx="56" ry="9" fill="#000" opacity="0.45" />
      {/* legs */}
      <path d="M78 300 L80 402 H97 L99 300 Z" fill={TROUSER} stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
      <path d="M101 300 L103 402 H120 L122 300 Z" fill={TROUSER} stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
      <path d="M74 400 Q76 410 98 410 L98 400 Z M102 400 L102 410 Q124 410 126 400 Z" fill="#0A0606" stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
      <g transform={upper}>
        {/* back arm (lantern) */}
        <Arm d={leftArm} />
        {/* coat */}
        <path d="M60 164 C62 152 76 146 88 148 L100 192 L112 148 C124 146 138 152 140 164 L136 314 Q100 322 64 314 Z" fill={COAT} stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
        <path d="M120 170 L136 314 Q118 318 104 318 Z" fill={COAT_SHADE} opacity="0.6" />
        {/* shirt + bow tie */}
        <path d="M86 148 L100 194 L114 148 Z" fill="#EDE6D2" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
        <path d="M90 156 L100 161 L110 156 L110 166 L100 161 L90 166 Z" fill={INK} />
        {/* lapels */}
        <path d="M86 148 L100 194 L80 176 L78 152 Z" fill={LAPEL} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
        <path d="M114 148 L100 194 L120 176 L122 152 Z" fill={LAPEL} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
        {/* buttons */}
        {[214, 244, 274].map((y) => <circle key={y} cx="100" cy={y} r="4" fill={HOTEL.brass} stroke={INK} strokeWidth={1.6} />)}
        {/* brass badge */}
        <rect x="111" y="198" width="22" height="10" rx="2" fill={HOTEL.brassLight} stroke={INK} strokeWidth={1.8} />
        <path d="M114 203 H130" stroke={HOTEL.brassDark} strokeWidth={1.6} />
        {/* the key ring */}
        <Keys x={128} y={300} />
        {/* front arm */}
        <Arm d={rightArm} />
        <Hand x={rightHand.x} y={rightHand.y} />
        {pose === 'point' && <path d="M218 148 L232 144" stroke={INK} strokeWidth={6} strokeLinecap="round" />}
        {pose === 'point' && <path d="M218 148 L232 144" stroke={SKIN} strokeWidth={3} strokeLinecap="round" />}
        {/* neck + head */}
        <rect x="91" y="134" width="18" height="20" fill={SKIN_SHADE} stroke={INK} strokeWidth={SW} />
        <g className={pose === 'bow' ? undefined : 'sv-tilt'} style={{ transformOrigin: '100px 140px', transformBox: 'view-box' }}>
          <ellipse cx="68" cy="98" rx="6" ry="10" fill={SKIN} stroke={INK} strokeWidth={SW} />
          <ellipse cx="132" cy="98" rx="6" ry="10" fill={SKIN} stroke={INK} strokeWidth={SW} />
          <path d="M100 44 C124 44 132 66 130 92 C128 122 116 142 100 144 C84 142 72 122 70 92 C68 66 76 44 100 44 Z" fill={SKIN} stroke={INK} strokeWidth={SW} />
          <path d="M68 88 C62 52 82 34 100 36 C118 34 138 52 132 88 C128 70 120 60 104 58 L100 68 L96 58 C80 60 72 70 68 88 Z" fill="#141010" stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
          <path d="M108 46 Q120 50 124 60" stroke="#3A3330" strokeWidth={2} fill="none" strokeLinecap="round" />
          <ManagerFace mood={mood} />
        </g>
      </g>
      <Lantern x={lanternAt.x} y={lanternAt.y} glowId={glow} swing={!still} />
      <Hand x={pose === 'raise' ? 28 : 50} y={pose === 'raise' ? 98 : 298} />
    </svg>
  )
}

/** Just his head and shoulders, for phones and small corners. */
export function ManagerBust({ mood = 'polite', size = 64, className }: { mood?: ManagerMood; size?: number; className?: string }) {
  return (
    <svg viewBox="56 30 88 120" width={size * 88 / 120} height={size} className={cx('block shrink-0', className)} aria-hidden>
      <path d="M60 164 C62 152 76 146 88 148 L100 192 L112 148 C124 146 138 152 140 164 Z" fill={COAT} stroke={INK} strokeWidth={SW} />
      <path d="M86 148 L100 194 L114 148 Z" fill="#EDE6D2" />
      <path d="M90 156 L100 161 L110 156 L110 166 L100 161 L90 166 Z" fill={INK} />
      <rect x="91" y="134" width="18" height="16" fill={SKIN_SHADE} stroke={INK} strokeWidth={SW} />
      <ellipse cx="68" cy="98" rx="6" ry="10" fill={SKIN} stroke={INK} strokeWidth={SW} />
      <ellipse cx="132" cy="98" rx="6" ry="10" fill={SKIN} stroke={INK} strokeWidth={SW} />
      <path d="M100 44 C124 44 132 66 130 92 C128 122 116 142 100 144 C84 142 72 122 70 92 C68 66 76 44 100 44 Z" fill={SKIN} stroke={INK} strokeWidth={SW} />
      <path d="M68 88 C62 52 82 34 100 36 C118 34 138 52 132 88 C128 70 120 60 104 58 L100 68 L96 58 C80 60 72 70 68 88 Z" fill="#141010" stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
      <ManagerFace mood={mood} />
    </svg>
  )
}

// ---------------- guests and ghosts ----------------

export type GuestMood = 'idle' | 'scared' | 'happy' | 'run'

const GUEST_SKIN = '#F4DEC2'
const STRAW = '#E7C77A'
const STRAW_DARK = '#B8913E'

function shade(hex: string, amt: number) {
  const n = parseInt(hex.replace('#', ''), 16)
  if (Number.isNaN(n)) return hex
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + (amt > 0 ? (255 - c) * amt : c * amt))))
  return `rgb(${f((n >> 16) & 255)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`
}

function SunHat({ color, y = 30 }: { color: string; y?: number }) {
  return (
    <g>
      <ellipse cx="50" cy={y} rx="31" ry="7.5" fill={STRAW} stroke={INK} strokeWidth={SW} />
      <path d={`M33 ${y} C33 ${y - 18} 67 ${y - 18} 67 ${y} Z`} fill={STRAW} stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
      <path d={`M34 ${y - 4} C40 ${y - 1} 60 ${y - 1} 66 ${y - 4} L66.5 ${y - 1} C60 ${y + 2} 40 ${y + 2} 33.5 ${y - 1} Z`} fill={color} stroke={INK} strokeWidth={1.6} />
      <path d={`M40 ${y - 11} Q50 ${y - 15} 60 ${y - 11}`} stroke={STRAW_DARK} strokeWidth={1.6} fill="none" />
    </g>
  )
}

/** A guest of the hotel in their color. 100 x 130 box, feet at y = 128. */
export function Guest({ color, mood = 'idle', size = 80, className }: { color: string; mood?: GuestMood; size?: number; className?: string }) {
  const light = shade(color, 0.45)
  const dark = shade(color, -0.35)
  return (
    <svg viewBox="0 0 100 130" width={size * 100 / 130} height={size} className={cx('block overflow-visible', className)} aria-hidden>
      <ellipse cx="50" cy="127" rx="24" ry="4" fill="#000" opacity="0.4" />
      {/* legs */}
      <g className={mood === 'run' ? 'sv-legs' : undefined}>
        <rect x="36" y="108" width="10" height="18" rx="4" fill="#2A2420" stroke={INK} strokeWidth={2.4} />
        <rect x="54" y="108" width="10" height="18" rx="4" fill="#2A2420" stroke={INK} strokeWidth={2.4} />
      </g>
      {/* arms */}
      {mood === 'scared' || mood === 'happy' ? (
        <g stroke={INK} strokeWidth={2.4} fill={light}>
          <path d="M26 74 L12 52 L20 48 L32 68 Z" strokeLinejoin="round" />
          <path d="M74 74 L88 52 L80 48 L68 68 Z" strokeLinejoin="round" />
        </g>
      ) : (
        <g stroke={INK} strokeWidth={2.4} fill={light}>
          <path d="M26 70 L18 96 L26 98 L32 76 Z" strokeLinejoin="round" />
          <path d="M74 70 L82 96 L74 98 L68 76 Z" strokeLinejoin="round" />
        </g>
      )}
      {/* tourist shirt */}
      <path d="M50 62 C74 62 80 80 78 98 C77 112 68 116 50 116 C32 116 23 112 22 98 C20 80 26 62 50 62 Z" fill={color} stroke={INK} strokeWidth={SW} />
      <g fill={light} opacity="0.85">
        <circle cx="36" cy="84" r="3.5" /><circle cx="62" cy="78" r="3" /><circle cx="58" cy="100" r="3.5" /><circle cx="40" cy="104" r="2.6" /><circle cx="68" cy="94" r="2.4" />
      </g>
      <path d="M50 64 L50 114" stroke={dark} strokeWidth={2} />
      <path d="M40 64 L50 74 L60 64" fill="none" stroke={INK} strokeWidth={2.2} strokeLinejoin="round" />
      {/* head */}
      <circle cx="50" cy="46" r="20" fill={GUEST_SKIN} stroke={INK} strokeWidth={SW} />
      {mood === 'happy' ? (
        <g stroke={INK} strokeWidth={2.6} fill="none" strokeLinecap="round">
          <path d="M39 46 Q43 41 47 46" /><path d="M53 46 Q57 41 61 46" />
        </g>
      ) : mood === 'scared' ? (
        <g>
          <circle cx="42" cy="45" r="5.5" fill="#fff" stroke={INK} strokeWidth={2} /><circle cx="58" cy="45" r="5.5" fill="#fff" stroke={INK} strokeWidth={2} />
          <circle cx="42" cy="45" r="1.8" fill={INK} /><circle cx="58" cy="45" r="1.8" fill={INK} />
        </g>
      ) : (
        <g className="sv-blink" style={{ transformOrigin: '50px 45px', transformBox: 'view-box' }}>
          <ellipse cx="43" cy="46" rx="2.6" ry="3.4" fill={INK} /><ellipse cx="57" cy="46" rx="2.6" ry="3.4" fill={INK} />
        </g>
      )}
      {mood === 'scared'
        ? <ellipse cx="50" cy="57" rx="3.6" ry="4.6" fill="#3A1010" stroke={INK} strokeWidth={1.8} />
        : mood === 'happy' || mood === 'run'
          ? <path d="M43 54 Q50 62 57 54 Z" fill="#7A2A2A" stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
          : <path d="M44 55 Q50 59 56 55" fill="none" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />}
      <g fill="#F08A7A" opacity="0.45"><ellipse cx="36" cy="53" rx="3.6" ry="2.2" /><ellipse cx="64" cy="53" rx="3.6" ry="2.2" /></g>
      {mood === 'scared' && <path d="M70 34 Q73 40 70 43 Q67 40 70 34 Z" fill="#9FD8FF" stroke={INK} strokeWidth={1.2} />}
      <SunHat color={color} y={30} />
    </svg>
  )
}

/** A guest after the trap: a glowing sheet in their color. Same box as Guest. */
export function Ghost({ color, size = 80, className, float = true, mood = 'idle' }: { color: string; size?: number; className?: string; float?: boolean; mood?: 'idle' | 'happy' }) {
  const glow = useId().replace(/:/g, '')
  return (
    <svg viewBox="0 0 100 130" width={size * 100 / 130} height={size} className={cx('block overflow-visible', className)} aria-hidden>
      <defs>
        <radialGradient id={glow}>
          <stop offset="0" stopColor={color} stopOpacity="0.55" />
          <stop offset="0.6" stopColor={color} stopOpacity="0.12" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="50" cy="127" rx="18" ry="3.4" fill={color} opacity="0.35" className={float ? 'sv-shadow-pulse' : undefined} />
      <g className={float ? 'sv-float' : undefined}>
        <circle cx="50" cy="70" r="58" fill={`url(#${glow})`} />
        <path
          d="M20 114 L20 64 C20 38 33 24 50 24 C67 24 80 38 80 64 L80 114 Q74 124 68 114 Q62 104 56 114 Q50 124 44 114 Q38 104 32 114 Q26 124 20 114 Z"
          fill={HOTEL.ghost} stroke={color} strokeWidth={3.4} strokeLinejoin="round" opacity="0.94"
        />
        <path d="M20 90 C20 100 26 110 32 114 Q26 124 20 114 Z" fill={color} opacity="0.25" />
        <path d="M64 34 C72 40 76 52 76 64" stroke="#fff" strokeWidth={4} fill="none" strokeLinecap="round" opacity="0.8" />
        {mood === 'happy' ? (
          <g stroke="#14261C" strokeWidth={3} fill="none" strokeLinecap="round">
            <path d="M36 60 Q41 54 46 60" /><path d="M54 60 Q59 54 64 60" />
          </g>
        ) : (
          <g fill="#14261C">
            <ellipse cx="41" cy="58" rx="5.4" ry="7.4" /><ellipse cx="59" cy="58" rx="5.4" ry="7.4" />
          </g>
        )}
        <ellipse cx="50" cy="76" rx={mood === 'happy' ? 6 : 4} ry={mood === 'happy' ? 3 : 5} fill="#14261C" />
        <SunHat color={color} y={30} />
      </g>
    </svg>
  )
}

/** Guest or ghost, by state. */
export function Figure({ color, ghost, mood = 'idle', size = 80, className }: { color: string; ghost: boolean; mood?: GuestMood; size?: number; className?: string }) {
  return ghost
    ? <Ghost color={color} size={size} className={className} mood={mood === 'happy' ? 'happy' : 'idle'} />
    : <Guest color={color} size={size} mood={mood} className={className} />
}

/** A round head-and-hat portrait for rows and chips. */
export function Face({ color, ghost, size = 40, mood = 'idle' }: { color: string; ghost: boolean; size?: number; mood?: GuestMood }) {
  const S = size * 1.85
  return (
    <span className="relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full" style={{ width: size, height: size, background: ghost ? '#0E2018' : HOTEL.wall3, boxShadow: `inset 0 0 0 ${Math.max(2, size * 0.07)}px ${color}` }}>
      <span className="absolute" style={{ left: size / 2 - (50 * S) / 130, top: size / 2 - ((ghost ? 50 : 42) * S) / 130 }}>
        {ghost ? <Ghost color={color} size={S} float={false} /> : <Guest color={color} size={S} mood={mood} />}
      </span>
    </span>
  )
}
