import { useEffect, useRef, type ReactNode } from 'react'
import { Eye, PenLine, Star } from 'lucide-react'
import type { RoomPlayer, StageProps } from '../../engine/types'
import { useTicker } from '../../engine/context'
import { sfx } from '../../ui/sfx'
import { cx } from '../../ui/kit'
import { StrokeThumb } from '../sketch/Canvas'
import { PlaybackCanvas } from '../_draw/Playback'
import { clock, Confetti, Dots, Face, Frame, NOTE_COLORS, Page, Pencil, ST, Stamp, Sticky, Taped, tilt, Title } from '../_draw/studio'
import { favScores, kindOf, topStep, type TelephoneState, type TStep } from './logic'

type Who = (id: string) => RoomPlayer | undefined

/** How long the "is typing" bubble shows before a step lands in the replay. */
export const TYPING_MS = 1100

const HEADLINES = {
  first: { title: 'Write a first line', sub: 'Something weird. Somebody has to draw it.' },
  draw: { title: 'Draw what you got', sub: 'Badly is fine. Badly is the point.' },
  write: { title: 'Say what you see', sub: 'Describe the drawing you got. Honest, not nice.' },
}

function headlineFor(step: number) {
  return step === 0 ? HEADLINES.first : kindOf(step) === 'draw' ? HEADLINES.draw : HEADLINES.write
}

/** The chain's color: its owner's seat. */
const chainColor = (c: number) => NOTE_COLORS[c % NOTE_COLORS.length]

/** Steps as a row of little cards: pencil for writing, eye-and-pen for drawing; done ones filled in. */
export function StepDots({ steps, at, size = 12, through }: { steps: number; at: number; size?: number; through?: number }) {
  const filled = through ?? at - 1
  return (
    <span className="flex items-center gap-1.5" aria-label={`Step ${Math.min(at + 1, steps)} of ${steps}`}>
      {Array.from({ length: steps }, (_, i) => (
        <span
          key={i}
          className={cx('grid place-items-center rounded-md border-2 border-[#1F1B2E]', i === at && 'st-pop')}
          style={{ width: size * 1.7, height: size * 1.7, background: i <= filled ? ST.ink : i === at ? ST.yellow : '#FFFFFF', color: i <= filled ? '#fff' : ST.ink }}
        >
          {kindOf(i) === 'write' ? <PenLine size={size} /> : <Eye size={size} />}
        </span>
      ))}
    </span>
  )
}

function Favs({ n, big = false }: { n: number; big?: boolean }) {
  if (!n) return null
  return (
    <span className={cx('st-pop st-marker inline-flex items-center gap-1 rounded-full border-2 border-[#1F1B2E] bg-[#FFD23F] px-2 leading-none', big ? 'py-1 text-2xl' : 'py-0.5 text-base')}>
      <Star size={big ? 20 : 13} fill="currentColor" />
      {n}
    </span>
  )
}

function useBeatSounds(s: TelephoneState) {
  const key = s.phase === 'replay' ? `${s.cursor.chain}.${s.cursor.step}` : `${s.phase}.${s.step}`
  const prev = useRef(key)
  useEffect(() => {
    if (prev.current === key) return
    prev.current = key
    if (s.phase === 'play') { sfx.play('whoosh'); return }
    if (s.phase !== 'replay') return
    if (s.cursor.chain >= s.chains.length) sfx.play('win')
    else if (s.cursor.step >= s.steps) sfx.play('reveal')
    else if (s.cursor.step > 0) sfx.play('pop')
  }, [key, s])
}

export function TelephoneStage({ state: s, room, now, compact, me, isHost, hostAction }: StageProps<TelephoneState>) {
  useTicker(200)
  useBeatSounds(s)
  const who: Who = (id) => room.players.find((p) => p.id === id)
  const t = now()

  let body: ReactNode
  if (s.phase === 'play') body = compact ? <PlayCompact s={s} who={who} now={t} /> : <PlayTv s={s} who={who} now={t} />
  else if (s.phase === 'replay') {
    const skip = isHost && !compact ? <button onClick={() => hostAction('next')} className="st-btn bg-white text-xl">Next</button> : null
    if (s.cursor.chain >= s.chains.length) body = <Tally s={s} who={who} compact={compact} skip={skip} />
    else if (s.cursor.step >= s.steps) body = <Recap s={s} who={who} compact={compact} now={t} skip={skip} />
    else body = <Thread s={s} who={who} compact={compact} me={me} now={t} skip={skip} />
  } else {
    body = (
      <div className={cx('grid h-full place-items-center text-center', compact ? 'py-2' : 'p-6')}>
        <Title className={compact ? 'text-xl' : 'text-5xl'}>Counting stars</Title>
      </div>
    )
  }
  return (
    <Page plain={compact} className={cx('overflow-hidden', compact ? '-m-3 p-3' : 'h-full')} style={{ ['--st-margin' as string]: '40px' }}>
      {body}
    </Page>
  )
}

// ---------------- play: the phone line ----------------

/** Seat positions around an oval, seat 0 at the top, clockwise. Percent of the table box. */
function seatAt(i: number, n: number) {
  const a = -Math.PI / 2 + (i / n) * Math.PI * 2
  return { x: 50 + 41 * Math.cos(a), y: 50 + 38 * Math.sin(a), a }
}

function PlayTv({ s, who, now }: { s: TelephoneState; who: Who; now: number }) {
  const h = headlineFor(s.step)
  const n = s.order.length
  const doneCount = s.chains.filter((ch) => ch.steps[s.step]?.done).length
  const { frac, seconds } = clock(s.endsAt, s.stageTotal, now)
  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] gap-6 py-6 pl-16 pr-8">
      <div className="flex min-h-0 flex-col justify-center gap-5">
        <div className="st-hand text-3xl leading-none text-[#575168]">step {s.step + 1} of {s.steps}</div>
        <Title key={s.step} className="text-6xl" color={kindOf(s.step) === 'draw' ? ST.blue : ST.red}>{h.title}</Title>
        <div className="st-hand text-3xl leading-tight text-[#575168]">{h.sub}</div>
        <StepDots steps={s.steps} at={s.step} size={16} />
        <Pencil frac={frac} seconds={seconds} big />
        <div className="flex items-baseline gap-3">
          <span className="st-marker text-6xl leading-none">{doneCount}<span className="text-3xl text-[#8B8698]">/{s.chains.length}</span></span>
          <span className="st-hand text-3xl text-[#575168]">done</span>
        </div>
      </div>

      {/* The table: everyone in a ring, each chain's card sitting with whoever holds it now. */}
      <div className="relative min-h-0">
        <div className="absolute inset-[9%] rounded-[50%] border-[4px] border-dashed border-[#1F1B2E]/25" />
        <div className="absolute inset-0 grid place-items-center">
          <div className="st-hand text-center text-2xl leading-tight text-[#8B8698]">every chain<br />moves one seat<br />a step</div>
        </div>
        {s.order.map((id, i) => {
          const pos = seatAt(i, n)
          const p = who(id)
          return (
            <div key={id} className="absolute grid -translate-x-1/2 -translate-y-1/2 justify-items-center gap-1" style={{ left: `${pos.x}%`, top: `${pos.y}%` }}>
              <Face p={p} size={n > 6 ? 54 : 70} dim={!p?.connected} />
              <span className="st-marker rounded-md bg-[#FFF8EA] px-1.5 text-xl leading-tight">{p?.name ?? id}</span>
            </div>
          )
        })}
        {s.chains.map((ch, c) => {
          const seat = (c + s.step) % n
          const pos = seatAt(seat, n)
          // Sit the card between the seat and the middle of the table.
          const x = 50 + (pos.x - 50) * 0.55
          const y = 50 + (pos.y - 50) * 0.55
          const st = ch.steps[s.step]
          const done = !!st?.done
          return (
            <div
              key={c}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${x}%`, top: `${y}%`, transition: 'left 900ms cubic-bezier(0.3, 0.7, 0.2, 1.1), top 900ms cubic-bezier(0.3, 0.7, 0.2, 1.1)' }}
            >
              <div
                className={cx('grid w-[156px] justify-items-center gap-0.5 rounded-lg border-[3px] border-[#1F1B2E] px-2 py-1.5 text-center', !done && 'st-wiggle')}
                style={{ background: chainColor(c), boxShadow: done ? `4px 4px 0 ${ST.green}` : `4px 4px 0 ${ST.ink}`, ['--st-rot' as string]: `${tilt(c, 4)}deg` }}
              >
                <span className="st-hand max-w-full truncate text-lg leading-none">{who(ch.owner)?.name ?? ch.owner}'s chain</span>
                <span className="flex items-center gap-1">
                  {done ? (
                    <span className="st-marker text-lg text-[#1E7A44]">done</span>
                  ) : (
                    <>
                      {st?.kind === 'draw' ? <Eye size={16} /> : <PenLine size={16} />}
                      <Dots size={6} color={ST.ink} />
                    </>
                  )}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PlayCompact({ s, who, now }: { s: TelephoneState; who: Who; now: number }) {
  const h = headlineFor(s.step)
  const { frac, seconds } = clock(s.endsAt, s.stageTotal, now)
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="st-marker truncate text-lg">{h.title}</span>
        <StepDots steps={s.steps} at={s.step} size={9} />
      </div>
      <Pencil frac={frac} seconds={seconds} />
      <div className="flex flex-wrap gap-1.5">
        {s.chains.map((ch, c) => {
          const st = ch.steps[s.step]
          const p = who(st?.by ?? '')
          return (
            <span key={c} className={cx('inline-flex items-center gap-1.5 rounded-full border-2 border-[#1F1B2E] py-0.5 pl-0.5 pr-2.5 text-sm', st?.done ? 'bg-[#9FE3C1]' : 'bg-white')}>
              <Face p={p} size={20} />
              <span className="st-marker">{st?.done ? 'done' : st?.kind === 'draw' ? 'drawing' : 'writing'}</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}

// ---------------- replay: the chain as a group chat ----------------

function ChainHeader({ s, who, compact, skip, label }: { s: TelephoneState; who: Who; compact: boolean; skip: ReactNode; label?: string }) {
  const ch = s.chains[s.cursor.chain]
  const owner = who(ch.owner)
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <Face p={owner} size={compact ? 28 : 58} />
        <div className="grid min-w-0">
          <span className={cx('st-marker truncate leading-tight', compact ? 'text-lg' : 'text-4xl')}>{owner?.name ?? ch.owner}'s chain</span>
          {!compact && <span className="st-hand text-2xl leading-none text-[#575168]">chain {s.cursor.chain + 1} of {s.chains.length}</span>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-4">
        {compact ? <span className="st-marker text-sm text-[#575168]">{label}</span> : <StepDots steps={s.steps} at={s.cursor.step} through={s.cursor.step} size={15} />}
        {skip}
      </div>
    </div>
  )
}

/** One message in the chat: a line of text or a drawing, from whoever made it. */
function Bubble({ st, who, side, current, size, me, compact }: { st: TStep; who: Who; side: 'left' | 'right'; current: boolean; size: number; me?: string | null; compact: boolean }) {
  const p = who(st.by)
  const name = st.auto ? 'The House' : st.by === me ? 'You' : p?.name ?? st.by
  const right = side === 'right'
  return (
    <div className={cx('flex items-end gap-3', right && 'flex-row-reverse', current && 'st-slide')} style={{ ['--st-from' as string]: right ? '60px' : '-60px' }}>
      <Face p={st.auto ? { id: 'house', name: 'H', color: '#C9C4D4', guest: false, connected: true } : p} size={compact ? 26 : current ? 52 : 38} />
      <div className={cx('grid min-w-0 gap-1', right ? 'justify-items-end' : 'justify-items-start')}>
        <span className={cx('st-hand leading-none text-[#575168]', compact ? 'text-base' : current ? 'text-2xl' : 'text-xl')}>
          {name}{st.kind === 'draw' ? (st.strokes.length ? ' drew' : ' drew nothing') : ''}
        </span>
        {st.kind === 'draw' ? (
          <div className={cx('relative rounded-2xl border-[3px] border-[#1F1B2E] bg-white p-1.5', right ? 'rounded-br-sm' : 'rounded-bl-sm')} style={{ boxShadow: `4px 4px 0 ${ST.ink}` }}>
            <div style={{ width: size }}>
              {current ? <PlaybackCanvas strokes={st.strokes} ms={2600} className="block" /> : <StrokeThumb strokes={st.strokes} size={size} className="block rounded-xl" />}
            </div>
            {!st.strokes.length && (
              <div className="absolute inset-0 grid place-items-center text-center">
                <span className={cx('st-hand text-[#8B8698]', current ? 'text-3xl' : 'text-lg')}>not a single line</span>
              </div>
            )}
            <span className="absolute -bottom-3 -right-3"><Favs n={st.favs.length} big={current && !compact} /></span>
          </div>
        ) : (
          <div
            className={cx('relative max-w-full rounded-2xl border-[3px] border-[#1F1B2E] leading-tight', right ? 'rounded-br-sm' : 'rounded-bl-sm', compact ? 'px-3 py-2 text-xl' : current ? 'px-6 py-4 text-5xl' : 'px-4 py-2.5 text-2xl', st.auto && 'italic')}
            style={{ background: right ? '#A9C8FF' : '#FFFFFF', boxShadow: `4px 4px 0 ${ST.ink}` }}
          >
            <span className="st-hand text-balance">{st.text}</span>
            <span className="absolute -bottom-3 -right-3"><Favs n={st.favs.length} big={current && !compact} /></span>
          </div>
        )}
      </div>
    </div>
  )
}

function Typing({ st, who, side, compact }: { st: TStep; who: Who; side: 'left' | 'right'; compact: boolean }) {
  const p = who(st.by)
  return (
    <div className={cx('st-slide flex items-end gap-3', side === 'right' && 'flex-row-reverse')} style={{ ['--st-from' as string]: side === 'right' ? '40px' : '-40px' }}>
      <Face p={p} size={compact ? 26 : 52} />
      <div className="grid gap-1">
        <span className={cx('st-hand leading-none text-[#575168]', compact ? 'text-base' : 'text-2xl')}>{st.auto ? 'The House' : p?.name} {st.kind === 'draw' ? 'is drawing' : 'is typing'}</span>
        <div className="rounded-2xl border-[3px] border-[#1F1B2E] bg-white px-5 py-4 shadow-[4px_4px_0_#1F1B2E]">
          <Dots size={compact ? 8 : 14} />
        </div>
      </div>
    </div>
  )
}

function Thread({ s, who, compact, me, now, skip }: { s: TelephoneState; who: Who; compact: boolean; me?: string | null; now: number; skip: ReactNode }) {
  const { chain, step } = s.cursor
  const ch = s.chains[chain]
  const st = ch.steps[step]
  const typing = step > 0 && now - s.cursor.at < TYPING_MS
  const side = (i: number): 'left' | 'right' => (i % 2 === 0 ? 'left' : 'right')
  const { frac } = clock(s.endsAt, s.stageTotal, now)

  if (compact) {
    const prev = step > 0 ? ch.steps[step - 1] : null
    return (
      <div className="grid gap-2">
        <ChainHeader s={s} who={who} compact skip={null} label={`${step + 1} of ${s.steps}`} />
        {prev && <div className="opacity-70"><Bubble st={prev} who={who} side={side(step - 1)} current={false} size={70} me={me} compact /></div>}
        {typing ? <Typing st={st} who={who} side={side(step)} compact /> : <Bubble key={`${chain}.${step}`} st={st} who={who} side={side(step)} current size={190} me={me} compact />}
      </div>
    )
  }

  // TV: the two before this one, smaller, then this one big.
  const back = st.kind === 'draw' ? 1 : 2
  const earlier = ch.steps.slice(Math.max(0, step - back), step).map((x, k) => ({ x, i: Math.max(0, step - back) + k }))
  const big = st.kind === 'draw' ? 'min(370px, calc(100vh - 400px))' : undefined
  return (
    <div className="flex h-full min-h-0 flex-col gap-4 py-5 pl-16 pr-8">
      <ChainHeader s={s} who={who} compact={false} skip={skip} />
      <div className="mx-auto flex min-h-0 w-full max-w-[1040px] flex-1 flex-col justify-end gap-5 overflow-hidden rounded-[28px] border-[4px] border-[#1F1B2E] bg-[#FFF8EA]/80 px-8 pb-6 pt-4 shadow-[8px_8px_0_#1F1B2E]">
        {step === 0 && <div className="st-hand text-center text-3xl text-[#8B8698]">it started with</div>}
        {earlier.map(({ x, i }) => (
          <div key={i} className="opacity-60"><Bubble st={x} who={who} side={side(i)} current={false} size={110} compact={false} /></div>
        ))}
        {typing
          ? <Typing st={st} who={who} side={side(step)} compact={false} />
          : st.kind === 'draw'
            ? <BigDrawing key={`${chain}.${step}`} st={st} who={who} side={side(step)} width={big!} />
            : <Bubble key={`${chain}.${step}`} st={st} who={who} side={side(step)} current size={0} compact={false} />}
      </div>
      <div className="mx-auto h-2 w-full max-w-[1040px] overflow-hidden rounded-full border-2 border-[#1F1B2E] bg-white" aria-hidden>
        <div className="h-full bg-[#1F1B2E] transition-[width] duration-200 ease-linear" style={{ width: `${frac * 100}%` }} />
      </div>
    </div>
  )
}

/** The drawing beat on the TV: big, redrawn stroke by stroke. */
function BigDrawing({ st, who, side, width }: { st: TStep; who: Who; side: 'left' | 'right'; width: string }) {
  const p = who(st.by)
  const right = side === 'right'
  return (
    <div className={cx('st-slide flex items-end gap-3', right && 'flex-row-reverse')} style={{ ['--st-from' as string]: right ? '60px' : '-60px' }}>
      <Face p={p} size={52} />
      <div className={cx('grid gap-1', right ? 'justify-items-end' : 'justify-items-start')}>
        <span className="st-hand text-2xl leading-none text-[#575168]">{p?.name ?? st.by} {st.strokes.length ? 'drew' : 'drew nothing'}</span>
        <div className={cx('relative rounded-2xl border-[3px] border-[#1F1B2E] bg-white p-2 shadow-[5px_5px_0_#1F1B2E]', right ? 'rounded-br-sm' : 'rounded-bl-sm')} style={{ width }}>
          <PlaybackCanvas strokes={st.strokes} ms={2800} className="block" />
          {!st.strokes.length && <div className="absolute inset-0 grid place-items-center"><span className="st-hand text-4xl text-[#8B8698]">not a single line</span></div>}
          <span className="absolute -bottom-3 -right-3"><Favs n={st.favs.length} big /></span>
        </div>
      </div>
    </div>
  )
}

// ---------------- recap: where it started, where it ended ----------------

function EndCard({ st, who, size, label, color }: { st: TStep; who: Who; size: number; label: string; color: string }) {
  const p = who(st.by)
  return (
    <div className="grid justify-items-center gap-2">
      <span className="st-hand text-3xl leading-none text-[#575168]">{label}</span>
      {st.kind === 'draw' ? (
        <Taped rot={tilt(label, 3)}><StrokeThumb strokes={st.strokes} size={size} className="block" /></Taped>
      ) : (
        <Sticky color={color} rot={tilt(label, 3)} className="grid place-items-center text-center" style={{ width: size + 20, minHeight: size * 0.62 }}>
          <span className="st-hand text-balance text-5xl leading-tight">{st.text}</span>
        </Sticky>
      )}
      <span className="flex items-center gap-2">
        <Face p={p} size={28} />
        <span className="st-marker text-xl">{st.auto ? 'The House' : p?.name}</span>
      </span>
    </div>
  )
}

function Recap({ s, who, compact, now, skip }: { s: TelephoneState; who: Who; compact: boolean; now: number; skip: ReactNode }) {
  const ch = s.chains[s.cursor.chain]
  const first = ch.steps[0]
  const last = ch.steps[ch.steps.length - 1]
  if (compact) {
    return (
      <div className="grid gap-1">
        <ChainHeader s={s} who={who} compact skip={null} label="the whole chain" />
        <div className="st-hand text-xl leading-tight">From "{first.text}" to {last.kind === 'write' ? `"${last.text}"` : 'that drawing'}.</div>
      </div>
    )
  }
  const age = now - s.cursor.at
  const thumb = s.steps <= 4 ? 120 : s.steps <= 6 ? 104 : 84
  return (
    <div className="flex h-full min-h-0 flex-col gap-3 py-5 pl-16 pr-8">
      <ChainHeader s={s} who={who} compact={false} skip={skip} />
      <div className="relative grid min-h-0 flex-1 grid-cols-[1fr_auto_1fr] items-center gap-6">
        <EndCard st={first} who={who} size={250} label="it started as" color="#FFE36E" />
        <svg viewBox="0 0 120 60" width="140" height="70" aria-hidden className="overflow-visible">
          <path className="st-draw-line" d="M5 35 C 35 5, 70 60, 105 28" fill="none" stroke={ST.ink} strokeWidth="5" strokeLinecap="round" style={{ ['--st-len' as string]: 160 }} />
          <path d="M92 18 L108 27 L94 40" fill="none" stroke={ST.ink} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <EndCard st={last} who={who} size={250} label="and ended as" color="#A9C8FF" />
        {age > 900 && (
          <div className="pointer-events-none absolute left-1/2 top-[8%] -translate-x-1/2">
            <Stamp color={ST.red} rot={-9} className="text-4xl">close enough</Stamp>
          </div>
        )}
      </div>
      <div className="flex items-end justify-center gap-3">
        {ch.steps.map((st, i) => (
          <div key={i} className="st-drop grid justify-items-center gap-1" style={{ animationDelay: `${300 + i * 90}ms`, ['--st-rot' as string]: `${tilt(i, 3)}deg` }}>
            <div className="relative grid place-items-center overflow-hidden rounded-lg border-[3px] border-[#1F1B2E] bg-white shadow-[3px_3px_0_#1F1B2E]" style={{ width: thumb, height: thumb }}>
              {st.kind === 'draw'
                ? <StrokeThumb strokes={st.strokes} size={thumb - 6} className="block" />
                : <span className="st-hand line-clamp-4 px-1.5 text-center text-lg leading-tight">{st.text}</span>}
              <span className="absolute right-0.5 top-0.5"><Favs n={st.favs.length} /></span>
            </div>
            <Face p={who(st.by)} size={22} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------- tally ----------------

function Tally({ s, who, compact, skip }: { s: TelephoneState; who: Who; compact: boolean; skip: ReactNode }) {
  const scores = favScores(s)
  const rows = s.order.map((id) => ({ id, n: scores[id] ?? 0 })).sort((a, b) => b.n - a.n)
  const draw = topStep(s, 'draw')
  const line = topStep(s, 'write')
  const top = rows[0]?.n ?? 0
  const board = (
    <div className="grid gap-2">
      {rows.map((r, i) => {
        const p = who(r.id)
        const win = top > 0 && r.n === top
        return (
          <div key={r.id} className={cx('st-slide flex items-center gap-3 rounded-xl border-[3px] border-[#1F1B2E] bg-white', compact ? 'px-2.5 py-1' : 'px-4 py-2.5')} style={{ animationDelay: `${i * 120}ms`, boxShadow: win ? `5px 5px 0 ${ST.yellow}, 5px 5px 0 3px ${ST.ink}` : `4px 4px 0 ${ST.ink}` }}>
            <Face p={p} size={compact ? 24 : 44} />
            <span className={cx('flex-1 truncate font-bold', !compact && 'text-2xl')}>{p?.name ?? r.id}</span>
            <span className={cx('st-marker inline-flex items-center gap-1.5 tabular', compact ? 'text-lg' : 'text-4xl')}>
              <Star size={compact ? 16 : 28} className="text-[#E2A400]" fill="currentColor" />{r.n}
            </span>
          </div>
        )
      })}
    </div>
  )
  if (compact) {
    return (
      <div className="grid gap-2">
        <span className="st-marker text-lg">Favorites</span>
        {board}
      </div>
    )
  }
  return (
    <div className="relative flex h-full min-h-0 flex-col gap-5 py-6 pl-16 pr-8">
      {top > 0 && <Confetti n={34} spread={520} className="top-[30%]" />}
      <div className="flex items-center justify-between">
        <Title className="text-6xl">The favorites</Title>
        {skip}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)] gap-10">
        <div className="grid content-start gap-3">{board}</div>
        <div className="grid min-h-0 grid-cols-2 content-start gap-8">
          <div className="grid content-start justify-items-center gap-3">
            <span className="st-hand text-3xl leading-none text-[#575168]">most loved drawing</span>
            {draw ? (
              <>
                <Frame glow><StrokeThumb strokes={draw.st.strokes} size={230} className="block" /></Frame>
                <span className="flex items-center gap-2"><Face p={who(draw.st.by)} size={30} /><span className="st-marker text-2xl">{who(draw.st.by)?.name}</span><Favs n={draw.st.favs.length} /></span>
              </>
            ) : <span className="st-hand text-2xl text-[#8B8698]">None yet. Tap a star.</span>}
          </div>
          <div className="grid content-start justify-items-center gap-3">
            <span className="st-hand text-3xl leading-none text-[#575168]">most loved line</span>
            {line ? (
              <>
                <Sticky color="#FFE36E" rot={-3} className="grid min-h-[200px] w-full place-items-center text-center">
                  <span className="st-hand text-balance text-4xl leading-tight">{line.st.text}</span>
                </Sticky>
                <span className="flex items-center gap-2"><Face p={who(line.st.by)} size={30} /><span className="st-marker text-2xl">{who(line.st.by)?.name}</span><Favs n={line.st.favs.length} /></span>
              </>
            ) : <span className="st-hand text-2xl text-[#8B8698]">None yet. Tap a star.</span>}
          </div>
        </div>
      </div>
      <div className="st-hand text-center text-3xl text-[#575168]">Still time to tap a star on your phone.</div>
    </div>
  )
}

