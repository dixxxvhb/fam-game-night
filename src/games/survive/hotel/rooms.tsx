import type { ReactNode } from 'react'
import { cx } from '../../../ui/kit'
import type { TrapKind } from '../traps'
import { DISPLAY, HOTEL, SIGN } from './look'

/**
 * Every trap is a room of the Grand Palmetto, with its own illustrated card.
 * The rules engine still calls them math / odd / memory / quick / door.
 */
export const ROOMS: Record<TrapKind, { name: string; where: string; rule: string; intro: string }> = {
  math: { name: 'The Front Desk', where: 'Lobby', rule: 'Settle your bill. Three sums, ten seconds. One wrong and you stay forever.', intro: 'Your bill is ready. We do not take cards.' },
  odd: { name: 'The Wallpaper Room', where: 'Room 208', rule: 'One square of wallpaper is wrong. Find it three times.', intro: 'We had it redone in 1971. Mostly.' },
  memory: { name: 'The Elevator', where: 'Going down', rule: 'Four floors light up. Press them back in the same order.', intro: 'It only goes down. Mind the doors.' },
  quick: { name: 'The Ice Machine', where: 'Second floor', rule: 'Grab the ice when it says NOW. Not before. Not slowly.', intro: 'It has not worked since 1973. Tonight it does.' },
  door: { name: 'Room 13', where: 'Thirteenth floor', rule: 'Three doors. Somebody is already staying in one of them.', intro: 'We do not have a thirteenth floor. Go on up.' },
}

const INK = '#0B0705'

function FrontDesk() {
  return (
    <g>
      <rect width="360" height="220" fill="#2A1A10" />
      {/* key cubbies */}
      <rect x="60" y="18" width="240" height="108" fill="#1C110A" stroke={INK} strokeWidth="3" />
      {Array.from({ length: 18 }, (_, i) => {
        const cx = 60 + (i % 6) * 40
        const cy = 18 + Math.floor(i / 6) * 36
        const has = [0, 2, 3, 7, 9, 10, 14, 16].includes(i)
        return (
          <g key={i}>
            <rect x={cx + 3} y={cy + 3} width="34" height="30" fill="#130B06" stroke="#4A2E1A" strokeWidth="2" />
            <text x={cx + 20} y={cy + 13} textAnchor="middle" fontFamily={SIGN} fontSize="8" fill={HOTEL.brass}>{100 + i + 1 + Math.floor(i / 6) * 94}</text>
            {has && <g><circle cx={cx + 20} cy={cy + 18} r="2" fill={HOTEL.brass} /><path d={`M${cx + 20} ${cy + 18} v8`} stroke={HOTEL.brass} strokeWidth="2" /><path d={`M${cx + 15} ${cy + 26} h10 l-5 6 z`} fill={HOTEL.brass} /></g>}
          </g>
        )
      })}
      {/* bell light */}
      <circle cx="252" cy="150" r="60" fill={HOTEL.candle} opacity="0.1" />
      {/* desk */}
      <rect x="0" y="140" width="360" height="80" fill="#4A2A16" stroke={INK} strokeWidth="3" />
      <rect x="0" y="134" width="360" height="12" fill="#6B3E20" stroke={INK} strokeWidth="3" />
      {[30, 120, 210, 300].map((x) => <rect key={x} x={x} y="156" width="56" height="54" rx="3" fill="#3C2010" stroke="#2A160A" strokeWidth="2" />)}
      {/* ledger */}
      <g transform="rotate(-4 120 122)">
        <path d="M70 128 L120 122 L170 128 L170 104 L120 98 L70 104 Z" fill={HOTEL.paper} stroke={INK} strokeWidth="2.5" />
        <path d="M120 98 V122" stroke={INK} strokeWidth="2" />
        <text x="95" y="117" textAnchor="middle" fontFamily={SIGN} fontSize="11" fill={HOTEL.blood}>37+18</text>
        <path d="M128 108 h34 M128 114 h28" stroke="#8A7A5A" strokeWidth="1.5" />
      </g>
      {/* bell */}
      <path d="M236 132 Q236 112 252 112 Q268 112 268 132 Z" fill={HOTEL.brass} stroke={INK} strokeWidth="2.5" />
      <rect x="232" y="131" width="40" height="5" rx="2" fill={HOTEL.brassDark} stroke={INK} strokeWidth="2" />
      <circle cx="252" cy="109" r="3" fill={HOTEL.brassLight} stroke={INK} strokeWidth="1.5" />
      <text x="320" y="40" textAnchor="middle" fontFamily={SIGN} fontSize="10" fill={HOTEL.brass} opacity="0.7">NO</text>
      <text x="320" y="52" textAnchor="middle" fontFamily={SIGN} fontSize="10" fill={HOTEL.brass} opacity="0.7">REFUNDS</text>
    </g>
  )
}

function Wallpaper() {
  return (
    <g>
      <rect width="360" height="220" fill="#1A2E22" />
      {Array.from({ length: 24 }, (_, i) => {
        const x = 12 + (i % 6) * 56
        const y = 10 + Math.floor(i / 6) * 50
        const odd = i === 15
        return (
          <g key={i}>
            <rect x={x} y={y} width="52" height="46" fill={odd ? '#3F5E2A' : '#2A4A35'} stroke="#13221A" strokeWidth="2" />
            <path d={`M${x + 26} ${y + 6} C${x + 18} ${y + 18} ${x + 18} ${y + 26} ${x + 26} ${y + 34} C${x + 34} ${y + 26} ${x + 34} ${y + 18} ${x + 26} ${y + 6} Z`} fill="none" stroke={odd ? HOTEL.lime : '#4E7A5C'} strokeWidth="2" />
            <path d={`M${x + 26} ${y + 34} V${y + 42} M${x + 14} ${y + 30} Q${x + 26} ${y + 36} ${x + 38} ${y + 30}`} stroke={odd ? HOTEL.lime : '#4E7A5C'} strokeWidth="2" fill="none" />
          </g>
        )
      })}
      {/* peel */}
      <path d="M300 10 L348 10 L348 60 Q330 40 300 10 Z" fill="#0C1610" />
      <path d="M300 10 Q330 40 348 60 Q320 52 306 30 Z" fill="#C9B98E" stroke={INK} strokeWidth="2" />
      {/* crooked frame */}
      <g transform="rotate(-8 90 90)">
        <rect x="60" y="62" width="62" height="50" fill="#3A2614" stroke={HOTEL.brass} strokeWidth="5" />
        <path d="M66 104 Q80 80 92 96 Q100 84 116 104 Z" fill="#2B5A6A" />
        <circle cx="104" cy="76" r="6" fill={HOTEL.candle} opacity="0.8" />
      </g>
      {/* skirting */}
      <rect x="0" y="206" width="360" height="14" fill="#2B1A0E" stroke={INK} strokeWidth="2" />
    </g>
  )
}

function Elevator() {
  return (
    <g>
      <rect width="360" height="220" fill="#1A120C" />
      <rect x="80" y="8" width="200" height="212" fill={HOTEL.brassDark} stroke={INK} strokeWidth="3" />
      {/* the dial */}
      <path d="M130 52 A50 50 0 0 1 230 52 Z" fill="#2A1A0E" stroke={HOTEL.brass} strokeWidth="4" />
      {['B', '1', '2', '3', '13'].map((t, i) => {
        const a = Math.PI - (i * Math.PI) / 4
        return <text key={t} x={180 + Math.cos(a) * 38} y={50 - Math.sin(a) * 34} textAnchor="middle" fontFamily={SIGN} fontSize="10" fill={HOTEL.brassLight}>{t}</text>
      })}
      <path d="M180 50 L150 30" stroke={HOTEL.blood} strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="180" cy="50" r="4" fill={HOTEL.brass} />
      {/* doors */}
      <rect x="96" y="62" width="83" height="158" fill="#B8893A" stroke={INK} strokeWidth="3" />
      <rect x="181" y="62" width="83" height="158" fill="#B8893A" stroke={INK} strokeWidth="3" />
      {[0, 1].map((side) => {
        const cx = side ? 181 : 179
        return (
          <g key={side} stroke="#7C5A1C" strokeWidth="2.5" fill="none">
            {[0, 1, 2, 3, 4].map((k) => <path key={k} d={`M${cx} 140 L${cx + (side ? 1 : -1) * 80} ${80 + k * 30}`} />)}
          </g>
        )
      })}
      <rect x="176" y="62" width="8" height="158" fill="#0B0705" />
      {/* button panel */}
      <rect x="296" y="80" width="42" height="104" rx="6" fill="#2A1A0E" stroke={HOTEL.brass} strokeWidth="3" />
      {['#FF6B3D', '#3CCB72', '#6A9BFF', '#FFB547'].map((c, i) => (
        <g key={c}>
          <circle cx="317" cy={98 + i * 22} r="8" fill={c} opacity={i === 2 ? 1 : 0.35} stroke={INK} strokeWidth="2" />
          {i === 2 && <circle cx="317" cy={98 + i * 22} r="14" fill={c} opacity="0.25" />}
        </g>
      ))}
      <rect x="20" y="70" width="44" height="22" rx="3" fill="#120A05" stroke={HOTEL.brass} strokeWidth="2" />
      <text x="42" y="86" textAnchor="middle" fontFamily={SIGN} fontSize="11" fill={HOTEL.blood}>DOWN</text>
    </g>
  )
}

function IceMachine() {
  return (
    <g>
      <rect width="360" height="220" fill="#0F1A1E" />
      <circle cx="180" cy="80" r="110" fill="#7FD8FF" opacity="0.08" />
      <rect x="0" y="190" width="360" height="30" fill="#2A1414" />
      {/* the machine */}
      <rect x="110" y="30" width="140" height="170" rx="8" fill="#C9CFC8" stroke={INK} strokeWidth="3" />
      <rect x="118" y="40" width="124" height="34" rx="4" fill="#0B1418" stroke={INK} strokeWidth="2.5" />
      <text x="180" y="66" textAnchor="middle" fontFamily={DISPLAY} fontSize="28" fill="#8FE4FF">ICE</text>
      <rect x="128" y="88" width="104" height="70" rx="4" fill="#1E2A2E" stroke={INK} strokeWidth="2.5" />
      {[[140, 140], [158, 146], [176, 138], [196, 146], [214, 140], [150, 128], [190, 128]].map(([x, y], i) => (
        <rect key={i} x={x} y={y} width="14" height="12" rx="3" fill="#DDF6FF" stroke="#7FB5C8" strokeWidth="1.5" transform={`rotate(${(i * 23) % 30 - 15} ${x + 7} ${y + 6})`} />
      ))}
      <rect x="160" y="166" width="40" height="8" rx="3" fill="#8A928A" stroke={INK} strokeWidth="2" />
      {/* frost and a drip */}
      <path d="M110 40 L118 30 L126 42 L134 30 L142 40" fill="none" stroke="#EFFBFF" strokeWidth="2" />
      <path d="M232 200 Q236 210 232 214 Q228 210 232 200 Z" fill="#9FD8FF" />
      {/* sign */}
      <rect x="270" y="50" width="70" height="40" fill={HOTEL.paper} stroke={INK} strokeWidth="2" transform="rotate(6 305 70)" />
      <text x="305" y="68" textAnchor="middle" fontFamily={SIGN} fontSize="9" fill={HOTEL.paperInk} transform="rotate(6 305 70)">OUT OF</text>
      <text x="305" y="80" textAnchor="middle" fontFamily={SIGN} fontSize="9" fill={HOTEL.paperInk} transform="rotate(6 305 70)">ORDER</text>
      <path d="M272 58 L338 84" stroke={HOTEL.blood} strokeWidth="2.5" />
    </g>
  )
}

function Room13() {
  return (
    <g>
      <rect width="360" height="220" fill="#170C0C" />
      <path d="M0 220 L120 120 H240 L360 220 Z" fill={HOTEL.carpet} />
      <path d="M150 120 L120 220 M210 120 L240 220" stroke="#3E0C0C" strokeWidth="3" />
      {[0, 1, 2].map((i) => {
        const x = 36 + i * 108
        const lit = i === 1
        return (
          <g key={i}>
            <rect x={x} y="18" width="72" height="136" rx="3" fill="#3B2416" stroke={INK} strokeWidth="3" />
            <rect x={x + 8} y="28" width="56" height="50" fill="#2A180C" stroke="#1C0F07" strokeWidth="2" />
            <rect x={x + 8} y="86" width="56" height="58" fill="#2A180C" stroke="#1C0F07" strokeWidth="2" />
            <circle cx={x + 60} cy="90" r="4" fill={HOTEL.brass} stroke={INK} strokeWidth="1.5" />
            <rect x={x + 20} y="6" width="32" height="12" rx="2" fill={HOTEL.brass} stroke={INK} strokeWidth="1.5" />
            <text x={x + 36} y="16" textAnchor="middle" fontFamily={SIGN} fontSize="10" fill={HOTEL.paperInk}>{`13${i + 1}`}</text>
            {lit && <path d={`M${x} 154 H${x + 72} L${x + 90} 172 H${x - 18} Z`} fill={HOTEL.blood} opacity="0.55" />}
          </g>
        )
      })}
      <rect x="162" y="50" width="36" height="12" rx="2" fill={HOTEL.paper} stroke={INK} strokeWidth="1.5" transform="rotate(-10 180 56)" />
      <text x="180" y="59" textAnchor="middle" fontFamily={SIGN} fontSize="8" fill={HOTEL.blood} transform="rotate(-10 180 56)">OCCUPIED</text>
    </g>
  )
}

const ART: Record<TrapKind, () => ReactNode> = { math: FrontDesk, odd: Wallpaper, memory: Elevator, quick: IceMachine, door: Room13 }

/** The room's picture alone, 360 x 220. */
export function RoomArt({ kind, className }: { kind: TrapKind; className?: string }) {
  const A = ART[kind]
  return (
    <svg viewBox="0 0 360 220" className={cx('block w-full', className)} preserveAspectRatio="xMidYMid slice" aria-hidden>
      <A />
      <rect width="360" height="220" fill="url(#sv-vignette)" />
      <defs>
        <radialGradient id="sv-vignette" cx="50%" cy="45%" r="70%">
          <stop offset="0.55" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.6" />
        </radialGradient>
      </defs>
    </svg>
  )
}

/** The illustrated room card: picture in a brass frame, the room name on a plate. */
export function RoomCard({ kind, size = 'tv', className, children }: { kind: TrapKind; size?: 'tv' | 'phone' | 'mini'; className?: string; children?: ReactNode }) {
  const r = ROOMS[kind]
  const tv = size === 'tv'
  return (
    <div
      className={cx('relative overflow-hidden', tv ? 'rounded-[18px] p-3' : 'rounded-[14px] p-2', className)}
      style={{ background: `linear-gradient(160deg, ${HOTEL.brassLight}, ${HOTEL.brass} 40%, ${HOTEL.brassDark})`, boxShadow: '0 14px 30px rgba(0,0,0,0.6)' }}
    >
      <div className={cx('relative overflow-hidden', tv ? 'rounded-[10px]' : 'rounded-[8px]')} style={{ boxShadow: `inset 0 0 0 3px ${INK}` }}>
        <RoomArt kind={kind} />
        {children}
      </div>
      <div className={cx('flex items-baseline justify-between gap-3', tv ? 'px-2 pt-2' : 'px-1 pt-1.5')}>
        <span style={{ fontFamily: DISPLAY, color: HOTEL.paperInk, fontSize: tv ? 44 : size === 'phone' ? 30 : 20, lineHeight: 1 }}>{r.name}</span>
        <span className="uppercase tracking-[0.16em]" style={{ fontFamily: SIGN, color: '#3C2A10', fontSize: tv ? 18 : 12 }}>{r.where}</span>
      </div>
    </div>
  )
}
