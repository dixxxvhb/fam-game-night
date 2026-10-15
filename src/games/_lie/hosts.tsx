import type { HostMood, ThemeId } from './theme'

const INK = '#1A1230'

/**
 * Polly, the Bluff host: a vintage polygraph on a stage, paper roll on top, a trace that
 * scrolls calm while you write, jitters while you pick and goes wild when a lie comes out.
 */
function Polly({ mood, size }: { mood: HostMood; size: number }) {
  const wild = mood === 'shock' || mood === 'nervous'
  const calm = 'M0 18 L8 18 L12 14 L16 22 L20 18 L36 18 L40 12 L44 24 L48 18 L64 18 L68 15 L72 21 L76 18 L96 18 L100 13 L104 23 L108 18 L128 18'
  const spiky = 'M0 18 L6 4 L10 32 L16 2 L22 30 L28 8 L32 34 L38 0 L44 28 L50 6 L56 33 L62 2 L68 26 L74 10 L80 34 L86 1 L92 29 L98 7 L104 32 L110 3 L116 30 L122 8 L128 18'
  const trace = wild ? spiky : calm
  const lid = mood === 'smug' ? 9 : 0
  const pupilR = mood === 'shock' ? 3.5 : 6
  return (
    <svg viewBox="0 0 200 184" width={size} height={size * 0.92} aria-hidden className="overflow-visible">
      <ellipse cx="100" cy="176" rx="76" ry="7" fill="#000" opacity="0.35" />
      {/* legs */}
      <rect x="40" y="150" width="14" height="24" rx="4" fill="#3B2E5A" stroke={INK} strokeWidth="4" />
      <rect x="146" y="150" width="14" height="24" rx="4" fill="#3B2E5A" stroke={INK} strokeWidth="4" />
      <g className={mood === 'talk' || mood === 'cheer' ? 'lie-host-talk' : 'lie-host-bob'} style={{ transformOrigin: '100px 160px' }}>
        {/* paper roll */}
        <circle cx="36" cy="40" r="11" fill="#D9CBB0" stroke={INK} strokeWidth="4" />
        <circle cx="164" cy="40" r="11" fill="#D9CBB0" stroke={INK} strokeWidth="4" />
        <rect x="36" y="22" width="128" height="36" rx="5" fill="#FFF8E6" stroke={INK} strokeWidth="4" />
        <svg x="40" y="24" width="120" height="32" viewBox="0 0 120 36" overflow="hidden">
          <g className={wild ? 'lie-trace lie-trace-fast' : 'lie-trace'}>
            <path d={trace} fill="none" stroke="#E0323C" strokeWidth={wild ? 2.4 : 2} strokeLinejoin="round" />
            <path d={trace} transform="translate(128 0)" fill="none" stroke="#E0323C" strokeWidth={wild ? 2.4 : 2} strokeLinejoin="round" />
          </g>
        </svg>
        {/* needle arm */}
        <path d="M150 64 L118 36" stroke={INK} strokeWidth="4" strokeLinecap="round" className={wild ? 'lie-needle lie-needle-fast' : 'lie-needle'} style={{ transformOrigin: '150px 64px' }} />
        {/* body */}
        <rect x="18" y="56" width="164" height="100" rx="20" fill="#29B5A5" stroke={INK} strokeWidth="5" />
        <rect x="26" y="62" width="148" height="10" rx="5" fill="#fff" opacity="0.22" />
        {/* face panel */}
        <rect x="38" y="76" width="124" height="58" rx="14" fill="#FFF1D6" stroke={INK} strokeWidth="4" />
        <g className="lie-blink" style={{ transformOrigin: '100px 100px' }}>
          <circle cx="76" cy="100" r="15" fill="#fff" stroke={INK} strokeWidth="3.5" />
          <circle cx="124" cy="100" r="15" fill="#fff" stroke={INK} strokeWidth="3.5" />
          <circle cx={mood === 'smug' ? 80 : 78} cy="102" r={pupilR} fill={INK} />
          <circle cx={mood === 'smug' ? 128 : 126} cy="102" r={pupilR} fill={INK} />
          {lid > 0 && (
            <>
              <path d="M60 99 A16 16 0 0 1 92 99 Z" fill="#29B5A5" stroke={INK} strokeWidth="3.5" />
              <path d="M108 99 A16 16 0 0 1 140 99 Z" fill="#29B5A5" stroke={INK} strokeWidth="3.5" />
            </>
          )}
        </g>
        {mood === 'shock' ? (
          <ellipse cx="100" cy="124" rx="6" ry="5" fill={INK} />
        ) : mood === 'cheer' || mood === 'talk' ? (
          <path d="M88 120 Q100 132 112 120 Z" fill={INK} />
        ) : (
          <path d={mood === 'smug' ? 'M90 124 Q102 128 112 120' : 'M90 123 Q100 128 110 123'} fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
        )}
        {mood === 'nervous' && <path d="M150 84 q6 10 0 14 q-6 -4 0 -14 Z" fill="#7FD6FF" stroke={INK} strokeWidth="2.5" />}
        {/* knobs and the light */}
        <circle cx="52" cy="145" r="6" fill="#FFD23F" stroke={INK} strokeWidth="3" />
        <circle cx="70" cy="145" r="6" fill="#FF8FAB" stroke={INK} strokeWidth="3" />
        <rect x="118" y="140" width="44" height="10" rx="5" fill="#1A1230" />
        <rect x="120" y="142" width={wild ? 40 : 18} height="6" rx="3" fill={wild ? '#E0323C' : '#3CCB72'} />
        <circle cx="100" cy="14" r="7" fill={mood === 'talk' || wild ? '#E0323C' : '#5B1820'} stroke={INK} strokeWidth="3" className={mood === 'talk' || wild ? 'lie-lamp' : undefined} />
        <rect x="97" y="18" width="6" height="6" fill={INK} />
      </g>
    </svg>
  )
}

/**
 * Webster, the Fake Word host: an owl in reading glasses with a quill behind one tuft.
 */
function Webster({ mood, size }: { mood: HostMood; size: number }) {
  const lid = mood === 'smug' || mood === 'idle'
  const pupilR = mood === 'shock' ? 3 : 6
  const brow = mood === 'shock' ? -6 : mood === 'smug' ? 3 : 0
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} aria-hidden className="overflow-visible">
      <ellipse cx="100" cy="192" rx="64" ry="6" fill="#000" opacity="0.3" />
      <g className={mood === 'talk' || mood === 'cheer' ? 'lie-host-talk' : 'lie-host-bob'} style={{ transformOrigin: '100px 190px' }}>
        {/* quill */}
        <path d="M150 20 C 170 0, 190 4, 186 16 C 176 22, 160 30, 146 46 Z" fill="#F4EBDD" stroke={INK} strokeWidth="3.5" />
        <path d="M184 12 L146 46" stroke={INK} strokeWidth="2.5" />
        {/* tufts */}
        <path d="M52 52 L44 18 L78 40 Z" fill="#7A4B2E" stroke={INK} strokeWidth="4.5" strokeLinejoin="round" />
        <path d="M148 52 L156 18 L122 40 Z" fill="#7A4B2E" stroke={INK} strokeWidth="4.5" strokeLinejoin="round" />
        {/* wings */}
        <g className={mood === 'cheer' ? 'lie-wing-up' : undefined} style={{ transformOrigin: '50px 120px' }}>
          <ellipse cx="44" cy="126" rx="20" ry="44" fill="#6B3F25" stroke={INK} strokeWidth="4.5" transform="rotate(12 44 126)" />
        </g>
        <g className={mood === 'cheer' ? 'lie-wing-up-r' : undefined} style={{ transformOrigin: '150px 120px' }}>
          <ellipse cx="156" cy="126" rx="20" ry="44" fill="#6B3F25" stroke={INK} strokeWidth="4.5" transform="rotate(-12 156 126)" />
        </g>
        {/* body */}
        <ellipse cx="100" cy="116" rx="62" ry="70" fill="#8A5A3B" stroke={INK} strokeWidth="5" />
        <ellipse cx="100" cy="142" rx="38" ry="40" fill="#EAD7AE" stroke={INK} strokeWidth="3.5" />
        {[0, 1, 2].map((r) => [0, 1, 2].map((c) => (
          <path key={`${r}${c}`} d={`M${80 + c * 14 + (r % 2) * 7} ${128 + r * 14} q5 5 10 0`} fill="none" stroke="#B48A55" strokeWidth="2.5" strokeLinecap="round" />
        )))}
        {/* face disc */}
        <circle cx="76" cy="84" r="30" fill="#F4E6C4" stroke={INK} strokeWidth="3.5" />
        <circle cx="124" cy="84" r="30" fill="#F4E6C4" stroke={INK} strokeWidth="3.5" />
        <g className="lie-blink" style={{ transformOrigin: '100px 84px' }}>
          <circle cx="76" cy="84" r="15" fill="#F2B233" stroke={INK} strokeWidth="3" />
          <circle cx="124" cy="84" r="15" fill="#F2B233" stroke={INK} strokeWidth="3" />
          <circle cx="77" cy="85" r={pupilR} fill={INK} />
          <circle cx="125" cy="85" r={pupilR} fill={INK} />
          <circle cx="73" cy="80" r="2.5" fill="#fff" />
          <circle cx="121" cy="80" r="2.5" fill="#fff" />
          {lid && (
            <>
              <path d="M60 84 A16 16 0 0 1 92 84 Z" fill="#8A5A3B" stroke={INK} strokeWidth="3" />
              <path d="M108 84 A16 16 0 0 1 140 84 Z" fill="#8A5A3B" stroke={INK} strokeWidth="3" />
            </>
          )}
        </g>
        {/* brows */}
        <path d={`M56 ${58 + brow} Q74 ${50 + brow} 90 ${60 + brow}`} fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" />
        <path d={`M110 ${60 + brow} Q126 ${50 + brow} 144 ${58 + brow}`} fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" />
        {/* spectacles */}
        <circle cx="76" cy="84" r="21" fill="none" stroke="#C9A24A" strokeWidth="4" />
        <circle cx="124" cy="84" r="21" fill="none" stroke="#C9A24A" strokeWidth="4" />
        <path d="M97 82 Q100 78 103 82" fill="none" stroke="#C9A24A" strokeWidth="4" />
        {/* beak */}
        {mood === 'talk' || mood === 'cheer' || mood === 'shock' ? (
          <>
            <path d="M90 104 L110 104 L100 116 Z" fill="#F08A24" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
            <path d="M93 118 L107 118 L100 126 Z" fill="#C96A14" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
          </>
        ) : (
          <path d="M90 104 L110 104 L100 122 Z" fill="#F08A24" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
        )}
        {/* feet */}
        <path d="M78 184 l-6 6 M84 184 l0 8 M90 184 l6 6" stroke="#F08A24" strokeWidth="4" strokeLinecap="round" />
        <path d="M110 184 l-6 6 M116 184 l0 8 M122 184 l6 6" stroke="#F08A24" strokeWidth="4" strokeLinecap="round" />
      </g>
    </svg>
  )
}

export function HostArt({ theme, mood, size = 160 }: { theme: ThemeId; mood: HostMood; size?: number }) {
  return theme === 'bluff' ? <Polly mood={mood} size={size} /> : <Webster mood={mood} size={size} />
}
