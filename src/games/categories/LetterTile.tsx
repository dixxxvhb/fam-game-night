import { cx } from '../../ui/kit'

export function LetterTile({ letter, size }: { letter: string; size: 'sm' | 'md' | 'lg' | 'xl' }) {
  return (
    <div
      aria-label={`Letter ${letter}`}
      className={cx(
        'grid shrink-0 place-items-center rounded-2xl border-2 border-hot/60 bg-tile font-display leading-none text-hot',
        size === 'sm' && 'h-10 w-10 text-2xl',
        size === 'md' && 'h-20 w-20 text-5xl rounded-xl',
        size === 'lg' && 'h-24 w-24 text-7xl',
        size === 'xl' && 'h-64 w-64 text-[11rem] rounded-3xl riso',
      )}
    >
      {letter}
    </div>
  )
}
