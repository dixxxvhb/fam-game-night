import { cx } from '../../ui/kit'
import type { AggroState } from './logic'
import { useFrames } from './view'

const ROLL_ANIM_MS = 520

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 26], [72, 26], [28, 50], [72, 50], [28, 74], [72, 74]],
}

/** A die face. value 0 draws a blank die. tilt in degrees for the tumble. */
export function Die({ value, size = 96, dim = false, tilt = 0, className }: { value: number; size?: number; dim?: boolean; tilt?: number; className?: string }) {
  const pips = PIPS[value] ?? []
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-label={value ? `Die showing ${value}` : 'Die'}
      className={cx('shrink-0', dim && 'opacity-40', className)}
      style={{ transform: tilt ? `rotate(${tilt}deg)` : undefined }}
    >
      <rect x="4" y="4" width="92" height="92" rx="18" fill="var(--color-ink)" />
      <rect x="4" y="4" width="92" height="92" rx="18" fill="none" stroke="var(--color-paper)" strokeOpacity="0.25" strokeWidth="3" />
      {pips.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="9.5" fill="var(--color-paper)" />)}
    </svg>
  )
}

/** The current roll, tumbling for half a second after it lands. Dimmed while the next roll is pending. */
export function LiveDie({ s, now, size }: { s: AggroState; now: () => number; size: number }) {
  useFrames(s.rollAt ? s.rollAt + ROLL_ANIM_MS : 0, now)
  const age = now() - s.rollAt
  const tumbling = s.rollAt > 0 && age >= 0 && age < ROLL_ANIM_MS && s.phase !== 'roll'
  const face = tumbling ? 1 + ((Math.floor(age / 75) * 5 + s.roll) % 6) : s.roll
  return <Die value={face} size={size} dim={s.phase === 'roll'} tilt={tumbling ? Math.sin(age / 40) * 14 : 0} />
}
