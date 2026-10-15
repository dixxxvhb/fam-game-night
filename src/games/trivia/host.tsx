/**
 * The cast of Trivia Night LIVE, drawn as flat sticker art (one ink outline, one shade, one
 * highlight), the same craft as Party Park's critters.
 *
 *   <Chip mood pose />     Chip Doubloon, the host: pompadour, enormous teeth, a loud gold
 *                          sport coat, a mic with a long curly cord.
 *   <Contestant color />   a contestant behind a podium, drawn in the player's color.
 */

export const INK = '#1A0A24'
const SW = 3.5
const o = { stroke: INK, strokeWidth: SW, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }

export type ChipMood = 'grin' | 'wow' | 'wince' | 'wink'
export type ChipPose = 'mic' | 'point' | 'cheer'

const SKIN = '#F4BE8E'
const SKIN_SHADE = '#DE9A68'
const HAIR = '#3A2215'
const HAIR_HI = '#7A4E33'
const COAT = '#EDB52F'
const COAT_SHADE = '#C98E14'
const LAPEL = '#B5740C'
const TIE = '#E5197E'

/** A thick outlined stroke (arms, the cord): ink underneath, color on top. */
function Tube({ d, w, color }: { d: string; w: number; color: string }) {
  return (
    <>
      <path d={d} fill="none" stroke={INK} strokeWidth={w + SW * 2} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
    </>
  )
}

function Hand({ x, y, r = 11 }: { x: number; y: number; r?: number }) {
  return <circle cx={x} cy={y} r={r} fill={SKIN} {...o} />
}

/** The free arm (viewer's left): at his side, pointing at the contestants, or up in the air. */
function FreeArm({ pose }: { pose: ChipPose }) {
  if (pose === 'point') {
    return (
      <g>
        <Tube d="M52 196 C30 196 6 186 -10 176" w={24} color={COAT} />
        <path d="M-6 164 L-6 188" stroke={INK} strokeWidth="5" />
        <path d="M-12 176 L-26 172" fill="none" stroke={INK} strokeWidth="13" strokeLinecap="round" />
        <path d="M-12 176 L-26 172" fill="none" stroke={SKIN} strokeWidth="6" strokeLinecap="round" />
        <circle cx="-12" cy="178" r="11" fill={SKIN} {...o} />
        <path d="M-17 186 Q-10 190 -4 186" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
      </g>
    )
  }
  if (pose === 'cheer') {
    return (
      <g>
        <Tube d="M54 196 C36 180 26 150 24 118" w={24} color={COAT} />
        <path d="M14 122 L36 120" stroke={INK} strokeWidth="5" />
        <ellipse cx="24" cy="98" rx="13" ry="15" fill={SKIN} {...o} />
        <path d="M14 90 V80 M20 86 V74 M27 86 V73 M33 90 V80" stroke={INK} strokeWidth="9" strokeLinecap="round" />
        <path d="M14 90 V80 M20 86 V74 M27 86 V73 M33 90 V80" stroke={SKIN} strokeWidth="3.5" strokeLinecap="round" />
      </g>
    )
  }
  return (
    <g>
      <Tube d="M54 198 C38 226 34 262 40 296" w={24} color={COAT} />
      <path d="M28 290 L52 294" stroke={INK} strokeWidth="5" />
      <Hand x={42} y={306} r={12} />
    </g>
  )
}

function Face({ mood }: { mood: ChipMood }) {
  const browY = mood === 'wow' ? 64 : mood === 'wince' ? 74 : 70
  return (
    <g>
      {/* brows */}
      {mood === 'wince' ? (
        <g stroke={HAIR} strokeWidth="6" strokeLinecap="round">
          <path d="M80 72 L100 78" />
          <path d="M140 72 L120 78" />
        </g>
      ) : (
        <g stroke={HAIR} strokeWidth="6" strokeLinecap="round" fill="none">
          <path d={`M80 ${browY + 4} Q90 ${browY - 4} 101 ${browY + 2}`} />
          <path d={`M119 ${browY + 2} Q130 ${browY - 4} 140 ${browY + 4}`} />
        </g>
      )}
      {/* eyes */}
      {mood === 'wince' ? (
        <g fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M84 84 L96 89 L84 94" />
          <path d="M136 84 L124 89 L136 94" />
        </g>
      ) : mood === 'wow' ? (
        <g>
          <ellipse cx="91" cy="88" rx="8" ry="10" fill="#fff" {...o} strokeWidth={3} />
          <ellipse cx="129" cy="88" rx="8" ry="10" fill="#fff" {...o} strokeWidth={3} />
          <circle cx="92" cy="89" r="4" fill={INK} />
          <circle cx="128" cy="89" r="4" fill={INK} />
        </g>
      ) : (
        <g>
          {mood === 'wink'
            ? <path d="M83 90 Q91 82 99 90" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" />
            : (
              <g>
                <ellipse cx="91" cy="88" rx="5.5" ry="7" fill={INK} />
                <circle cx="93" cy="85.5" r="1.8" fill="#fff" />
              </g>
            )}
          <g>
            <ellipse cx="129" cy="88" rx="5.5" ry="7" fill={INK} />
            <circle cx="131" cy="85.5" r="1.8" fill="#fff" />
          </g>
        </g>
      )}
      {/* nose */}
      <path d="M108 94 Q104 106 112 108" fill="none" stroke={SKIN_SHADE} strokeWidth="4" strokeLinecap="round" />
      {/* cheeks */}
      <g fill="#FF7F8E" opacity="0.45">
        <ellipse cx="78" cy="108" rx="8" ry="5" />
        <ellipse cx="142" cy="108" rx="8" ry="5" />
      </g>
      {/* mouth */}
      {mood === 'wow' ? (
        <g>
          <ellipse cx="110" cy="128" rx="14" ry="16" fill="#5A1030" {...o} />
          <rect x="100" y="114" width="20" height="7" rx="2" fill="#fff" />
          <ellipse cx="110" cy="137" rx="7" ry="4" fill="#FF7E95" />
        </g>
      ) : mood === 'wince' ? (
        <g>
          <rect x="80" y="114" width="60" height="22" rx="8" fill="#fff" {...o} />
          <path d="M80 125 H140" stroke={INK} strokeWidth="2.5" />
          <path d="M92 114 V136 M104 114 V136 M116 114 V136 M128 114 V136" stroke={INK} strokeWidth="2" />
          <path d="M150 66 Q158 78 150 84 Q142 78 150 66 Z" fill="#8FE3FF" stroke={INK} strokeWidth="2.5" />
        </g>
      ) : (
        <g>
          <path d="M74 112 Q110 108 146 112 Q140 148 110 150 Q80 148 74 112 Z" fill="#5A1030" {...o} />
          <path d="M80 114 Q110 110 140 114 L138 128 Q110 132 82 128 Z" fill="#fff" />
          <path d="M90 113 V129 M100 112 V130 M110 112 V131 M120 112 V130 M130 113 V129" stroke="#D9CFC2" strokeWidth="2" />
          <path d="M92 142 Q110 147 128 142 L126 138 Q110 141 94 138 Z" fill="#fff" />
          <ellipse cx="110" cy="141" rx="9" ry="3" fill="#FF7E95" opacity="0.6" />
          <path d="M74 112 Q110 108 146 112 Q140 148 110 150 Q80 148 74 112 Z" fill="none" {...o} />
          <path d="M131 112 L133 117 L138 119 L133 121 L131 126 L129 121 L124 119 L129 117 Z" fill="#FFF7C2" stroke={INK} strokeWidth="1.2" />
        </g>
      )}
    </g>
  )
}

/** Chip Doubloon. Box -30..230 x 0..320; the waist runs off the bottom (stand him behind something). */
export function Chip({ mood = 'grin', pose = 'mic', size = 300, bob = true, className }: { mood?: ChipMood; pose?: ChipPose; size?: number; bob?: boolean; className?: string }) {
  return (
    <div className={className} style={{ width: size * (260 / 320), height: size }}>
    <svg viewBox="-30 0 260 320" width={size * (260 / 320)} height={size} className={bob ? 'tn-chip-bob block' : 'block'} aria-label="Chip Doubloon, the host" role="img" overflow="visible">
      <g>
        {/* the mic cord, curling off to the floor */}
        <path d="M190 206 C200 230 176 236 190 254 C204 272 176 278 192 296 C204 310 214 316 226 330" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />
        <path d="M190 206 C200 230 176 236 190 254 C204 272 176 278 192 296 C204 310 214 316 226 330" fill="none" stroke="#3B3550" strokeWidth="2" strokeLinecap="round" />

        {/* coat */}
        <path d="M30 330 C26 260 34 208 60 190 C80 178 96 176 110 176 C124 176 140 178 160 190 C186 208 194 260 190 330 Z" fill={COAT} {...o} />
        <g stroke={COAT_SHADE} strokeWidth="3" opacity="0.55">
          <path d="M44 214 H176 M38 250 H184 M36 286 H186" />
          <path d="M70 186 V330 M150 186 V330" />
        </g>
        <g stroke="#FFF1B0" strokeWidth="1.5" opacity="0.6">
          <path d="M40 232 H180 M36 268 H186" />
          <path d="M90 180 V330 M130 180 V330" />
        </g>
        {/* shirt and tie */}
        <path d="M88 178 L110 236 L132 178 Z" fill="#FFFFFF" {...o} />
        <path d="M104 186 L116 186 L120 230 L110 246 L100 230 Z" fill={TIE} {...o} strokeWidth={3} />
        <path d="M102 180 L118 180 L114 190 L106 190 Z" fill={TIE} {...o} strokeWidth={3} />
        <g fill="#FFD84A"><circle cx="108" cy="204" r="2.2" /><circle cx="113" cy="218" r="2.2" /><circle cx="107" cy="230" r="2.2" /></g>
        {/* lapels */}
        <path d="M86 176 L76 196 L90 206 L80 216 L110 286 L92 196 Z" fill={LAPEL} {...o} />
        <path d="M134 176 L144 196 L130 206 L140 216 L110 286 L128 196 Z" fill={LAPEL} {...o} />
        {/* pocket square, buttons */}
        <path d="M148 226 L170 226 L168 236 L150 236 Z" fill={COAT_SHADE} {...o} strokeWidth={2.5} />
        <path d="M151 226 L155 216 L159 224 L163 214 L167 226 Z" fill={TIE} {...o} strokeWidth={2.5} />
        <circle cx="110" cy="298" r="4" fill={INK} />
        <circle cx="110" cy="318" r="4" fill={INK} />

        {/* the free arm */}
        <FreeArm pose={pose} />

        {/* head */}
        <rect x="98" y="140" width="24" height="30" fill={SKIN_SHADE} {...o} />
        <ellipse cx="64" cy="98" rx="10" ry="14" fill={SKIN} {...o} />
        <ellipse cx="156" cy="98" rx="10" ry="14" fill={SKIN} {...o} />
        <path d="M66 70 C66 46 86 36 110 36 C134 36 154 46 154 70 L154 110 C154 140 134 158 110 158 C86 158 66 140 66 110 Z" fill={SKIN} {...o} />
        <path d="M104 152 Q110 156 116 152" fill="none" stroke={SKIN_SHADE} strokeWidth="3" strokeLinecap="round" />
        {/* the pompadour */}
        <path d="M60 86 C52 58 60 30 86 18 C104 8 136 6 156 18 C176 30 178 56 166 70 C172 52 160 40 146 44 C150 56 140 62 128 56 C118 64 96 60 88 54 C78 62 70 72 68 90 Z" fill={HAIR} {...o} />
        <path d="M84 30 C98 20 124 16 146 24" fill="none" stroke={HAIR_HI} strokeWidth="5" strokeLinecap="round" />
        <path d="M94 42 C108 34 124 34 136 38" fill="none" stroke={HAIR_HI} strokeWidth="3" strokeLinecap="round" />
        <Face mood={mood} />

        {/* the mic arm (viewer's right) */}
        <Tube d="M166 198 C192 216 200 244 184 250 C172 236 170 210 168 186" w={22} color={COAT} />
        {/* mic */}
        <path d="M168 186 L188 206" stroke={INK} strokeWidth="13" strokeLinecap="round" />
        <path d="M168 186 L188 206" stroke="#2C2838" strokeWidth="7" strokeLinecap="round" />
        <Hand x={174} y={190} r={11} />
        <circle cx="160" cy="166" r="14" fill="#C9CCD8" {...o} />
        <path d="M150 160 L170 172 M152 170 L166 158 M147 166 H173 M160 152 V180" stroke="#8A8EA3" strokeWidth="1.6" />
        <circle cx="155" cy="160" r="4" fill="#fff" opacity="0.8" />
      </g>
    </svg>
    </div>
  )
}

// ---------------- contestants ----------------

export type ContestantMood = 'idle' | 'think' | 'locked' | 'happy' | 'sad'

function mix(hex: string, to: string, t: number) {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const a = p(/^#[0-9a-f]{6}$/i.test(hex) ? hex : '#8790B6')
  const b = p(to)
  return `#${a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('')}`
}

export const lighten = (hex: string, t: number) => mix(hex, '#ffffff', t)
export const darken = (hex: string, t: number) => mix(hex, '#000000', t)

/** A contestant's head and shoulders in their color (a mascot, not a likeness). Box 0..100 x 0..86. */
export function Contestant({ color, mood = 'idle', size = 70 }: { color: string; mood?: ContestantMood; size?: number }) {
  const head = lighten(color, 0.55)
  const body = color
  const shade = darken(color, 0.25)
  return (
    <svg viewBox="0 0 100 86" width={size * (100 / 86)} height={size} aria-hidden overflow="visible">
      <path d="M8 90 C8 66 24 56 50 56 C76 56 92 66 92 90 Z" fill={body} {...o} />
      <path d="M22 80 C30 70 70 70 78 80" fill="none" stroke={shade} strokeWidth="3" strokeLinecap="round" />
      <path d="M40 57 L50 70 L60 57 Z" fill="#fff" {...o} strokeWidth={2.5} />
      <path d="M41 66 L50 70 L41 74 Z M59 66 L50 70 L59 74 Z" fill="#FFC93C" {...o} strokeWidth={2} />
      <circle cx="50" cy="32" r="25" fill={head} {...o} />
      <path d="M32 18 Q44 6 62 10" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity="0.6" />
      {mood === 'locked' || mood === 'happy' ? (
        <g fill="none" stroke={INK} strokeWidth="3.2" strokeLinecap="round">
          <path d="M36 32 Q41 25 46 32" />
          <path d="M54 32 Q59 25 64 32" />
        </g>
      ) : mood === 'think' ? (
        <g fill={INK}>
          <circle cx="44" cy="27" r="3.4" />
          <circle cx="62" cy="27" r="3.4" />
        </g>
      ) : mood === 'sad' ? (
        <g>
          <g fill={INK}><circle cx="41" cy="31" r="3.2" /><circle cx="59" cy="31" r="3.2" /></g>
          <g stroke={INK} strokeWidth="3" strokeLinecap="round"><path d="M35 23 L45 20" /><path d="M65 23 L55 20" /></g>
        </g>
      ) : (
        <g fill={INK}><circle cx="41" cy="30" r="3.4" /><circle cx="59" cy="30" r="3.4" /></g>
      )}
      {mood === 'happy' ? (
        <path d="M38 40 Q50 56 62 40 Z" fill="#5A1030" {...o} strokeWidth={2.8} />
      ) : mood === 'sad' ? (
        <path d="M40 46 Q50 38 60 46" fill="none" stroke={INK} strokeWidth="3.2" strokeLinecap="round" />
      ) : mood === 'think' ? (
        <path d="M44 44 Q50 42 58 45" fill="none" stroke={INK} strokeWidth="3.2" strokeLinecap="round" />
      ) : (
        <path d="M41 42 Q50 49 59 42" fill="none" stroke={INK} strokeWidth="3.2" strokeLinecap="round" />
      )}
      <g fill="#FF7F8E" opacity="0.5"><ellipse cx="33" cy="39" rx="4.5" ry="2.8" /><ellipse cx="67" cy="39" rx="4.5" ry="2.8" /></g>
    </svg>
  )
}
