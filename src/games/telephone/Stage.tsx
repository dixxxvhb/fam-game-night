import { useEffect, useRef, type ReactNode } from 'react'
import { ArrowRight, Star } from 'lucide-react'
import type { RoomPlayer, StageProps } from '../../engine/types'
import { useTicker } from '../../engine/context'
import { sfx } from '../../ui/sfx'
import { Avatar, Btn, cx, Label } from '../../ui/kit'
import { Countdown } from '../../ui/Countdown'
import { SketchCanvas } from '../sketch/Canvas'
import { PlaybackCanvas } from '../_draw/Playback'
import { favScores, kindOf, topStep, type TelephoneState, type TStep } from './logic'

type Who = (id: string) => RoomPlayer | undefined

const HEADLINES = {
  first: { title: 'Write a first line', sub: 'Something weird. Somebody has to draw it.' },
  draw: { title: 'Draw what you got', sub: 'Badly is fine. Badly is the point.' },
  write: { title: 'Say what you see', sub: 'Describe the drawing you got. Honest, not nice.' },
}

function headlineFor(step: number) {
  return step === 0 ? HEADLINES.first : kindOf(step) === 'draw' ? HEADLINES.draw : HEADLINES.write
}

export function StepDots({ steps, at, size = 12, through }: { steps: number; at: number; size?: number; through?: number }) {
  const filled = through ?? at - 1
  return (
    <span className="flex items-center gap-1.5" aria-label={`Step ${Math.min(at + 1, steps)} of ${steps}`}>
      {Array.from({ length: steps }, (_, i) => (
        <span
          key={i}
          className={cx('rounded-full', i <= filled ? 'bg-ink-2' : i === at ? 'border-2 border-hot' : 'bg-line')}
          style={{ width: size, height: size }}
        />
      ))}
    </span>
  )
}

/** Labels on the TV: the kit's Label is phone-sized. */
function TvLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('font-mono text-base uppercase tracking-[0.14em] text-ink-3', className)}>{children}</div>
}

/** A quiet bar for replay beats (the Countdown turns red under five seconds, which reads as panic here). */
function BeatBar({ s, now }: { s: TelephoneState; now: () => number }) {
  const frac = s.stageTotal ? Math.min(1, Math.max(0, (s.endsAt - now()) / s.stageTotal)) : 0
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line" aria-hidden>
      <div className="h-full rounded-full bg-ink-3 transition-[width] duration-300 ease-linear" style={{ width: `${frac * 100}%` }} />
    </div>
  )
}

function byLine(st: TStep, who: Who, me?: string | null): string {
  const name = st.by === me ? 'You' : who(st.by)?.name ?? 'Someone'
  if (st.auto) return `${name} blanked. The House wrote this.`
  if (st.kind === 'draw') return st.strokes.length ? `${name} drew this` : `${name} drew nothing at all`
  return `${name} wrote this`
}

function Favs({ n, big = false }: { n: number; big?: boolean }) {
  if (!n) return null
  return (
    <span className={cx('inline-flex items-center gap-1.5 font-bold text-hot', big ? 'text-2xl' : 'text-sm')}>
      <Star size={big ? 24 : 14} fill="currentColor" />
      {n}
    </span>
  )
}

/** A step as a small card: thumbnail or text. */
function StepCard({ st, who, n, compactText = false }: { st: TStep; who: Who; n: number; compactText?: boolean }) {
  const p = who(st.by)
  return (
    <div className="flex min-h-0 flex-col gap-2 rounded-2xl bg-tile p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-base text-ink-3">{n}</span>
        <Favs n={st.favs.length} />
      </div>
      {st.kind === 'draw' ? (
        <div className="mx-auto w-full" style={{ maxWidth: compactText ? 120 : 'min(100%, 17vh)' }}>
          <SketchCanvas strokes={st.strokes} listen={false} />
        </div>
      ) : (
        <div className={cx('grid flex-1 place-items-center px-1 text-center font-bold leading-snug', compactText ? 'text-base' : 'text-2xl', st.auto && 'text-ink-2')}>
          {st.text}
        </div>
      )}
      <div className="flex min-w-0 items-center justify-center gap-2">
        <Avatar name={p?.name ?? st.by} color={p?.color ?? '#888'} size={24} />
        <span className="truncate text-base font-bold text-ink-2">{st.auto ? 'The House' : p?.name ?? st.by}</span>
      </div>
    </div>
  )
}

function useBeatSounds(s: TelephoneState) {
  const key = s.phase === 'replay' ? `${s.cursor.chain}.${s.cursor.step}` : s.phase
  const prev = useRef(key)
  useEffect(() => {
    if (prev.current === key) return
    prev.current = key
    if (s.phase !== 'replay') return
    if (s.cursor.chain >= s.chains.length) sfx.play('good')
    else if (s.cursor.step >= s.steps) sfx.play('reveal')
    else if (s.cursor.step > 0) sfx.play('pop')
  }, [key, s])
}

export function TelephoneStage({ state: s, room, now, compact, me, isHost, hostAction }: StageProps<TelephoneState>) {
  useTicker(250)
  useBeatSounds(s)
  const who: Who = (id) => room.players.find((p) => p.id === id)

  if (s.phase === 'play') return compact ? <PlayCompact s={s} who={who} /> : <PlayTv s={s} who={who} now={now} />
  if (s.phase === 'replay') {
    const skip = isHost && !compact ? <Btn size="sm" variant="ghost" onClick={() => hostAction('next')}>Next</Btn> : null
    if (s.cursor.chain >= s.chains.length) return <Tally s={s} who={who} compact={compact} skip={skip} />
    if (s.cursor.step >= s.steps) return <Recap s={s} who={who} compact={compact} now={now} skip={skip} />
    return <Beat s={s} who={who} compact={compact} me={me} now={now} skip={skip} />
  }
  return (
    <div className={cx('grid h-full place-items-center text-center', compact ? 'py-2' : 'p-6')}>
      <div className={cx('font-display text-ink-2', compact ? 'text-lg' : 'text-4xl')}>Adding up the favorites</div>
    </div>
  )
}

// ---------------- play ----------------

function PlayTv({ s, who, now }: { s: TelephoneState; who: Who; now: () => number }) {
  const h = headlineFor(s.step)
  const doneCount = s.chains.filter((ch) => ch.steps[s.step]?.done).length
  const cols = s.chains.length <= 4 ? s.chains.length : 4
  return (
    <div className="flex h-full min-h-0 flex-col gap-5 p-8">
      <div className="flex items-end justify-between gap-6">
        <div className="grid gap-2">
          <TvLabel>Step {s.step + 1} of {s.steps}</TvLabel>
          <div className="font-display text-5xl leading-none">{h.title}</div>
          <div className="text-xl text-ink-2">{h.sub}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-display text-5xl tabular leading-none">{doneCount}<span className="text-ink-3">/{s.chains.length}</span></div>
          <TvLabel className="mt-1">done</TvLabel>
        </div>
      </div>
      <Countdown endsAt={s.endsAt} total={s.stageTotal} now={now} className="w-full" />
      <div className="grid min-h-0 flex-1 content-center gap-4" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {s.chains.map((ch, c) => {
          const st = ch.steps[s.step]
          const holder = who(st?.by ?? '')
          const owner = who(ch.owner)
          return (
            <div key={c} className={cx('grid gap-5 rounded-2xl border-2 bg-tile p-6', st?.done ? 'border-good/60' : 'border-line')}>
              <div className="flex items-center justify-between gap-3">
                <TvLabel className="truncate">{owner?.name ?? ch.owner}'s chain</TvLabel>
                <StepDots steps={s.steps} at={s.step} through={st?.done ? s.step : s.step - 1} size={12} />
              </div>
              <div className="flex min-w-0 items-center gap-4">
                <Avatar name={holder?.name ?? '?'} color={holder?.color ?? '#888'} size={64} dim={!holder?.connected} />
                <div className="grid min-w-0">
                  <span className="truncate text-3xl font-bold">{holder?.name ?? st?.by}</span>
                  <span className={cx('text-xl', st?.done ? 'font-bold text-good' : 'text-ink-2')}>
                    {st?.done ? 'Done' : st?.kind === 'draw' ? 'Still drawing' : 'Still writing'}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <div className="text-center text-xl text-ink-3">Every chain moves one seat a step. Nobody sees a whole chain until the end.</div>
    </div>
  )
}

function PlayCompact({ s, who }: { s: TelephoneState; who: Who }) {
  const h = headlineFor(s.step)
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <div className="truncate font-bold">{h.title}</div>
        <Label className="shrink-0">Step {s.step + 1} of {s.steps}</Label>
      </div>
      <div className="flex flex-wrap gap-2">
        {s.chains.map((ch, c) => {
          const st = ch.steps[s.step]
          const p = who(st?.by ?? '')
          return (
            <span key={c} className={cx('inline-flex items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-2.5 text-sm', st?.done ? 'bg-good/15 text-good' : 'bg-tile text-ink-2')}>
              <Avatar name={p?.name ?? '?'} color={p?.color ?? '#888'} size={20} />
              <span className="font-bold">{st?.done ? 'done' : st?.kind === 'draw' ? 'drawing' : 'writing'}</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}

// ---------------- replay ----------------

function ChainHeader({ s, who, compact, label, skip }: { s: TelephoneState; who: Who; compact: boolean; label: string; skip: ReactNode }) {
  const ch = s.chains[s.cursor.chain]
  const owner = who(ch.owner)
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={owner?.name ?? ch.owner} color={owner?.color ?? '#888'} size={compact ? 24 : 48} />
        <div className="grid min-w-0">
          <span className={cx('truncate font-bold', compact ? 'text-base' : 'text-3xl')}>{owner?.name ?? ch.owner}'s chain</span>
          {!compact && <TvLabel>Chain {s.cursor.chain + 1} of {s.chains.length}</TvLabel>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-4">
        {compact ? <Label>{label}</Label> : <StepDots steps={s.steps} at={s.cursor.step} through={s.cursor.step} size={14} />}
        {skip}
      </div>
    </div>
  )
}

function Beat({ s, who, compact, me, now, skip }: { s: TelephoneState; who: Who; compact: boolean; me?: string | null; now: () => number; skip: ReactNode }) {
  const { chain, step } = s.cursor
  const ch = s.chains[chain]
  const st = ch.steps[step]
  const prev = step > 0 ? ch.steps[step - 1] : null
  const key = `${chain}.${step}`

  const current = st.kind === 'draw' ? (
    <div className="relative mx-auto w-full" style={{ maxWidth: compact ? 'min(100%, 36vh)' : 'min(100%, calc(100vh - 300px))' }}>
      <PlaybackCanvas key={key} strokes={st.strokes} />
      {!st.strokes.length && (
        <div className="absolute inset-0 grid place-items-center rounded-2xl text-center">
          <span className={cx('font-display text-ink-3', compact ? 'text-lg' : 'text-3xl')}>Nothing. Not a line.</span>
        </div>
      )}
    </div>
  ) : (
    <div className={cx('animate-pop text-balance text-center font-bold leading-tight', compact ? 'text-2xl' : 'text-6xl', st.auto && 'text-ink-2')}>
      {st.text}
    </div>
  )

  const caption = (
    <div className="flex items-center justify-center gap-3">
      <Avatar name={who(st.by)?.name ?? st.by} color={who(st.by)?.color ?? '#888'} size={compact ? 22 : 36} />
      <span className={cx('font-bold text-ink-2', compact ? 'text-sm' : 'text-2xl')}>{byLine(st, who, compact ? me : null)}</span>
      <Favs n={st.favs.length} big={!compact} />
    </div>
  )

  if (compact) {
    return (
      <div className="grid gap-2">
        <ChainHeader s={s} who={who} compact label={`${step + 1} of ${s.steps}`} skip={null} />
        {prev && (
          <div className="flex items-center gap-2 text-sm text-ink-3">
            <span className="shrink-0">From</span>
            {prev.kind === 'draw'
              ? <span className="w-14 shrink-0"><SketchCanvas strokes={prev.strokes} listen={false} rounded /></span>
              : <span className="truncate font-bold text-ink-2">{prev.text}</span>}
          </div>
        )}
        {current}
        {caption}
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 p-6">
      <ChainHeader s={s} who={who} compact={false} label="" skip={skip} />
      {prev ? (
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,0.8fr)_auto_minmax(0,1.6fr)] items-center gap-6">
          <div className="grid gap-3 opacity-80">
            <TvLabel>{prev.kind === 'draw' ? 'They saw' : 'They read'}</TvLabel>
            {prev.kind === 'draw' ? (
              <div className="w-full max-w-[280px]"><SketchCanvas strokes={prev.strokes} listen={false} /></div>
            ) : (
              <div className={cx('text-3xl font-bold leading-snug', prev.auto && 'text-ink-2')}>{prev.text}</div>
            )}
            <span className="text-xl text-ink-3">{prev.auto ? 'The House' : who(prev.by)?.name}</span>
          </div>
          <ArrowRight size={48} className="text-ink-3" />
          <div className="grid min-h-0 gap-4">
            {current}
            {caption}
          </div>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 content-center gap-6">
          <TvLabel className="text-center">It started with</TvLabel>
          {current}
          {caption}
        </div>
      )}
      <BeatBar s={s} now={now} />
    </div>
  )
}

function Recap({ s, who, compact, now, skip }: { s: TelephoneState; who: Who; compact: boolean; now: () => number; skip: ReactNode }) {
  const ch = s.chains[s.cursor.chain]
  if (compact) {
    return (
      <div className="grid gap-1">
        <ChainHeader s={s} who={who} compact label="The whole chain" skip={null} />
        <div className="text-sm text-ink-3">From "{ch.steps[0].text}" to whatever that last one is.</div>
      </div>
    )
  }
  const cols = s.steps <= 4 ? s.steps : s.steps === 6 ? 3 : 4
  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-6">
      <ChainHeader s={s} who={who} compact={false} label="" skip={skip} />
      <div className="font-display text-3xl">The whole chain</div>
      <div className="grid min-h-0 flex-1 gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridAutoRows: 'minmax(0, 1fr)' }}>
        {ch.steps.map((st, i) => <StepCard key={i} st={st} who={who} n={i + 1} />)}
      </div>
      <BeatBar s={s} now={now} />
    </div>
  )
}

function Tally({ s, who, compact, skip }: { s: TelephoneState; who: Who; compact: boolean; skip: ReactNode }) {
  const scores = favScores(s)
  const rows = s.order.map((id) => ({ id, n: scores[id] ?? 0 })).sort((a, b) => b.n - a.n)
  const draw = topStep(s, 'draw')
  const line = topStep(s, 'write')
  const board = (
    <div className="grid gap-2">
      {rows.map((r) => {
        const p = who(r.id)
        return (
          <div key={r.id} className={cx('flex items-center gap-3 rounded-xl bg-tile', compact ? 'px-3 py-1.5' : 'px-4 py-3')}>
            <Avatar name={p?.name ?? r.id} color={p?.color ?? '#888'} size={compact ? 24 : 40} />
            <span className={cx('flex-1 truncate font-bold', !compact && 'text-2xl')}>{p?.name ?? r.id}</span>
            <span className={cx('inline-flex items-center gap-1.5 font-mono tabular', compact ? 'text-lg' : 'text-3xl')}>
              <Star size={compact ? 16 : 26} className="text-hot" fill="currentColor" />{r.n}
            </span>
          </div>
        )
      })}
    </div>
  )
  if (compact) {
    return (
      <div className="grid gap-2">
        <div className="font-bold">Favorites</div>
        {board}
      </div>
    )
  }
  return (
    <div className="flex h-full min-h-0 flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <div className="font-display text-5xl">Favorites</div>
        {skip}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-10">
        <div className="grid content-start gap-3">
          <TvLabel>Favorites received</TvLabel>
          {board}
        </div>
        <div className="grid min-h-0 grid-cols-2 content-start gap-6">
          <div className="grid content-start gap-3">
            <TvLabel>Most loved drawing</TvLabel>
            {draw ? (
              <>
                <div className="w-full max-w-[300px]"><SketchCanvas strokes={draw.st.strokes} listen={false} /></div>
                <div className="text-lg font-bold" style={{ color: who(draw.st.by)?.color }}>{who(draw.st.by)?.name}</div>
              </>
            ) : <div className="text-xl text-ink-3">None yet. Tap a star.</div>}
          </div>
          <div className="grid content-start gap-3">
            <TvLabel>Most loved line</TvLabel>
            {line ? (
              <>
                <div className="text-3xl font-bold leading-snug">{line.st.text}</div>
                <div className="text-lg font-bold" style={{ color: who(line.st.by)?.color }}>{who(line.st.by)?.name}</div>
              </>
            ) : <div className="text-xl text-ink-3">None yet. Tap a star.</div>}
          </div>
        </div>
      </div>
      <div className="text-center text-xl text-ink-3">Still time to tap a star on your phone.</div>
    </div>
  )
}
