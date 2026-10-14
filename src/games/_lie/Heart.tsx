import { cx } from '../../ui/kit'

const PATH = 'M12 20.6C12 20.6 3 14.6 3 8.8C3 5.9 5.3 3.8 7.9 3.8C9.7 3.8 11.1 4.8 12 6.2C12.9 4.8 14.3 3.8 16.1 3.8C18.7 3.8 21 5.9 21 8.8C21 14.6 12 20.6 12 20.6Z'

/** A heart drawn in SVG (no emoji). Filled, or an outline for "not liked yet". */
export function Heart({ size = 20, color = 'currentColor', filled = true, className }: { size?: number; color?: string; filled?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden className={cx('shrink-0', className)}>
      <path d={PATH} fill={filled ? color : 'none'} stroke={color} strokeWidth={filled ? 0 : 2} strokeLinejoin="round" />
    </svg>
  )
}

/** One small heart per like, in the liker's color. */
export function HeartRow({ likers, colorOf, size = 18, className }: { likers: string[]; colorOf: (id: string) => string; size?: number; className?: string }) {
  if (!likers.length) return null
  return (
    <span className={cx('inline-flex flex-wrap items-center gap-1', className)} aria-label={`${likers.length} ${likers.length === 1 ? 'like' : 'likes'}`}>
      {likers.map((id) => (
        <span key={id} className="animate-pop">
          <Heart size={size} color={colorOf(id)} />
        </span>
      ))}
    </span>
  )
}
