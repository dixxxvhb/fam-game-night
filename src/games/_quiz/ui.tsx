import type { ReactNode } from 'react'
import type { RoomView } from '../../engine/types'
import { whoIn } from './who'
import { Avatar, cx, Label } from '../../ui/kit'
import { Check } from 'lucide-react'
import { LETTERS, type LiveQ } from './bank'
import { catLabel, type CatKey } from './categories'


/** Long questions step down a size so they never clip on the TV. */
function questionSize(text: string, compact: boolean) {
  if (compact) return text.length > 90 ? 'text-lg' : 'text-xl'
  if (text.length > 110) return 'text-3xl'
  if (text.length > 70) return 'text-4xl'
  return 'text-5xl'
}

export function CatTag({ cat, className }: { cat: string | null; className?: string }) {
  if (!cat) return null
  return <span className={cx('inline-flex items-center whitespace-nowrap rounded-full border border-hot/60 px-3 py-0.5 font-mono text-xs uppercase tracking-[0.14em] text-hot-ink', className)}>{cat}</span>
}

/** The TV board: the question and four lettered tiles. On reveal it marks the right one and shows who picked what. */
export function QuestionBoard({
  q,
  room,
  reveal,
  compact = false,
  ghosts = [],
}: {
  q: LiveQ
  room: RoomView
  reveal?: { correct: number; picks: Record<string, number | null> } | null
  compact?: boolean
  ghosts?: string[]
}) {
  const who = whoIn(room)
  return (
    <div className={cx('grid min-h-0 w-full', compact ? 'gap-3' : 'gap-6')}>
      <h2 className={cx('font-bold leading-tight text-ink', questionSize(q.q, compact))}>{q.q}</h2>
      <div className={cx('grid grid-cols-2', compact ? 'gap-2' : 'gap-4')}>
        {q.options.map((opt, i) => {
          const right = reveal && i === reveal.correct
          const wrong = reveal && i !== reveal.correct
          const pickers = reveal ? room.gamePlayers.filter((id) => reveal.picks[id] === i) : []
          return (
            <div
              key={i}
              className={cx(
                'flex min-w-0 items-center rounded-2xl border-2 transition-[opacity,background-color,border-color] duration-300',
                compact ? 'gap-2 px-3 py-2' : 'min-h-24 gap-4 px-5 py-3',
                right ? 'border-good bg-good/15' : wrong ? 'border-line/60 bg-tile/50' : 'border-line bg-tile',
              )}
            >
              <span className={cx('grid shrink-0 place-items-center rounded-xl font-display', compact ? 'h-8 w-8 text-base' : 'h-12 w-12 text-2xl', right ? 'bg-good text-paper' : 'bg-tile-2 text-ink', wrong && 'opacity-40')}>
                {LETTERS[i]}
              </span>
              <span className={cx('min-w-0 flex-1 font-bold leading-tight', compact ? 'text-sm' : opt.length > 28 ? 'text-2xl' : 'text-3xl', wrong && 'opacity-40')}>{opt}</span>
              {pickers.length > 0 && (
                <span className="flex shrink-0 -space-x-2">
                  {pickers.map((id) => <Avatar key={id} name={who(id).name} color={who(id).color} size={compact ? 22 : 36} dim={ghosts.includes(id)} />)}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Who has locked in. Avatars only, never their answers. */
export function LockedRow({
  room,
  done,
  ghosts = [],
  compact = false,
  label = 'Locked in',
}: {
  room: RoomView
  done: (id: string) => boolean
  ghosts?: string[]
  compact?: boolean
  label?: string
}) {
  const who = whoIn(room)
  const n = room.gamePlayers.filter(done).length
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Label>{label} {n} of {room.gamePlayers.length}</Label>
      {room.gamePlayers.map((id) => {
        const p = who(id)
        const ok = done(id)
        return (
          <span key={id} className={cx('relative inline-flex items-center gap-2 rounded-full py-1 pl-1 pr-3 transition-opacity', ok ? 'bg-tile-2' : 'bg-tile opacity-45')}>
            <Avatar name={p.name} color={p.color} size={compact ? 22 : 32} dim={ghosts.includes(id)} />
            <span className={cx('font-bold', compact ? 'text-sm' : 'text-lg')}>{p.name}</span>
            {ok && <Check size={compact ? 14 : 18} className="text-good animate-pop" aria-label="locked in" />}
          </span>
        )
      })}
    </div>
  )
}

/** The phone's four answer buttons. Text included, so nobody has to look up at the TV to answer. */
export function AnswerPad({
  options,
  picked,
  onPick,
  reveal,
}: {
  options: string[]
  picked: number | null
  onPick: (i: number) => void
  reveal?: number | null
}) {
  const locked = picked !== null || reveal != null
  return (
    <div className="grid gap-3">
      {options.map((opt, i) => {
        const mine = picked === i
        const right = reveal != null && reveal === i
        return (
          <button
            key={i}
            type="button"
            data-answer={i}
            disabled={locked}
            onClick={() => onPick(i)}
            className={cx(
              'no-select flex min-h-[76px] w-full items-center gap-4 rounded-2xl border-2 px-4 py-3 text-left transition-[transform,opacity,border-color,background-color] duration-100 active:scale-[0.98]',
              right ? 'border-good bg-good/15' : mine ? 'border-hot bg-hot/15' : 'border-line bg-tile',
              locked && !mine && !right && 'opacity-40',
            )}
          >
            <span className={cx('grid h-11 w-11 shrink-0 place-items-center rounded-xl font-display text-xl', right ? 'bg-good text-paper' : mine ? 'bg-hot text-paper' : 'bg-tile-2 text-ink')}>{LETTERS[i]}</span>
            <span className="min-w-0 flex-1 text-lg font-bold leading-snug">{opt}</span>
          </button>
        )
      })}
    </div>
  )
}

export function QuestionHead({ text, cat, right, compact = false }: { text: string; cat: CatKey | null; right?: string; compact?: boolean }) {
  if (compact) {
    // On a phone the controller below already says which round it is.
    return (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CatTag cat={cat ? catLabel(cat) : null} />
        {right && <Label className="shrink-0">{right}</Label>}
      </div>
    )
  }
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className={cx('truncate font-display', compact ? 'text-base' : 'text-2xl')}>{text}</span>
        <CatTag cat={cat ? catLabel(cat) : null} />
      </div>
      {right && <Label className="shrink-0">{right}</Label>}
    </div>
  )
}

/** Scores in a column for the TV. */
export function ScoreList({
  room,
  scores,
  gained,
  note,
  ghosts = [],
}: {
  room: RoomView
  scores: Record<string, number>
  gained?: Record<string, number> | null
  note?: (id: string) => string | null
  ghosts?: string[]
}) {
  const who = whoIn(room)
  const ranked = [...room.gamePlayers].sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0))
  return (
    <div className="grid gap-2">
      <Label>Scores</Label>
      {ranked.map((id) => {
        const p = who(id)
        const g = gained?.[id]
        const extra = note?.(id)
        return (
          <div key={id} className="flex items-center justify-between gap-3 rounded-xl bg-tile px-3 py-2">
            <span className="flex min-w-0 items-center gap-2">
              <Avatar name={p.name} color={p.color} size={30} dim={ghosts.includes(id)} />
              <span className="grid min-w-0">
                <span className="truncate text-lg font-bold">{p.name}</span>
                {extra && <span className="truncate text-xs text-ink-3">{extra}</span>}
              </span>
            </span>
            <span className="flex items-baseline gap-2">
              {g !== undefined && g !== 0 && (
                <span className={cx('font-mono text-base font-bold tabular animate-pop', g > 0 ? 'text-good' : 'text-bad')}>{g > 0 ? `+${g}` : g}</span>
              )}
              <span className="font-mono text-2xl tabular">{scores[id] ?? 0}</span>
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function Waiting({ children }: { children: ReactNode }) {
  return <div className="grid gap-2 p-6 text-center text-lg text-ink-2">{children}</div>
}
