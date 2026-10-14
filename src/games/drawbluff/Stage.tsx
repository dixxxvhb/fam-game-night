import { useEffect, useRef } from 'react'
import { Heart } from 'lucide-react'
import type { StageProps } from '../../engine/types'
import { useTicker } from '../../engine/context'
import { sfx } from '../../ui/sfx'
import { Avatar, cx, Label } from '../../ui/kit'
import type { ReactNode } from 'react'
import { Countdown } from '../../ui/Countdown'
import { SketchCanvas } from '../sketch/Canvas'
import { entryNow, guessersOf, shownScores, type BOption, type DrawBluffState } from './logic'
import { verdictFor, type Who } from './verdict'

/** Labels on the TV: the kit's Label is phone-sized. */
function TvLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('font-mono text-base uppercase tracking-[0.14em] text-ink-3', className)}>{children}</div>
}

function Dots({ done, total, label }: { done: number; total: number; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <TvLabel>{label}</TvLabel>
      <span className="flex gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={cx('h-4 w-4 rounded-full', i < done ? 'bg-good' : 'bg-line')} />
        ))}
      </span>
    </div>
  )
}

function useRevealSounds(s: DrawBluffState) {
  const e = entryNow(s)
  const key = s.phase === 'reveal' ? `${s.cur}.${s.shown}` : `${s.phase}.${s.cur}`
  const prev = useRef(key)
  useEffect(() => {
    if (prev.current === key) return
    prev.current = key
    if (s.phase !== 'reveal' || !e) return
    sfx.play(e.reveal[s.shown] === 'real' ? 'reveal' : 'pop')
  }, [key, s, e])
}

export function DrawBluffStage({ state: s, room, now, compact, me }: StageProps<DrawBluffState>) {
  useTicker(250)
  useRevealSounds(s)
  const who: Who = (id) => room.players.find((p) => p.id === id)

  if (s.phase === 'draw') return <DrawPhase s={s} who={who} now={now} compact={compact} />
  const e = entryNow(s)
  if (s.phase === 'done' || !e) {
    return (
      <div className={cx('grid h-full place-items-center text-center', compact ? 'py-2' : 'p-6')}>
        <div className={cx('font-display text-ink-2', compact ? 'text-lg' : 'text-4xl')}>Adding it up</div>
      </div>
    )
  }

  const guessers = guessersOf(s, e)
  const beatId = s.phase === 'reveal' ? e.reveal[s.shown] : null
  const shownIdx = (id: string) => e.reveal.indexOf(id)
  const truthOut = beatId === 'real'
  const isOut = (o: BOption) => truthOut || (shownIdx(o.id) >= 0 && shownIdx(o.id) <= s.shown)
  const head =
    s.phase === 'title' ? { title: 'What is this?', sub: 'Write a fake title on your phone. Make it sound real.' }
    : s.phase === 'pick' ? { title: 'Which one is real?', sub: 'Pick on your phone. One of these is the truth.' }
    : { title: truthOut ? 'The truth' : 'The lies', sub: '' }

  const drawing = (
    <div className="relative" style={compact ? { width: '100%', maxWidth: 'min(100%, 34vh)' } : { width: 'min(560px, calc(100vh - 140px))' }}>
      <SketchCanvas strokes={e.strokes} listen={false} />
      {s.phase === 'reveal' && e.likes.length > 0 && (
        <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-paper/90 px-3 py-1 font-bold text-hot animate-pop">
          <Heart size={compact ? 14 : 20} fill="currentColor" />{e.likes.length}
        </span>
      )}
    </div>
  )

  if (compact) {
    const o = beatId ? e.options.find((x) => x.id === beatId) : null
    const v = o ? verdictFor(e, o, who, me) : null
    return (
      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-3">
          <div className="truncate font-bold">{head.title}</div>
          <Label className="shrink-0">Drawing {s.cur + 1} of {s.queue.length}</Label>
        </div>
        <div className="flex justify-center">{drawing}</div>
        {o && v && (
          <div key={beatId} className={cx('grid gap-0.5 rounded-xl border-2 p-3 text-center animate-pop', v.tone === 'good' ? 'border-good/60' : v.tone === 'bad' ? 'border-bad/60' : 'border-hot/60')}>
            <div className="text-lg font-bold leading-snug">{o.text}</div>
            <div className={cx('text-sm font-bold', v.tone === 'good' ? 'text-good' : v.tone === 'bad' ? 'text-bad' : 'text-hot-ink')}>{v.title}</div>
            <div className="text-sm text-ink-2">{v.detail}</div>
          </div>
        )}
      </div>
    )
  }

  const scores = shownScores(s)
  const ranked = s.order.map((id) => ({ id, score: scores[id] ?? 0 })).sort((a, b) => b.score - a.score)
  const optionText = e.options.length > 6 ? 'text-xl' : 'text-2xl'

  return (
    <div className="grid h-full min-h-0 grid-cols-[auto_minmax(0,1fr)] gap-8 p-6">
      <div className="flex min-h-0 items-center">{drawing}</div>
      <div className="flex min-h-0 flex-col gap-4">
        <div className="grid gap-1">
          <TvLabel>Drawing {s.cur + 1} of {s.queue.length}</TvLabel>
          <div className="font-display text-5xl leading-none">{head.title}</div>
          {head.sub && <div className="text-xl text-ink-2">{head.sub}</div>}
        </div>
        {s.phase !== 'reveal' && <Countdown endsAt={s.endsAt} total={s.stageTotal} now={now} className="w-full" />}
        {s.phase === 'title' && (
          <>
            <Dots label="Lies in" done={guessers.filter((g) => e.fakes[g]).length} total={guessers.length} />
            <div className="mt-auto text-xl text-ink-3">One of you drew this. Whoever it is, look innocent.</div>
          </>
        )}
        {(s.phase === 'pick' || s.phase === 'reveal') && (
          <div className="grid min-h-0 content-start gap-2 overflow-hidden">
            {e.options.map((o) => {
              const out = s.phase === 'reveal' && isOut(o)
              const current = o.id === beatId
              const v = out ? verdictFor(e, o, who) : null
              return (
                <div
                  key={o.id}
                  className={cx(
                    'grid gap-1 rounded-xl border-2 px-4 py-2.5',
                    current ? (o.kind === 'real' ? 'border-good bg-good/10' : o.kind === 'house' ? 'border-bad bg-bad/10' : 'border-hot bg-hot/10') : 'border-line bg-tile',
                    s.phase === 'reveal' && !out && 'opacity-50',
                  )}
                >
                  <div className={cx('font-bold leading-snug', optionText)}>{o.text}</div>
                  {v && (
                    <div className={cx('flex flex-wrap items-baseline gap-x-3 text-lg', current && 'animate-rise')}>
                      <span className={cx('font-bold', v.tone === 'good' ? 'text-good' : v.tone === 'bad' ? 'text-bad' : 'text-hot-ink')}>{v.title}</span>
                      <span className="text-ink-2">{v.detail}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
        {s.phase === 'pick' && <Dots label="Picks in" done={guessers.filter((g) => e.picks[g]).length} total={guessers.length} />}
        <div className="mt-auto flex flex-wrap gap-2">
          {ranked.map((r) => {
            const p = who(r.id)
            return (
              <span key={r.id} className="inline-flex items-center gap-2 rounded-full bg-tile py-1 pl-1 pr-3">
                <Avatar name={p?.name ?? r.id} color={p?.color ?? '#888'} size={32} />
                <span className="text-lg font-bold">{p?.name ?? r.id}</span>
                <span className="font-mono text-lg tabular text-ink-2">{r.score.toLocaleString('en-US')}</span>
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function DrawPhase({ s, who, now, compact }: { s: DrawBluffState; who: Who; now: () => number; compact: boolean }) {
  const done = s.entries.filter((e) => e.done).length
  if (compact) {
    return (
      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-3">
          <div className="truncate font-bold">Everyone is drawing</div>
          <Label className="shrink-0">{done} of {s.entries.length} done</Label>
        </div>
      </div>
    )
  }
  const cols = Math.min(4, s.entries.length)
  return (
    <div className="flex h-full min-h-0 flex-col gap-6 p-8">
      <div className="grid gap-2">
        <TvLabel>Draw Bluff</TvLabel>
        <div className="font-display text-5xl leading-none">Everyone is drawing a secret</div>
        <div className="text-xl text-ink-2">Nobody knows anyone else's prompt. Draw it clearly: you get paid when they find the truth.</div>
      </div>
      <Countdown endsAt={s.endsAt} total={s.stageTotal} now={now} className="w-full" />
      <div className="grid flex-1 content-center gap-4" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {s.entries.map((e) => {
          const p = who(e.artist)
          return (
            <div key={e.artist} className={cx('flex items-center gap-4 rounded-2xl border-2 bg-tile p-5', e.done ? 'border-good/60' : 'border-line')}>
              <Avatar name={p?.name ?? e.artist} color={p?.color ?? '#888'} size={64} dim={!p?.connected} />
              <div className="grid min-w-0">
                <span className="truncate text-3xl font-bold">{p?.name ?? e.artist}</span>
                <span className={cx('text-xl', e.done ? 'font-bold text-good' : 'text-ink-2')}>{e.done ? 'Done' : 'Still drawing'}</span>
              </div>
            </div>
          )
        })}
      </div>
      <div className="text-center text-xl text-ink-3">Then every drawing gets fake titles. Yours too.</div>
    </div>
  )
}
