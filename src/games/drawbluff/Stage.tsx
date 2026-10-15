import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { Heart } from 'lucide-react'
import type { StageProps } from '../../engine/types'
import { useTicker } from '../../engine/context'
import { sfx } from '../../ui/sfx'
import { cx } from '../../ui/kit'
import { SketchCanvas, StrokeThumb } from '../sketch/Canvas'
import { clock, Confetti, Face, Frame, Pencil, ST, Stamp, tilt } from '../_draw/studio'
import { awards, bestLie, entryNow, guessersOf, shownScores, type BEntry, type BOption, type DrawBluffState } from './logic'
import { pickersOf, verdictFor, type Who } from './verdict'

/** Wall text: cream on the gallery's dark wall. */
const CREAM = ST.cream
const MUTED = '#CDB9A6'

function useRevealSounds(s: DrawBluffState) {
  const e = entryNow(s)
  const key = s.phase === 'reveal' ? `${s.cur}.${s.shown}` : `${s.phase}.${s.cur}`
  const prev = useRef(key)
  useEffect(() => {
    if (prev.current === key) return
    prev.current = key
    if (s.phase === 'finale') { sfx.play('win'); return }
    if (s.phase === 'title' || s.phase === 'pick') { sfx.play('whoosh'); return }
    if (s.phase !== 'reveal' || !e) return
    const id = e.reveal[s.shown]
    sfx.play(id === 'real' ? 'reveal' : id === 'house' ? 'bad' : 'pop')
  }, [key, s, e])
}

/** A museum wall label. */
function Placard({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div className={cx('rounded-[4px] border-2 border-[#1F1B2E] bg-[#FFFBF1] text-[#1F1B2E] shadow-[4px_5px_0_rgba(0,0,0,0.45)]', className)} style={style}>
      {children}
    </div>
  )
}

/** A spotlight cone from the top of the wall. */
function Spot({ x = '50%', w = 520, className }: { x?: string; w?: number; className?: string }) {
  return (
    <div
      aria-hidden
      className={cx('st-spot pointer-events-none absolute top-0 -translate-x-1/2', className)}
      style={{ left: x, width: w, height: '100%', background: 'radial-gradient(ellipse 50% 70% at 50% 0%, rgba(255, 233, 180, 0.30), rgba(255, 233, 180, 0.08) 55%, transparent 75%)' }}
    />
  )
}

function WallTitle({ kicker, title, sub }: { kicker: string; title: string; sub?: string }) {
  return (
    <div className="grid gap-1">
      <span className="st-hand text-3xl leading-none" style={{ color: MUTED }}>{kicker}</span>
      <span className="st-marker text-5xl leading-tight" style={{ color: CREAM }}>{title}</span>
      {sub && <span className="st-hand text-2xl leading-tight" style={{ color: MUTED }}>{sub}</span>}
    </div>
  )
}

export function DrawBluffStage({ state: s, room, now, compact, me, isHost, hostAction }: StageProps<DrawBluffState>) {
  useTicker(200)
  useRevealSounds(s)
  const who: Who = (id) => room.players.find((p) => p.id === id)
  const t = now()

  let body: ReactNode
  if (s.phase === 'draw') body = <DrawPhase s={s} who={who} now={t} compact={compact} />
  else if (s.phase === 'finale' || s.phase === 'done') body = <Finale s={s} who={who} compact={compact} skip={isHost && !compact ? () => hostAction('next') : null} />
  else {
    const e = entryNow(s)
    body = e ? (compact ? <Compact s={s} e={e} who={who} me={me} now={t} /> : <Exhibit s={s} e={e} who={who} now={t} />) : null
  }
  return (
    <div className={cx('st-wall relative overflow-hidden', compact ? '-m-3 p-3' : 'h-full')}>
      {body}
    </div>
  )
}

// ---------------- painting ----------------

function DrawPhase({ s, who, now, compact }: { s: DrawBluffState; who: Who; now: number; compact: boolean }) {
  const done = s.entries.filter((e) => e.done).length
  const { frac, seconds } = clock(s.endsAt, s.stageTotal, now)
  if (compact) {
    return (
      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-3">
          <span className="st-marker truncate text-lg" style={{ color: CREAM }}>Everyone is painting</span>
          <span className="st-marker shrink-0 text-base" style={{ color: MUTED }}>{done} of {s.entries.length} done</span>
        </div>
        <div className="rounded-lg bg-[#FFF8EA] p-1.5"><Pencil frac={frac} seconds={seconds} /></div>
      </div>
    )
  }
  const n = s.entries.length
  const size = n <= 3 ? 230 : n <= 4 ? 190 : n <= 6 ? 150 : 120
  return (
    <div className="relative flex h-full min-h-0 flex-col gap-5 px-12 py-6">
      <div className="flex items-end justify-between gap-6">
        <WallTitle kicker="Draw Bluff presents" title="Tonight's exhibition" sub="Everyone is painting a secret. Draw it clearly: you get paid when they find the truth." />
        <div className="w-[360px] shrink-0 rounded-xl bg-[#FFF8EA] p-2"><Pencil frac={frac} seconds={seconds} big /></div>
      </div>
      <div className="flex flex-1 flex-wrap content-center items-end justify-center gap-x-10 gap-y-6">
        {s.entries.map((e) => {
          const p = who(e.artist)
          return (
            <div key={e.artist} className="relative grid justify-items-center gap-3">
              {e.done && <Spot w={size * 2.2} className="-top-24" />}
              <Frame glow={e.done} style={{ ['--st-rot' as string]: `${tilt(e.artist, 1.5)}deg` }} className={cx(e.done && 'st-pop')}>
                <div className="relative grid place-items-center overflow-hidden" style={{ width: size, height: size, background: e.done ? '#FFFDF6' : '#E9E0CC' }}>
                  {e.done ? (
                    <span className="st-marker -rotate-6 text-3xl" style={{ color: ST.red }}>ready</span>
                  ) : (
                    <>
                      {/* a drop cloth over the canvas while they work */}
                      <div className="absolute inset-0" style={{ background: 'repeating-linear-gradient(115deg, #D8CBB0 0 14px, #E6DBC4 14px 30px)' }} />
                      <span className="st-hand relative text-2xl text-[#575168]">painting</span>
                    </>
                  )}
                </div>
              </Frame>
              <Placard className="flex items-center gap-2 px-3 py-1.5">
                <Face p={p} size={30} dim={!p?.connected} />
                <span className="st-marker text-xl">{p?.name ?? e.artist}</span>
              </Placard>
              <span className="sr-only">{e.done ? 'Done' : 'Still drawing'}</span>
            </div>
          )
        })}
      </div>
      <div className="st-hand text-center text-3xl" style={{ color: MUTED }}>Then every painting gets fake titles. Yours too. {done}/{n} ready.</div>
    </div>
  )
}

// ---------------- one painting: title, pick, reveal ----------------

function OptionCard({ o, e, who, state, i }: { o: BOption; e: BEntry; who: Who; state: 'hidden' | 'open' | 'out' | 'current'; i: number }) {
  const v = state === 'out' || state === 'current' ? verdictFor(e, o, who) : null
  const pickers = pickersOf(e, o.id)
  const tone = o.kind === 'real' ? ST.gold : o.kind === 'house' ? ST.red : ST.orange
  const current = state === 'current'
  return (
    <div
      key={`${o.id}-${state === 'current' ? 'c' : 'x'}`}
      className={cx('relative', current && 'st-flip', state === 'open' && 'st-slide', state === 'out' && 'opacity-55')}
      style={{ animationDelay: state === 'open' ? `${i * 90}ms` : undefined, ['--st-from' as string]: '50px' }}
    >
      <Placard className={cx('grid gap-1 px-4 py-2.5', current && o.kind === 'real' && 'st-glow')} style={current ? { borderColor: tone, borderWidth: 4 } : undefined}>
        <div className="flex items-center justify-between gap-3">
          <span className="text-2xl font-bold leading-snug">{o.text}</span>
          {current && (
            <Stamp color={o.kind === 'real' ? '#B8860B' : tone} rot={-8} className="shrink-0 text-2xl">
              {o.kind === 'real' ? 'truth' : o.kind === 'house' ? 'house' : 'lie'}
            </Stamp>
          )}
        </div>
        {v && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="st-marker text-lg" style={{ color: o.kind === 'real' ? '#8A6408' : tone }}>{v.title}</span>
            <span className="text-lg text-[#575168]">{v.detail}</span>
            {pickers.length > 0 && (
              <span className="flex -space-x-2">
                {pickers.map((id) => <Face key={id} p={who(id)} size={28} className={current ? 'st-stamp' : undefined} />)}
              </span>
            )}
          </div>
        )}
      </Placard>
    </div>
  )
}

function Exhibit({ s, e, who, now }: { s: DrawBluffState; e: BEntry; who: Who; now: number }) {
  const guessers = guessersOf(s, e)
  const beatId = s.phase === 'reveal' ? e.reveal[s.shown] : null
  const truthOut = beatId === 'real'
  const { frac, seconds } = clock(s.endsAt, s.stageTotal, now)
  const scores = shownScores(s)
  const ranked = s.order.map((id) => ({ id, score: scores[id] ?? 0 })).sort((a, b) => b.score - a.score)
  const artist = who(e.artist)
  const stateOf = (o: BOption): 'hidden' | 'open' | 'out' | 'current' => {
    if (s.phase === 'pick') return 'open'
    if (o.id === beatId) return 'current'
    const at = e.reveal.indexOf(o.id)
    if (truthOut || (at >= 0 && at < s.shown)) return 'out'
    return 'open'
  }
  const head =
    s.phase === 'title' ? { kicker: `painting ${s.cur + 1} of ${s.queue.length}`, title: 'What is this?', sub: 'Write a fake title on your phone. Make it sound real.' }
    : s.phase === 'pick' ? { kicker: `painting ${s.cur + 1} of ${s.queue.length}`, title: 'Which one is real?', sub: 'Pick on your phone. One of these is the truth.' }
    : { kicker: `painting ${s.cur + 1} of ${s.queue.length}`, title: truthOut ? 'The truth' : 'The lies', sub: '' }
  const lies = guessers.filter((g) => e.fakes[g]).length
  const picks = guessers.filter((g) => e.picks[g]).length
  return (
    <div className="relative grid h-full min-h-0 grid-cols-[auto_minmax(0,1fr)] gap-10 px-12 py-5">
      <Spot x="25%" w={760} />
      <div className="relative flex min-h-0 flex-col items-center justify-center gap-4">
        {truthOut && <Confetti n={30} spread={380} />}
        <Frame glow={truthOut}>
          <div className="relative" style={{ width: 'min(430px, calc(100vh - 270px))' }}>
            <SketchCanvas strokes={e.strokes} listen={false} rounded={false} />
            {s.phase === 'reveal' && e.likes.length > 0 && (
              <span key={e.likes.length} className="st-pop st-marker absolute bottom-2 left-2 inline-flex items-center gap-1.5 rounded-full border-2 border-[#1F1B2E] bg-white px-3 py-1 text-xl" style={{ color: ST.red }}>
                <Heart size={20} fill="currentColor" />{e.likes.length}
              </span>
            )}
          </div>
        </Frame>
        <Placard className="grid min-w-[300px] justify-items-center gap-0.5 px-5 py-2 text-center">
          {truthOut ? (
            <>
              <span key="t" className="st-pop text-2xl font-bold first-letter:uppercase">{e.prompt}</span>
              <span className="flex items-center gap-2 text-lg text-[#575168]"><Face p={artist} size={24} />by {artist?.name}</span>
            </>
          ) : (
            <>
              <span className="text-2xl font-bold italic">Untitled</span>
              <span className="text-lg text-[#575168]">Artist unknown. One of you. Look innocent.</span>
            </>
          )}
        </Placard>
      </div>

      <div className="flex min-h-0 flex-col gap-3">
        <WallTitle kicker={head.kicker} title={head.title} sub={head.sub || undefined} />
        {s.phase !== 'reveal' && <div className="rounded-xl bg-[#FFF8EA] p-2"><Pencil frac={frac} seconds={seconds} big /></div>}
        {s.phase === 'title' && (
          <div className="grid flex-1 content-center justify-items-center gap-5">
            <span className="st-hand text-3xl" style={{ color: MUTED }}>lies in</span>
            <div className="flex flex-wrap justify-center gap-4">
              {guessers.map((g) => {
                const inn = !!e.fakes[g]
                return (
                  <div key={g} className="grid justify-items-center gap-2">
                    <div className={cx('grid h-24 w-20 place-items-center rounded-md border-[3px] border-[#1F1B2E] shadow-[4px_4px_0_rgba(0,0,0,0.45)]', inn ? 'st-drop bg-[#FFFBF1]' : 'bg-[#5a3443]')} style={{ ['--st-rot' as string]: `${tilt(g, 6)}deg` }}>
                      {inn ? <span className="st-marker text-3xl text-[#1F1B2E]">?</span> : <span className="st-hand text-xl" style={{ color: MUTED }}>...</span>}
                    </div>
                    <Face p={who(g)} size={34} />
                  </div>
                )
              })}
            </div>
            <span className="st-marker text-4xl" style={{ color: CREAM }}>{lies}/{guessers.length}</span>
          </div>
        )}
        {(s.phase === 'pick' || s.phase === 'reveal') && (
          <div className="grid min-h-0 content-start gap-2.5 overflow-hidden">
            {e.options.map((o, i) => <OptionCard key={o.id} o={o} e={e} who={who} state={stateOf(o)} i={i} />)}
          </div>
        )}
        {s.phase === 'pick' && <div className="st-hand text-2xl" style={{ color: MUTED }}>{picks}/{guessers.length} picked</div>}
        <div className="mt-auto flex flex-wrap gap-2">
          {ranked.map((r, i) => {
            const p = who(r.id)
            return (
              <span key={r.id} className="inline-flex items-center gap-2 rounded-md border-2 border-[#1F1B2E] py-1 pl-1 pr-3" style={{ background: i === 0 && r.score > 0 ? 'linear-gradient(135deg, #f5d98b, #c99a3b)' : '#FFFBF1' }}>
                <Face p={p} size={30} />
                <span className="text-lg font-bold text-[#1F1B2E]">{p?.name ?? r.id}</span>
                <span key={r.score} className="st-marker st-pop text-lg tabular text-[#1F1B2E]">{r.score.toLocaleString('en-US')}</span>
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Compact({ s, e, who, me, now }: { s: DrawBluffState; e: BEntry; who: Who; me?: string | null; now: number }) {
  const beatId = s.phase === 'reveal' ? e.reveal[s.shown] : null
  const o = beatId ? e.options.find((x) => x.id === beatId) : null
  const v = o ? verdictFor(e, o, who, me) : null
  const { frac, seconds } = clock(s.endsAt, s.stageTotal, now)
  const title = s.phase === 'title' ? 'What is this?' : s.phase === 'pick' ? 'Which one is real?' : beatId === 'real' ? 'The truth' : 'The lies'
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="st-marker truncate text-lg" style={{ color: CREAM }}>{title}</span>
        <span className="st-marker shrink-0 text-sm" style={{ color: MUTED }}>Painting {s.cur + 1} of {s.queue.length}</span>
      </div>
      {s.phase !== 'reveal' && <div className="rounded-lg bg-[#FFF8EA] p-1.5"><Pencil frac={frac} seconds={seconds} /></div>}
      <div className="relative flex justify-center">
        {beatId === 'real' && <Confetti n={14} spread={170} />}
        <Frame glow={beatId === 'real'} style={{ padding: 8 }}>
          <div style={{ width: 'min(64vw, 30vh)' }}><SketchCanvas strokes={e.strokes} listen={false} rounded={false} /></div>
        </Frame>
      </div>
      {o && v && (
        <Placard key={beatId} className="st-flip grid gap-0.5 p-3 text-center" style={{ borderColor: o.kind === 'real' ? ST.gold : o.kind === 'house' ? ST.red : ST.orange, borderWidth: 3 }}>
          <span className="text-lg font-bold leading-snug">{o.text}</span>
          <span className="st-marker text-sm" style={{ color: o.kind === 'real' ? '#8A6408' : o.kind === 'house' ? ST.red : ST.orange }}>{v.title}</span>
          <span className="text-sm text-[#575168]">{v.detail}</span>
        </Placard>
      )}
    </div>
  )
}

// ---------------- the exhibition ----------------

function Rosette({ label, p, color }: { label: string; p?: ReturnType<Who>; color: string }) {
  if (!p) return null
  return (
    <div className="st-drop flex items-center gap-3" style={{ ['--st-rot' as string]: '0deg' }}>
      <span className="relative grid h-14 w-14 shrink-0 place-items-center">
        <svg viewBox="0 0 60 60" className="absolute inset-0" aria-hidden>
          <path d="M20 40 L14 58 L22 53 L27 60 L30 42 Z M40 40 L46 58 L38 53 L33 60 L30 42 Z" fill={color} stroke="#1F1B2E" strokeWidth="2.5" strokeLinejoin="round" />
          <circle cx="30" cy="26" r="22" fill={color} stroke="#1F1B2E" strokeWidth="3" />
          <circle cx="30" cy="26" r="15" fill="none" stroke="#1F1B2E" strokeWidth="2" strokeDasharray="3 3" />
        </svg>
        <span className="relative -mt-2"><Face p={p} size={26} /></span>
      </span>
      <span className="grid leading-tight">
        <span className="st-hand text-xl" style={{ color: MUTED }}>{label}</span>
        <span className="st-marker text-2xl" style={{ color: CREAM }}>{p.name}</span>
      </span>
    </div>
  )
}

function Finale({ s, who, compact, skip }: { s: DrawBluffState; who: Who; compact: boolean; skip: (() => void) | null }) {
  const items = s.queue.map((i) => s.entries[i])
  const n = items.length
  const a = awards(s)
  if (compact) {
    return (
      <div className="grid gap-2">
        <span className="st-marker text-lg" style={{ color: CREAM }}>Tonight's exhibition</span>
        <div className="flex flex-wrap justify-center gap-3">
          {items.map((e) => (
            <div key={e.artist} className="grid w-[100px] justify-items-center gap-1">
              <Frame style={{ padding: 5 }}><StrokeThumb strokes={e.strokes} size={74} className="block" /></Frame>
              <span className="line-clamp-2 text-center text-xs font-bold leading-tight first-letter:uppercase" style={{ color: CREAM }}>{e.prompt}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }
  const size = n <= 3 ? 210 : n <= 4 ? 170 : n <= 6 ? 130 : 100
  return (
    <div className="relative flex h-full min-h-0 flex-col gap-4 px-12 py-5">
      <Spot x="50%" w={1200} />
      <div className="flex items-start justify-between gap-6">
        <WallTitle kicker="the whole show" title="Tonight's exhibition" />
        <div className="flex items-center gap-8">
          <Rosette label="Master forger" p={a.forger ? who(a.forger) : undefined} color="#E5484D" />
          <Rosette label="Sharp eye" p={a.eye ? who(a.eye) : undefined} color="#3B6FE0" />
          <Rosette label="Crowd favorite" p={a.loved ? who(a.loved) : undefined} color="#FFD23F" />
          {skip && <button onClick={skip} className="st-btn bg-[#FFF8EA] text-xl">Scores</button>}
        </div>
      </div>
      <div className="flex flex-1 flex-wrap content-center items-start justify-center gap-x-10 gap-y-5">
        {items.map((e, i) => {
          const lie = bestLie(e)
          const p = who(e.artist)
          return (
            <div key={e.artist} className="st-drop grid justify-items-center gap-2.5" style={{ animationDelay: `${i * 180}ms`, ['--st-rot' as string]: '0deg', width: size + 70 }}>
              <Frame>
                <div className="relative">
                  <StrokeThumb strokes={e.strokes} size={size} className="block" />
                  {e.likes.length > 0 && (
                    <span className="st-marker absolute bottom-1 left-1 inline-flex items-center gap-1 rounded-full border-2 border-[#1F1B2E] bg-white px-2 text-base" style={{ color: ST.red }}>
                      <Heart size={14} fill="currentColor" />{e.likes.length}
                    </span>
                  )}
                </div>
              </Frame>
              <Placard className="grid w-full gap-0.5 px-3 py-2 text-center">
                <span className="text-lg font-bold leading-tight first-letter:uppercase">{e.prompt}</span>
                <span className="flex items-center justify-center gap-1.5 text-sm text-[#575168]"><Face p={p} size={18} />{p?.name}</span>
                {lie && (
                  <span className="mt-0.5 border-t border-dashed border-[#8B8698] pt-1 text-sm leading-tight text-[#575168]">
                    <span className="st-marker" style={{ color: lie.o.kind === 'house' ? ST.red : ST.orange }}>{lie.o.kind === 'house' ? 'House lie' : 'Best lie'}</span>{' '}
                    "{lie.o.text}" fooled {lie.fooled}
                  </span>
                )}
              </Placard>
            </div>
          )
        })}
      </div>
    </div>
  )
}
