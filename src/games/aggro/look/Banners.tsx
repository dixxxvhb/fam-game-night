import { HIT_MS } from '../logic'
import { AGGRO_RED, CARD, mix } from './palette'

const easeOut = (f: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, f)), 3)
const backOut = (f: number) => {
  const c = 2.2
  const x = Math.min(1, Math.max(0, f)) - 1
  return 1 + (c + 1) * x * x * x + c * x * x
}

export const TURN_BANNER_MS = 1_350

/** "TOASTER'S ROLL" sweeping across the top: in from the left, a beat, out to the right. */
export function TurnBanner({ text, color, age, big = true }: { text: string; color: string; age: number; big?: boolean }) {
  if (age < 0 || age >= TURN_BANNER_MS) return null
  const IN = 240
  const OUT = 260
  let x = 0
  if (age < IN) x = -120 * (1 - easeOut(age / IN))
  else if (age > TURN_BANNER_MS - OUT) x = 130 * easeOut((age - (TURN_BANNER_MS - OUT)) / OUT)
  return (
    <div className="pointer-events-none absolute inset-x-0 flex justify-center" style={{ top: big ? 18 : 6, zIndex: 30 }}>
      <div
        style={{
          transform: `translateX(${x}vw) skewX(-12deg)`,
          background: color,
          padding: big ? '10px 46px' : '4px 18px',
          boxShadow: `0 ${big ? 8 : 4}px 0 ${mix(color, '#000', 0.55)}, 0 0 0 ${big ? 4 : 2}px ${CARD.ink}`,
          borderRadius: 6,
        }}
      >
        <div
          className="font-display whitespace-nowrap"
          style={{ transform: 'skewX(12deg)', fontSize: big ? 46 : 20, lineHeight: 1.05, color: CARD.ink, textShadow: `0 2px 0 ${mix(color, '#fff', 0.5)}` }}
        >
          {text}
        </div>
      </div>
    </div>
  )
}

/**
 * The signature moment: a huge slanted AGGRO! in the attacker's color, slammed in over the
 * board with a red flash, then thrown off. `age` is ms since the hit landed.
 */
export function AggroBanner({ age, color, by, victim, big = true }: { age: number; color: string; by: string; victim: string; big?: boolean }) {
  if (age < 0 || age >= HIT_MS + 200) return null
  const SLAM = 190
  const exitAt = HIT_MS - 220
  let scale = 1
  let x = 0
  let o = 1
  if (age < SLAM) scale = 2.6 - 1.6 * backOut(age / SLAM)
  if (age > exitAt) {
    const f = easeOut((age - exitAt) / 420)
    x = f * 140
    o = 1 - f
  }
  const flash = age < 220 ? 1 - age / 220 : 0
  const fs = big ? 168 : 64
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center overflow-hidden" style={{ zIndex: 40 }}>
      {flash > 0 && <div className="absolute inset-0" style={{ background: AGGRO_RED, opacity: 0.45 * flash }} />}
      <div style={{ transform: `translateX(${x}vw) rotate(-7deg) scale(${scale.toFixed(3)})`, opacity: o, textAlign: 'center' }}>
        <div
          className="font-display"
          style={{
            fontSize: fs,
            lineHeight: 0.9,
            color,
            transform: 'skewX(-14deg)',
            WebkitTextStroke: `${big ? 7 : 3}px ${CARD.ink}`,
            paintOrder: 'stroke fill',
            textShadow: [1, 2, 3, 4, 5, 6, 7, 8].map((i) => `${i * (big ? 2 : 1)}px ${i * (big ? 2 : 1)}px 0 ${CARD.ink}`).join(', '),
            letterSpacing: big ? 4 : 1,
          }}
        >
          AGGRO!
        </div>
        <div
          className="mx-auto mt-3 inline-block font-display"
          style={{
            background: CARD.ink,
            color: CARD.paper,
            fontSize: big ? 28 : 13,
            padding: big ? '8px 22px' : '3px 10px',
            transform: 'skewX(-14deg)',
            boxShadow: `${big ? 6 : 3}px ${big ? 6 : 3}px 0 ${AGGRO_RED}`,
          }}
        >
          <span style={{ color }}>{by}</span> sends <span style={{ color: '#FFD7CF' }}>{victim}</span> back to base
        </div>
      </div>
    </div>
  )
}
