import { cx, Label } from '../../ui/kit'
import type { Speed } from './logic'

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

/** The "How it works" card: TV during the first round, phone behind the Rules button. */
export function HowItWorks({ speed, big = false, className }: { speed: Speed; big?: boolean; className?: string }) {
  const lines = speed === 'quick' ? [QUICK_FIRST, ...RULES.slice(1)] : RULES
  return (
    <div className={cx('grid content-start rounded-2xl border border-line bg-tile', big ? 'gap-2.5 p-4' : 'gap-3 p-4', className)}>
      <Label>How it works{speed === 'quick' ? ' · Quick' : ''}</Label>
      <ol className={cx('grid', big ? 'gap-1.5 text-lg leading-snug' : 'gap-2.5 text-base leading-snug')}>
        {lines.map((t, i) => (
          <li key={i} className="flex gap-3">
            <span className={cx('shrink-0 font-display text-hot', big ? 'w-5 text-lg' : 'w-4')}>{i + 1}</span>
            <span className="text-ink-2">{t}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
