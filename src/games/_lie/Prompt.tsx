import { cx } from '../../ui/kit'
import type { LieItem } from './logic'

export type PromptSize = 'hero' | 'md' | 'sm'

const BLANK = '____'

function sentenceSize(len: number, size: PromptSize) {
  if (size === 'hero') return len <= 70 ? 'text-6xl' : len <= 110 ? 'text-5xl' : 'text-[2.6rem]'
  if (size === 'md') return len <= 90 ? 'text-[2rem]' : 'text-[1.7rem]'
  return len <= 90 ? 'text-lg' : 'text-base'
}

function wordSize(len: number, size: PromptSize) {
  if (size === 'hero') return len <= 9 ? 'text-8xl' : len <= 13 ? 'text-7xl' : len <= 17 ? 'text-6xl' : 'text-5xl'
  if (size === 'md') return len <= 12 ? 'text-5xl' : len <= 17 ? 'text-4xl' : 'text-3xl'
  return len <= 9 ? 'text-3xl' : len <= 14 ? 'text-2xl' : 'text-xl'
}

/**
 * The question. Bluff: the sentence with a blank (filled in during the reveal).
 * Fake Word: the word, big, with its part of speech.
 */
export function Prompt({
  item,
  kind,
  size,
  fill,
  truth = false,
  className,
}: {
  item: LieItem
  kind: 'blank' | 'word'
  size: PromptSize
  /** Text to show in the blank (reveal). */
  fill?: string
  /** The fill is the truth: draw it in the accent. */
  truth?: boolean
  className?: string
}) {
  if (kind === 'word') {
    return (
      <div className={cx('grid min-w-0 gap-1', className)}>
        <div className={cx('font-display leading-[1.05] [overflow-wrap:anywhere]', wordSize(item.prompt.length, size))}>{item.prompt}</div>
        {item.pos && <div className={cx('italic opacity-75', size === 'sm' ? 'text-sm' : size === 'md' ? 'text-xl' : 'text-2xl')}>{item.pos}</div>}
      </div>
    )
  }

  const at = item.prompt.indexOf(BLANK)
  const before = at >= 0 ? item.prompt.slice(0, at) : item.prompt
  const after = at >= 0 ? item.prompt.slice(at + BLANK.length) : ''
  // Keep the blank on the same line as the word before it and the punctuation after it,
  // unless the fill is long enough that it has to wrap.
  const glue = !fill || fill.length <= 18
  const lead = glue ? before.match(/(\S+\s*)$/)?.[1] ?? '' : ''
  const tail = glue ? after.match(/^[.,;:!?'")]*/)?.[0] ?? '' : ''
  return (
    <p className={cx('min-w-0 font-bold leading-snug [overflow-wrap:anywhere] [text-wrap:pretty]', sentenceSize(item.prompt.length, size), className)}>
      {before.slice(0, before.length - lead.length)}
      <span className={glue ? 'whitespace-nowrap' : undefined}>
        {lead}
        {fill ? (
          <span key={fill} className={cx('animate-pop rounded-md px-1', truth ? 'bg-[var(--l-accent,var(--color-hot))] text-[var(--l-on-accent,var(--color-paper))]' : 'bg-[var(--l-fill,var(--color-tile-2))] underline decoration-[var(--l-hot,var(--color-hot))] decoration-[0.08em] underline-offset-[0.18em]')}>{fill}</span>
        ) : (
          <span aria-label="blank" className="inline-block w-[3.2em] translate-y-[0.1em] border-b-[0.14em] border-[var(--l-accent,var(--color-hot))]" />
        )}
        {tail}
      </span>
      {after.slice(tail.length)}
    </p>
  )
}
