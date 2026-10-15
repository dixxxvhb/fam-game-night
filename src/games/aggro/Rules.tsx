import { cx } from '../../ui/kit'
import type { Speed } from './logic'
import { BRASS, CARD } from './look/palette'

const RULES = [
  'A 1 or a 6 brings a marble out. A 6 rolls again.',
  'Move one marble the whole roll, clockwise. Never onto your own.',
  'Land on anyone else and they go back to base. Aggro.',
  'End a move on a star, then hop star to star next turn.',
  'Center: in from a star on a 1, out on a 1 to any star.',
  'Exact count into home. All four home wins.',
]
/** Quick swaps the first rule. */
const QUICK_FIRST = 'One marble starts out. A 1 or 6 brings more, a 6 can launch one 6 spaces. A 6 rolls again.'

/** The house rules card (cream card stock, brass numbers): phone Rules sheet and first turns. */
export function HowItWorks({ speed, big = false, className }: { speed: Speed; big?: boolean; className?: string }) {
  const lines = speed === 'quick' ? [QUICK_FIRST, ...RULES.slice(1)] : RULES
  return (
    <div
      className={cx('grid content-start rounded-2xl', big ? 'gap-2.5 p-4' : 'gap-3 p-4', className)}
      style={{ background: `linear-gradient(${CARD.paper}, ${CARD.paper2})`, color: CARD.ink, boxShadow: '0 6px 0 rgba(0,0,0,0.35)' }}
    >
      <div className="flex items-baseline justify-between">
        <span className="font-party text-2xl leading-none">House rules</span>
        {speed === 'quick' && <span className="font-mono text-xs font-bold uppercase tracking-wider" style={{ color: CARD.ink2 }}>Quick</span>}
      </div>
      <ol className={cx('grid', big ? 'gap-1.5 text-lg leading-snug' : 'gap-2.5 text-base leading-snug')}>
        {lines.map((t, i) => (
          <li key={i} className="flex items-start gap-3">
            <span
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full font-display text-sm"
              style={{ background: `linear-gradient(135deg, ${BRASS.light}, ${BRASS.mid} 55%, ${BRASS.dark})`, color: CARD.ink, boxShadow: `inset 0 0 0 1.5px ${BRASS.dark}` }}
            >
              {i + 1}
            </span>
            <span className="font-bold" style={{ color: i === 2 ? '#B0201A' : CARD.ink2 }}>{t}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
