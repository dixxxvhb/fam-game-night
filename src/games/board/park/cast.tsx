import type { ReactNode } from 'react'

/**
 * The Party Park cast: eight Florida critters you can play as, plus Mingo, the park's
 * flamingo mascot who hosts. All drawn here as flat sticker art (one ink outline, one
 * shade, one highlight) in a 120 x 140 box with the feet on y = 136, so a token can stand
 * on a board space. Moods change the face; motion lives in CSS (pp-* classes in index.css).
 */

export const INK = '#1E1838'

export type Mood = 'idle' | 'happy' | 'sad' | 'hop'

export type CritterId = 'chomp' | 'mattie' | 'pete' | 'pickles' | 'dillo' | 'ibby' | 'shelly' | 'zippy'

export interface Critter {
  id: CritterId
  name: string
  /** What they are, plain. */
  kind: string
  /** One deadpan line for the pick screen. */
  bio: string
  /** Main fill: token rings, name plates, HUD frames. */
  color: string
  /** Readable text color on top of `color`. */
  on: string
}

export const CAST: Critter[] = [
  { id: 'chomp', name: 'Chomp', kind: 'Alligator', bio: 'Lives in a retention pond behind a Publix. Thriving.', color: '#4DB84A', on: '#10301A' },
  { id: 'mattie', name: 'Mattie', kind: 'Manatee', bio: 'Top speed 5 mph. Has never once been in a hurry.', color: '#8EA6C2', on: '#18263A' },
  { id: 'pete', name: 'Pete', kind: 'Pelican', bio: 'Will steal your sandwich. Will not apologize.', color: '#FFA02E', on: '#3A1E00' },
  { id: 'pickles', name: 'Pickles', kind: 'Possum', bio: 'Plays dead when losing. So, often.', color: '#A9A1B8', on: '#231D30' },
  { id: 'dillo', name: 'Dillo', kind: 'Armadillo', bio: 'Rolls into a ball at the first red space.', color: '#C99560', on: '#33200C' },
  { id: 'ibby', name: 'Ibby', kind: 'White ibis', bio: 'Eats out of the trash. Has never been happier.', color: '#F0605A', on: '#FFFFFF' },
  { id: 'shelly', name: 'Shelly', kind: 'Sea turtle', bio: 'Has been on this beach since 1982. Seen things.', color: '#2C9C86', on: '#FFFFFF' },
  { id: 'zippy', name: 'Zippy', kind: 'Anole', bio: 'Does push-ups at you. Means it.', color: '#79CF34', on: '#173006' },
]

export const CAST_IDS = CAST.map((c) => c.id)

export function critter(id: string | null | undefined): Critter | null {
  return CAST.find((c) => c.id === id) ?? null
}

export function isCritterId(x: unknown): x is CritterId {
  return typeof x === 'string' && (CAST_IDS as string[]).includes(x)
}

// ---------------- shared face parts ----------------

const SW = 3.5

function Eye({ x, y, mood, s = 1, iris }: { x: number; y: number; mood: Mood; s?: number; iris?: string }) {
  if (mood === 'happy') {
    return <path d={`M${x - 6.5 * s} ${y + 2 * s} Q${x} ${y - 7 * s} ${x + 6.5 * s} ${y + 2 * s}`} fill="none" stroke={INK} strokeWidth={SW} strokeLinecap="round" />
  }
  const dy = mood === 'sad' ? 2.4 * s : 1.2 * s
  return (
    <g className="pp-blink" style={{ transformOrigin: `${x}px ${y}px` }}>
      <ellipse cx={x} cy={y} rx={7.2 * s} ry={8.8 * s} fill="#fff" stroke={INK} strokeWidth={SW * 0.85} />
      {iris && <ellipse cx={x + 0.8 * s} cy={y + dy} rx={4.6 * s} ry={5.4 * s} fill={iris} />}
      <ellipse cx={x + 0.8 * s} cy={y + dy} rx={3.4 * s} ry={4.2 * s} fill={INK} />
      <circle cx={x + 2 * s} cy={y + dy - 1.8 * s} r={1.3 * s} fill="#fff" />
    </g>
  )
}

function Brows({ l, r, y, mood }: { l: number; r: number; y: number; mood: Mood }) {
  if (mood !== 'sad') return null
  return (
    <g stroke={INK} strokeWidth={SW} strokeLinecap="round">
      <path d={`M${l - 7} ${y - 9} L${l + 5} ${y - 14}`} />
      <path d={`M${r + 7} ${y - 9} L${r - 5} ${y - 14}`} />
    </g>
  )
}

function Eyes({ l, r, y, mood, s, iris }: { l: number; r: number; y: number; mood: Mood; s?: number; iris?: string }) {
  return (
    <>
      <Eye x={l} y={y} mood={mood} s={s} iris={iris} />
      <Eye x={r} y={y} mood={mood} s={s} iris={iris} />
      <Brows l={l} r={r} y={y} mood={mood} />
    </>
  )
}

function Mouth({ x, y, w, mood }: { x: number; y: number; w: number; mood: Mood }) {
  if (mood === 'happy' || mood === 'hop') {
    return (
      <g>
        <path d={`M${x - w} ${y} Q${x} ${y + w * 1.7} ${x + w} ${y} Z`} fill="#6E1838" stroke={INK} strokeWidth={SW * 0.85} strokeLinejoin="round" />
        <ellipse cx={x} cy={y + w * 0.62} rx={w * 0.45} ry={w * 0.22} fill="#FF7E95" />
      </g>
    )
  }
  if (mood === 'sad') return <path d={`M${x - w * 0.7} ${y + 4} Q${x} ${y - 3} ${x + w * 0.7} ${y + 4}`} fill="none" stroke={INK} strokeWidth={SW} strokeLinecap="round" />
  return <path d={`M${x - w * 0.7} ${y} Q${x} ${y + w * 0.7} ${x + w * 0.7} ${y}`} fill="none" stroke={INK} strokeWidth={SW} strokeLinecap="round" />
}

function Cheeks({ l, r, y, show }: { l: number; r: number; y: number; show: boolean }) {
  if (!show) return null
  return (
    <g fill="#FF6F8E" opacity={0.45}>
      <ellipse cx={l} cy={y} rx={6} ry={3.4} />
      <ellipse cx={r} cy={y} rx={6} ry={3.4} />
    </g>
  )
}

const o = { stroke: INK, strokeWidth: SW, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }

/** A thick outlined stroke (tails, legs, beaks): ink underneath, color on top. */
function Tube({ d, w, color }: { d: string; w: number; color: string }) {
  return (
    <>
      <path d={d} fill="none" stroke={INK} strokeWidth={w + SW * 2} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
    </>
  )
}

const BEAN = 'M60 50 C94 50 100 80 98 104 C96 130 80 136 60 136 C40 136 24 130 22 104 C20 80 26 50 60 50 Z'

// ---------------- the critters ----------------

function Chomp({ mood }: { mood: Mood }) {
  const body = '#58C454'
  const dark = '#3A9A3E'
  return (
    <>
      <Tube d="M88 122 C108 126 116 116 112 100" w={12} color={body} />
      <ellipse cx="44" cy="134" rx="13" ry="6.5" fill={dark} {...o} />
      <ellipse cx="76" cy="134" rx="13" ry="6.5" fill={dark} {...o} />
      <path d={BEAN} fill={body} {...o} />
      <path d="M38 132 C30 120 30 98 42 88 C52 82 68 82 78 88 C90 98 90 120 82 132 Z" fill="#F2E6A6" />
      <g stroke="#D6C47A" strokeWidth="2.5" strokeLinecap="round">
        <path d="M42 98 H78" /><path d="M38 110 H82" /><path d="M40 122 H80" />
      </g>
      <ellipse cx="24" cy="98" rx="8" ry="12" transform="rotate(20 24 98)" fill={body} {...o} />
      <ellipse cx="96" cy="98" rx="8" ry="12" transform="rotate(-20 96 98)" fill={body} {...o} />
      <circle cx="42" cy="32" r="15" fill={body} {...o} />
      <circle cx="78" cy="32" r="15" fill={body} {...o} />
      <rect x="12" y="38" width="96" height="36" rx="18" fill={body} {...o} />
      <path d="M20 46 Q60 40 100 46" fill="none" stroke="#7BD877" strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="50" cy="48" rx="3" ry="2.2" fill={dark} />
      <ellipse cx="70" cy="48" rx="3" ry="2.2" fill={dark} />
      {mood === 'sad'
        ? <path d="M22 70 Q60 58 98 70" fill="none" {...o} />
        : (
          <>
            <path d="M24 64 l5 8 l5 -6 l5 8 l5 -7 l5 8 l5 -7 l5 8 l5 -7 l5 8 l5 -7 l5 8 l5 -6 l5 8" fill="#fff" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
            <path d="M18 62 Q60 76 102 62" fill="none" {...o} />
          </>
        )}
      <Eyes l={42} r={78} y={30} mood={mood} s={0.95} iris="#E0B21C" />
    </>
  )
}

function Mattie({ mood }: { mood: Mood }) {
  const body = '#93A9C2'
  const dark = '#6F86A1'
  return (
    <>
      <ellipse cx="60" cy="134" rx="26" ry="7" fill={dark} {...o} />
      <path d="M60 30 C88 30 102 56 103 90 C104 122 86 136 60 136 C34 136 16 122 17 90 C18 56 32 30 60 30 Z" fill={body} {...o} />
      <path d="M30 118 C40 128 80 128 90 118" fill="none" stroke={dark} strokeWidth="3" strokeLinecap="round" />
      <path d="M36 106 C46 112 74 112 84 106" fill="none" stroke={dark} strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="18" cy="100" rx="9" ry="16" transform="rotate(28 18 100)" fill={dark} {...o} />
      <ellipse cx="102" cy="100" rx="9" ry="16" transform="rotate(-28 102 100)" fill={dark} {...o} />
      <ellipse cx="60" cy="70" rx="28" ry="18" fill="#C6D4E3" {...o} />
      <path d="M60 58 V66" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      <g fill={INK}>
        <circle cx="44" cy="66" r="1.6" /><circle cx="49" cy="72" r="1.6" /><circle cx="43" cy="75" r="1.6" />
        <circle cx="76" cy="66" r="1.6" /><circle cx="71" cy="72" r="1.6" /><circle cx="77" cy="75" r="1.6" />
      </g>
      <Mouth x={60} y={84} w={8} mood={mood} />
      <Eyes l={45} r={75} y={47} mood={mood} s={0.72} />
      <Cheeks l={34} r={86} y={62} show={mood === 'happy' || mood === 'idle'} />
    </>
  )
}

function Pete({ mood }: { mood: Mood }) {
  const body = '#F7F5EF'
  const shade = '#D8D2C4'
  return (
    <>
      <ellipse cx="46" cy="134" rx="12" ry="6" fill="#FF9A2A" {...o} />
      <ellipse cx="74" cy="134" rx="12" ry="6" fill="#FF9A2A" {...o} />
      <path d={BEAN} fill={body} {...o} />
      <path d="M26 112 C30 128 46 134 60 134 C74 134 90 128 94 112 C84 122 36 122 26 112 Z" fill={shade} />
      <ellipse cx="25" cy="96" rx="10" ry="20" transform="rotate(14 25 96)" fill={shade} {...o} />
      <ellipse cx="95" cy="96" rx="10" ry="20" transform="rotate(-14 95 96)" fill={shade} {...o} />
      <path d="M52 12 Q58 2 62 12 Q68 4 70 14" fill="none" stroke="#F2C230" strokeWidth="4" strokeLinecap="round" />
      <circle cx="60" cy="36" r="24" fill={body} {...o} />
      <path d="M58 46 Q84 82 108 58 L112 50 Q84 52 64 44 Z" fill="#FF8A24" {...o} />
      <path d="M58 44 L114 46 Q116 50 112 52 L60 52 Z" fill="#FFB43C" {...o} />
      <Eyes l={50} r={68} y={32} mood={mood} s={0.8} />
      <Cheeks l={42} r={78} y={44} show={mood === 'happy'} />
    </>
  )
}

function Pickles({ mood }: { mood: Mood }) {
  const fur = '#B9B2C4'
  const dark = '#8C84A0'
  return (
    <>
      <Tube d="M30 124 C6 122 2 98 16 92 C24 89 26 98 20 100" w={7} color="#F3A9B9" />
      <ellipse cx="45" cy="134" rx="11" ry="6" fill="#F3A9B9" {...o} />
      <ellipse cx="75" cy="134" rx="11" ry="6" fill="#F3A9B9" {...o} />
      <path d={BEAN} fill={fur} {...o} />
      <path d="M40 132 C34 118 36 100 46 94 C54 90 66 90 74 94 C84 100 86 118 80 132 Z" fill="#E6E0EC" />
      <ellipse cx="26" cy="100" rx="7" ry="11" transform="rotate(20 26 100)" fill={dark} {...o} />
      <ellipse cx="94" cy="100" rx="7" ry="11" transform="rotate(-20 94 100)" fill={dark} {...o} />
      <circle cx="31" cy="28" r="13" fill="#2A2438" {...o} />
      <circle cx="89" cy="28" r="13" fill="#2A2438" {...o} />
      <circle cx="31" cy="28" r="6" fill="#F3A9B9" />
      <circle cx="89" cy="28" r="6" fill="#F3A9B9" />
      <path d="M60 22 C86 22 98 40 94 56 C90 70 74 80 60 88 C46 80 30 70 26 56 C22 40 34 22 60 22 Z" fill="#F8F4F9" {...o} />
      <path d="M60 22 C66 30 66 40 60 46 C54 40 54 30 60 22 Z" fill={fur} />
      <ellipse cx="47" cy="52" rx="11" ry="10" fill="#D9D2E2" />
      <ellipse cx="73" cy="52" rx="11" ry="10" fill="#D9D2E2" />
      <ellipse cx="60" cy="84" rx="6.5" ry="5" fill="#FF8FA3" {...o} />
      <path d="M60 22 C66 30 66 40 60 46 C54 40 54 30 60 22 Z" fill="none" stroke={INK} strokeWidth="0" />
      <Eyes l={47} r={73} y={52} mood={mood} s={0.85} />
      {mood === 'sad' && <path d="M52 98 Q60 94 68 98" fill="none" {...o} />}
    </>
  )
}

function Dillo({ mood }: { mood: Mood }) {
  const shell = '#C4966A'
  const band = '#9C7048'
  const skin = '#EBC9A2'
  return (
    <>
      <ellipse cx="42" cy="134" rx="11" ry="6" fill={band} {...o} />
      <ellipse cx="78" cy="134" rx="11" ry="6" fill={band} {...o} />
      <path d="M28 108 C28 128 44 134 60 134 C76 134 92 128 92 108 Z" fill={skin} {...o} />
      <path d="M12 114 C10 70 34 54 60 54 C86 54 110 70 108 114 C92 120 28 120 12 114 Z" fill={shell} {...o} />
      <g fill="none" stroke={band} strokeWidth="3.4" strokeLinecap="round">
        <path d="M22 76 C46 68 74 68 98 76" /><path d="M16 90 C44 82 76 82 104 90" /><path d="M13 104 C44 96 76 96 107 104" />
      </g>
      <g fill={band}><circle cx="34" cy="83" r="1.8" /><circle cx="60" cy="80" r="1.8" /><circle cx="86" cy="83" r="1.8" /><circle cx="48" cy="97" r="1.8" /><circle cx="72" cy="97" r="1.8" /></g>
      <ellipse cx="40" cy="22" rx="8" ry="15" transform="rotate(-22 40 22)" fill={skin} {...o} />
      <ellipse cx="80" cy="22" rx="8" ry="15" transform="rotate(22 80 22)" fill={skin} {...o} />
      <ellipse cx="40" cy="23" rx="3.5" ry="9" transform="rotate(-22 40 23)" fill="#D9A07E" />
      <ellipse cx="80" cy="23" rx="3.5" ry="9" transform="rotate(22 80 23)" fill="#D9A07E" />
      <path d="M36 44 C36 28 84 28 84 44 C84 56 72 60 68 66 L62 84 Q60 88 58 84 L52 66 C48 60 36 56 36 44 Z" fill={skin} {...o} />
      <path d="M44 34 C50 28 70 28 76 34 C70 38 50 38 44 34 Z" fill={shell} {...o} />
      <ellipse cx="60" cy="84" rx="4.5" ry="3.5" fill={INK} />
      <Eyes l={50} r={70} y={47} mood={mood} s={0.66} />
      <Cheeks l={42} r={78} y={58} show={mood === 'happy'} />
    </>
  )
}

function Ibby({ mood }: { mood: Mood }) {
  const body = '#FBFAF6'
  const shade = '#DCD8CE'
  const red = '#F25A55'
  return (
    <>
      <Tube d="M50 112 L48 132" w={5} color={red} />
      <Tube d="M70 112 L72 132" w={5} color={red} />
      <path d="M40 133 L56 133 M64 133 L80 133" stroke={INK} strokeWidth="5" strokeLinecap="round" />
      <path d="M60 54 C90 54 98 78 96 96 C94 114 78 120 60 120 C42 120 26 114 24 96 C22 78 30 54 60 54 Z" fill={body} {...o} />
      <path d="M78 112 C92 108 100 98 104 88 C98 104 88 116 74 118 Z" fill={INK} />
      <ellipse cx="27" cy="88" rx="9" ry="17" transform="rotate(12 27 88)" fill={shade} {...o} />
      <path d="M22 98 C20 106 24 112 30 108 Z" fill={INK} />
      <ellipse cx="93" cy="88" rx="9" ry="17" transform="rotate(-12 93 88)" fill={shade} {...o} />
      <circle cx="60" cy="36" r="22" fill={body} {...o} />
      <path d="M44 44 C48 58 72 58 78 44 C72 50 50 50 44 44 Z" fill={red} />
      <Tube d="M66 48 C84 54 98 70 104 90" w={6} color="#EE6E5B" />
      <Eyes l={51} r={69} y={33} mood={mood} s={0.78} iris="#7FB8E8" />
    </>
  )
}

function Shelly({ mood }: { mood: Mood }) {
  const shell = '#2E9D86'
  const plate = '#4CC1A4'
  const skin = '#A8D876'
  return (
    <>
      <ellipse cx="44" cy="133" rx="13" ry="7" fill={skin} {...o} />
      <ellipse cx="76" cy="133" rx="13" ry="7" fill={skin} {...o} />
      <ellipse cx="18" cy="96" rx="9" ry="18" transform="rotate(34 18 96)" fill={skin} {...o} />
      <ellipse cx="102" cy="96" rx="9" ry="18" transform="rotate(-34 102 96)" fill={skin} {...o} />
      <ellipse cx="60" cy="98" rx="40" ry="38" fill={shell} {...o} />
      <g fill={plate}>
        <circle cx="26" cy="86" r="6" /><circle cx="94" cy="86" r="6" /><circle cx="30" cy="114" r="6" /><circle cx="90" cy="114" r="6" />
      </g>
      <ellipse cx="60" cy="100" rx="27" ry="31" fill="#F0E2A2" {...o} />
      <g fill="none" stroke="#CDB96A" strokeWidth="2.6" strokeLinecap="round">
        <path d="M60 70 V130" /><path d="M36 92 H84" /><path d="M36 110 H84" />
      </g>
      <circle cx="60" cy="40" r="25" fill={skin} {...o} />
      <g fill="#86BE55"><circle cx="44" cy="26" r="3" /><circle cx="76" cy="24" r="2.6" /><circle cx="80" cy="34" r="2" /></g>
      <Mouth x={60} y={52} w={9} mood={mood} />
      <Eyes l={49} r={71} y={37} mood={mood} s={0.8} />
      <Cheeks l={40} r={80} y={48} show={mood !== 'sad'} />
    </>
  )
}

function Zippy({ mood }: { mood: Mood }) {
  const body = '#80D63C'
  const dark = '#56AA22'
  const dew = mood === 'happy' || mood === 'hop' ? 15 : mood === 'sad' ? 5 : 9
  return (
    <>
      <Tube d="M84 126 C110 126 116 100 102 94 C94 91 92 100 98 102" w={9} color={body} />
      <ellipse cx="45" cy="134" rx="12" ry="6" fill={dark} {...o} />
      <ellipse cx="75" cy="134" rx="12" ry="6" fill={dark} {...o} />
      <path d="M60 58 C88 58 94 84 92 106 C90 128 78 136 60 136 C42 136 30 128 28 106 C26 84 32 58 60 58 Z" fill={body} {...o} />
      <path d="M44 132 C38 118 40 98 48 92 C54 88 66 88 72 92 C80 98 82 118 76 132 Z" fill="#D2EE98" />
      <ellipse cx="30" cy="100" rx="7" ry="11" transform="rotate(20 30 100)" fill={dark} {...o} />
      <ellipse cx="90" cy="100" rx="7" ry="11" transform="rotate(-20 90 100)" fill={dark} {...o} />
      <path d={`M${60 - dew * 0.9} 62 A${dew} ${dew} 0 0 0 ${60 + dew * 0.9} 62 Z`} fill="#FF4F6E" {...o} />
      <path d="M40 12 l5 -6 l5 6 l5 -6 l5 6 l5 -6 l5 6 l5 -6 l5 6" fill={dark} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
      <ellipse cx="60" cy="38" rx="30" ry="25" fill={body} {...o} />
      <circle cx="34" cy="32" r="12" fill={body} {...o} />
      <circle cx="86" cy="32" r="12" fill={body} {...o} />
      <path d="M48 54 Q60 58 72 54" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      <Eyes l={34} r={86} y={32} mood={mood} s={0.85} iris="#E8A21C" />
    </>
  )
}

/** Mingo: the park's mascot and your host. Flamingo, staff visor, lanyard, unbothered. */
export function Mingo({ size = 160, mood = 'idle', className }: { size?: number; mood?: Mood; className?: string }) {
  const pink = '#FF8FA2'
  const dark = '#EC6A84'
  const lid = mood === 'happy' ? null : <path d="M42 30 C42 22 58 22 58 30 Z M62 30 C62 22 78 22 78 30 Z" fill={pink} stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
  return (
    <svg viewBox="0 0 120 180" width={size * (120 / 180)} height={size} className={className} aria-hidden>
      <Tube d="M64 132 L64 176" w={5} color={dark} />
      <Tube d="M54 132 L48 152 L60 158" w={5} color={dark} />
      <path d="M58 176 H74" stroke={INK} strokeWidth="5" strokeLinecap="round" />
      <path d="M60 74 C94 74 104 98 100 116 C96 136 76 142 58 140 C40 138 22 128 22 108 C22 88 32 74 60 74 Z" fill={pink} {...o} />
      <path d="M86 92 C100 96 106 110 98 122 C96 110 90 100 82 98 Z" fill={dark} />
      <path d="M52 76 C46 66 54 58 60 52" fill="none" stroke={INK} strokeWidth={SW * 2 + 9} strokeLinecap="round" />
      <path d="M52 76 C46 66 54 58 60 52" fill="none" stroke={pink} strokeWidth="9" strokeLinecap="round" />
      <path d="M40 54 L60 104 L80 54" fill="none" stroke="#2DB5A8" strokeWidth="3" />
      <rect x="51" y="100" width="18" height="22" rx="3" fill="#fff" {...o} strokeWidth={2.6} />
      <rect x="55" y="105" width="10" height="3" rx="1.5" fill="#2DB5A8" />
      <rect x="55" y="111" width="10" height="2.4" rx="1.2" fill="#CFCAD8" />
      <circle cx="60" cy="34" r="22" fill={pink} {...o} />
      <path d="M36 22 C40 8 80 8 84 22 Z" fill="#2DB5A8" {...o} />
      <path d="M78 20 C92 18 100 22 102 26 C94 28 84 26 78 24 Z" fill="#2DB5A8" {...o} />
      <path d="M58 42 C70 40 84 44 86 54 C86 62 80 66 76 70 C76 62 72 56 60 52 Z" fill="#FFF4EE" {...o} />
      <path d="M86 54 C86 62 80 66 76 70 C76 64 78 60 80 56 Z" fill={INK} />
      <Eye x={50} y={32} mood={mood} s={0.7} />
      <Eye x={70} y={32} mood={mood} s={0.7} />
      {lid}
    </svg>
  )
}

const DRAW: Record<CritterId, (p: { mood: Mood }) => ReactNode> = {
  chomp: Chomp, mattie: Mattie, pete: Pete, pickles: Pickles, dillo: Dillo, ibby: Ibby, shelly: Shelly, zippy: Zippy,
}

/** Head framing for portraits: center x, center y, radius (in the 120 x 140 box). */
const HEAD: Record<CritterId, [number, number, number]> = {
  chomp: [60, 46, 42], mattie: [60, 62, 38], pete: [72, 40, 42], pickles: [60, 52, 42],
  dillo: [60, 44, 42], ibby: [70, 50, 40], shelly: [60, 44, 34], zippy: [60, 40, 40],
}

/**
 * One critter. `crop="head"` frames the face for portraits and HUD badges.
 * `anim` adds the motion class for the mood (bob, hop, cheer, slump) unless false.
 */
export function CritterArt({ id, mood = 'idle', size = 120, crop = 'full', anim = true, className, flip = false }: {
  id: CritterId | string
  mood?: Mood
  size?: number
  crop?: 'full' | 'head'
  anim?: boolean
  className?: string
  flip?: boolean
}) {
  const Draw = DRAW[(isCritterId(id) ? id : 'chomp') as CritterId]
  const [hx, hy, hr] = HEAD[(isCritterId(id) ? id : 'chomp') as CritterId]
  const vb = crop === 'head' ? `${hx - hr} ${hy - hr} ${hr * 2} ${hr * 2}` : '0 0 120 140'
  const ratio = crop === 'head' ? 1 : 140 / 120
  const motion = !anim ? '' : mood === 'happy' ? 'pp-cheer' : mood === 'sad' ? 'pp-slump' : mood === 'hop' ? 'pp-hop' : 'pp-bob'
  return (
    <svg viewBox={vb} width={size} height={size * ratio} className={className} aria-hidden overflow={crop === 'head' ? 'hidden' : 'visible'}>
      <g className={motion} style={{ transformOrigin: '60px 136px', transformBox: 'view-box' }}>
        <g transform={flip ? 'translate(120 0) scale(-1 1)' : undefined}>
          <Draw mood={mood} />
        </g>
      </g>
    </svg>
  )
}
