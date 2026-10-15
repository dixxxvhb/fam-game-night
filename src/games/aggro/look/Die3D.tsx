import { memo } from 'react'
import { ROLL_SHOW_MS } from '../logic'
import { rgba } from './palette'

/** Pip spots per face (percent of the face). */
const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[27, 27], [73, 73]],
  3: [[27, 27], [50, 50], [73, 73]],
  4: [[27, 27], [73, 27], [27, 73], [73, 73]],
  5: [[27, 27], [73, 27], [50, 50], [27, 73], [73, 73]],
  6: [[27, 24], [73, 24], [27, 50], [73, 50], [27, 76], [73, 76]],
}

/** Which face sits where on the cube (opposites add to 7). */
const FACES: { v: number; t: string }[] = [
  { v: 1, t: '' },
  { v: 6, t: 'rotateY(180deg)' },
  { v: 3, t: 'rotateY(90deg)' },
  { v: 4, t: 'rotateY(-90deg)' },
  { v: 2, t: 'rotateX(90deg)' },
  { v: 5, t: 'rotateX(-90deg)' },
]

/** Cube rotation that brings face v to the front. */
const SHOW: Record<number, [number, number]> = { 1: [0, 0], 6: [0, 180], 3: [0, -90], 4: [0, 90], 2: [-90, 0], 5: [90, 0] }

const Face = memo(function Face({ v, size, transform, pip }: { v: number; size: number; transform: string; pip: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: size * 0.16,
        background: 'radial-gradient(circle at 35% 30%, #FFFDF6 0%, #F5EBD6 55%, #DCCBA8 100%)',
        boxShadow: `inset 0 0 0 ${Math.max(1, size * 0.025)}px rgba(120,84,40,0.35), inset ${-size * 0.04}px ${-size * 0.05}px ${size * 0.1}px rgba(110,70,30,0.3)`,
        transform: `${transform} translateZ(${size / 2}px)`,
        backfaceVisibility: 'hidden',
      }}
    >
      {PIPS[v].map(([x, y], i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            left: `${x}%`,
            top: `${y}%`,
            width: size * 0.19,
            height: size * 0.19,
            marginLeft: -size * 0.095,
            marginTop: -size * 0.095,
            borderRadius: '50%',
            background: `radial-gradient(circle at 40% 35%, ${pip} 0 45%, #120804 100%)`,
            boxShadow: `inset 0 ${size * 0.02}px ${size * 0.03}px rgba(0,0,0,0.6)`,
          }}
        />
      ))}
    </div>
  )
})

const easeOut = (f: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, f)), 3)

/**
 * A real six-sided die (CSS cube). It tumbles in from `from` (px offset) for ROLL_SHOW_MS after
 * `rollAt`, bouncing and settling on `value`. `spinning` = a phone's tap is in flight: it spins
 * in place until the roll comes back. The tint colors the glow under it (the roller's color).
 */
export function Die3D({
  value,
  size,
  t,
  rollAt,
  tint,
  from = [0, 0],
  spinning = false,
  dim = false,
}: {
  value: number
  size: number
  /** Host-clock now. */
  t: number
  rollAt: number
  tint: string
  from?: [number, number]
  spinning?: boolean
  dim?: boolean
}) {
  const v = value >= 1 && value <= 6 ? value : 5
  const [sx, sy] = SHOW[v]
  const age = t - rollAt
  const tumbling = !spinning && rollAt > 0 && age >= 0 && age < ROLL_SHOW_MS
  let rx = sx
  let ry = sy
  let rz = 0
  let tx = 0
  let ty = 0
  let squash = 1
  let shadowK = 1
  if (spinning) {
    const a = t / 1000
    rx = a * 520
    ry = a * 410
    rz = a * 130
    ty = -size * 0.35 - Math.abs(Math.sin(a * 9)) * size * 0.25
    shadowK = 0.7
  } else if (tumbling) {
    const f = age / ROLL_SHOW_MS
    const e = easeOut(f)
    // Spin in whole turns so it lands exactly on the face.
    rx = sx + (1 - e) * 1080
    ry = sy + (1 - e) * 720
    rz = (1 - e) * 360
    tx = from[0] * (1 - easeOut(f * 1.15))
    // Three bounces, each lower.
    const b = f < 0.45 ? Math.abs(Math.sin((f / 0.45) * Math.PI)) * 1.0 : f < 0.75 ? Math.abs(Math.sin(((f - 0.45) / 0.3) * Math.PI)) * 0.4 : Math.abs(Math.sin(((f - 0.75) / 0.25) * Math.PI)) * 0.12
    ty = from[1] * (1 - easeOut(f * 1.4)) - b * size * 0.9
    shadowK = 1 - b * 0.45
    if (f > 0.9) squash = 0.94 + 0.06 * ((f - 0.9) / 0.1)
  }
  return (
    <div style={{ position: 'relative', width: size, height: size, opacity: dim ? 0.55 : 1 }}>
      {/* Glow and shadow on the table, in the roller's color. */}
      <div
        style={{
          position: 'absolute',
          left: -size * 0.35,
          top: size * 0.62,
          width: size * 1.7,
          height: size * 0.75,
          borderRadius: '50%',
          background: `radial-gradient(ellipse at center, ${rgba(tint, 0.75)} 0 25%, ${rgba(tint, 0)} 70%)`,
          transform: `translate(${tx}px, 0) scale(${shadowK})`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: size * 0.05,
          top: size * 0.78,
          width: size * 0.9,
          height: size * 0.3,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse at center, rgba(10,4,0,0.65) 0 40%, rgba(10,4,0,0) 72%)',
          transform: `translate(${tx}px, 0) scale(${shadowK})`,
        }}
      />
      <div style={{ position: 'absolute', inset: 0, perspective: size * 6, transform: `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scale(${(1 / Math.sqrt(squash)).toFixed(3)}, ${squash.toFixed(3)})`, transformOrigin: '50% 100%' }}>
        <div style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transform: `translateZ(${-size / 2}px) rotateX(-22deg) rotateY(-28deg) rotateZ(${rz.toFixed(1)}deg) rotateX(${rx.toFixed(1)}deg) rotateY(${ry.toFixed(1)}deg)` }}>
          {/* A solid core so the rounded corners never show daylight. */}
          {['', 'rotateX(90deg)', 'rotateY(90deg)'].map((tf, i) => (
            <div key={`c${i}`} style={{ position: 'absolute', inset: size * 0.02, background: '#E2D2B0', transform: tf }} />
          ))}
          {FACES.map((f) => <Face key={f.v} v={f.v} size={size} transform={f.t} pip="#3A1E0C" />)}
        </div>
      </div>
    </div>
  )
}
