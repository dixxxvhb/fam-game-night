import { useEffect, useRef } from 'react'
import type { RoomPlayer, StageProps } from '../../engine/types'
import { sfx } from '../../ui/sfx'
import { useTicker } from '../../engine/context'
import { cx } from '../../ui/kit'
import { SketchCanvas, StrokeThumb } from './Canvas'
import { hintMask, type Guess, type SketchState } from './logic'
import { clock, Confetti, Face, NOTE_COLORS, Page, Pencil, ST, Stamp, Sticky, Taped, tilt, Title } from '../_draw/studio'

type Who = (id: string) => RoomPlayer | undefined

/** How long a "got it" moment holds the canvas. */
const GOT_MS = 1900

/** The hint as paper letter tiles: blanks, revealed letters, gaps between words. */
export function HintTiles({ word, frac, size = 46, reveal = false }: { word: string; frac: number; size?: number; reveal?: boolean }) {
  const mask = hintMask(word, frac)
  return (
    <div className="flex flex-wrap items-end justify-center gap-y-2" aria-label={reveal ? word : 'Word hint'}>
      {[...word].map((ch, i) => {
        if (ch === ' ') return <span key={i} style={{ width: size * 0.55 }} />
        const isLetter = /[a-z0-9]/i.test(ch)
        const show = reveal || mask[i] || !isLetter
        return (
          <span
            key={i}
            className={cx('st-marker mx-[3px] grid place-items-center rounded-md border-[3px] leading-none', reveal && 'st-flip')}
            style={{
              width: isLetter ? size * 0.82 : size * 0.4, height: size, fontSize: size * 0.62,
              background: !isLetter ? 'transparent' : show ? '#FFD23F' : '#FFFFFF',
              borderColor: isLetter ? ST.ink : 'transparent',
              boxShadow: isLetter ? `0 4px 0 ${ST.ink}` : 'none',
              animationDelay: reveal ? `${i * 45}ms` : undefined,
              color: ST.ink,
            }}
          >
            {show ? ch.toUpperCase() : ''}
          </span>
        )
      })}
    </div>
  )
}

function Stars({ n, size = 18 }: { n: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={['', 'Easy', 'Medium', 'Hard'][n] ?? ''}>
      {[1, 2, 3].map((i) => (
        <svg key={i} viewBox="0 0 24 24" width={size} height={size} aria-hidden>
          <path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z" fill={i <= n ? ST.yellow : 'transparent'} stroke={ST.ink} strokeWidth="2.2" strokeLinejoin="round" />
        </svg>
      ))}
    </span>
  )
}

function useSketchSounds(s: SketchState) {
  const solved = useRef(s.solved.length)
  const guesses = useRef(s.guesses.length)
  const stage = useRef(s.stage)
  useEffect(() => {
    if (s.solved.length > solved.current) sfx.play('good')
    else if (s.guesses.length > guesses.current && s.guesses.at(-1)?.close) sfx.play('pop')
    solved.current = s.solved.length
    guesses.current = s.guesses.length
  }, [s.solved.length, s.guesses])
  useEffect(() => {
    if (stage.current === s.stage) return
    stage.current = s.stage
    if (s.stage === 'reveal') sfx.play(s.last?.solvers.length ? 'reveal' : 'bad')
    if (s.stage === 'draw') sfx.play('start')
    if (s.stage === 'gallery') sfx.play('win')
  }, [s.stage, s.last])
}

/** The latest correct guess, while it is fresh. */
function freshSolve(s: SketchState, now: number) {
  const x = s.solved.at(-1)
  return x && now - x.at < GOT_MS ? x : null
}

export function SketchStage({ state: s, room, now, compact, me, isHost, hostAction }: StageProps<SketchState>) {
  useTicker(200)
  useSketchSounds(s)
  const who: Who = (id) => room.players.find((p) => p.id === id)
  const t = now()
  if (s.stage === 'gallery' || s.stage === 'done') return <Gallery s={s} who={who} compact={compact} skip={isHost && !compact ? () => hostAction('next') : null} />
  if (compact) return <Compact s={s} who={who} now={t} me={me} />
  return <Tv s={s} who={who} now={t} />
}

// ---------------- the canvas, with its moments ----------------

function Easel({ s, who, now, size, compact = false }: { s: SketchState; who: Who; now: number; size: string; compact?: boolean }) {
  const got = s.stage === 'draw' ? freshSolve(s, now) : null
  const gp = got ? who(got.playerId) : null
  const drawer = who(s.drawer)
  return (
    <Taped rot={compact ? 0 : -1.2} className="shrink-0" style={{ width: size }}>
      <div className="relative">
        <SketchCanvas strokes={s.stage === 'choose' ? [] : s.strokes} rounded={false} />

        {s.stage === 'choose' && (
          <div className="absolute inset-0 grid place-items-center">
            <div className="grid justify-items-center gap-4">
              <div className="flex gap-3">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="st-wiggle grid place-items-center rounded-lg border-[3px] border-[#1F1B2E] bg-[#A9C8FF] shadow-[4px_4px_0_#1F1B2E]"
                    style={{ width: compact ? 52 : 92, height: compact ? 72 : 128, ['--st-rot' as string]: `${(i - 1) * 6}deg`, animationDelay: `${i * 180}ms` }}
                  >
                    <span className={cx('st-marker text-[#1F1B2E]', compact ? 'text-2xl' : 'text-5xl')}>?</span>
                  </div>
                ))}
              </div>
              <div className={cx('st-marker text-center', compact ? 'text-lg' : 'text-3xl')}>{drawer?.name ?? 'Someone'} is picking a word</div>
            </div>
          </div>
        )}

        {got && gp && (
          <div key={got.playerId} className="absolute inset-0 grid place-items-center overflow-hidden" style={{ background: 'rgba(255,248,234,0.55)' }}>
            <Confetti n={compact ? 16 : 30} spread={compact ? 180 : 360} />
            <div className="grid justify-items-center gap-2 px-4 text-center">
              <Face p={gp} size={compact ? 44 : 96} className="st-pop" />
              <Stamp color={ST.green} rot={-6} className={compact ? 'text-xl' : 'text-5xl'} style={{ maxWidth: '100%', overflowWrap: 'anywhere' }}>{gp.name}</Stamp>
              <span className={cx('st-marker st-pop', compact ? 'text-xl' : 'text-4xl')} style={{ color: ST.green, animationDelay: '250ms' }}>got it. +{got.points}</span>
            </div>
          </div>
        )}

        {s.stage === 'reveal' && s.last && (
          <div className="absolute inset-0 grid place-items-center overflow-hidden" style={{ background: 'rgba(255,248,234,0.35)' }}>
            {s.last.solvers.length > 0 && <Confetti n={compact ? 14 : 28} spread={compact ? 160 : 340} />}
            <div className="grid justify-items-center gap-3 px-3 text-center">
              <span className={cx('st-hand text-[#575168]', compact ? 'text-xl' : 'text-4xl')}>It was</span>
              <Stamp color={s.last.solvers.length ? ST.red : ST.ink} rot={-7} className={compact ? 'text-3xl' : 'text-7xl'} style={{ maxWidth: '100%', overflowWrap: 'anywhere' }}>{s.last.word}</Stamp>
              {!s.last.solvers.length && <span className={cx('st-marker st-pop', compact ? 'text-lg' : 'text-3xl')} style={{ animationDelay: '500ms' }}>Nobody got it</span>}
            </div>
          </div>
        )}
      </div>
    </Taped>
  )
}

// ---------------- TV ----------------

function GuessNote({ g, who, seat, i }: { g: Guess; who: Who; seat: number; i: number }) {
  const p = who(g.playerId)
  return (
    <div className="st-slide flex items-center gap-3" style={{ ['--st-from' as string]: '40px', opacity: Math.max(0.35, 1 - i * 0.12) }}>
      <Face p={p} size={36} />
      <Sticky color={g.correct ? '#9FE3C1' : NOTE_COLORS[seat % NOTE_COLORS.length]} rot={tilt(`${g.at}${g.playerId}`, 2)} className="min-w-0 flex-1">
        {g.correct ? (
          <span className="st-marker text-2xl text-[#1E7A44]">got it</span>
        ) : (
          <span className="flex min-w-0 items-baseline gap-2">
            <span className={cx('st-hand truncate text-3xl leading-none', !g.close && 'line-through decoration-[#E5484D] decoration-[3px]')}>{g.text}</span>
            {g.close && <span className="st-marker shrink-0 rounded-md bg-[#FF6B3D] px-2 py-0.5 text-base text-white">so close</span>}
          </span>
        )}
      </Sticky>
    </div>
  )
}

function Tv({ s, who, now }: { s: SketchState; who: Who; now: number }) {
  const drawer = who(s.drawer)
  const { frac, seconds } = clock(s.endsAt, s.stageTotal, now)
  const hintFrac = 1 - frac
  const ranked = Object.keys(s.scores).map((id) => ({ id, score: s.scores[id] ?? 0 })).sort((a, b) => b.score - a.score)
  const seats = Object.keys(s.scores)
  const head =
    s.stage === 'choose' ? 'is picking'
    : s.stage === 'draw' ? 'is drawing'
    : 'drew this'
  return (
    <Page className="h-full overflow-hidden" style={{ ['--st-margin' as string]: '40px' }}>
      <div className="grid h-full min-h-0 grid-cols-[auto_minmax(0,1fr)] gap-10 py-6 pl-16 pr-8">
        <div className="flex min-h-0 items-center">
          <Easel s={s} who={who} now={now} size="min(560px, calc(100vh - 150px))" />
        </div>
        <div className="flex min-h-0 flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <Face p={drawer} size={64} />
              <div className="grid min-w-0">
                <span className="st-marker truncate text-4xl leading-tight">{drawer?.name ?? 'Someone'}</span>
                <span className="st-hand text-3xl leading-none text-[#575168]">{head}</span>
              </div>
            </div>
            <Sticky color="#FFE36E" rot={3} className="shrink-0 text-center">
              <div className="st-hand text-xl leading-none">drawing</div>
              <div className="st-marker text-3xl leading-none">{Math.min(s.turn + 1, s.order.length)}<span className="text-xl text-[#575168]">/{s.order.length}</span></div>
            </Sticky>
          </div>

          <Pencil frac={frac} seconds={s.stage === 'reveal' ? undefined : seconds} big />

          {s.stage === 'draw' && (
            <div className="grid justify-items-center gap-2">
              <HintTiles word={s.word} frac={hintFrac} size={50} />
              <Stars n={s.tier} size={22} />
            </div>
          )}
          {s.stage === 'reveal' && s.last && (
            <div className="grid justify-items-center gap-2">
              <HintTiles word={s.last.word} frac={1} size={50} reveal />
            </div>
          )}

          <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-6">
            <div className="grid content-start gap-2">
              <div className="st-hand text-2xl leading-none text-[#575168]">scores</div>
              {ranked.map((r, i) => {
                const p = who(r.id)
                const got = s.solved.find((x) => x.playerId === r.id)
                const gain = s.stage === 'reveal' ? s.last?.points[r.id] : undefined
                return (
                  <div key={r.id} className={cx('relative flex items-center gap-2.5 rounded-xl border-[3px] border-[#1F1B2E] bg-white px-2.5 py-1.5', got ? 'shadow-[3px_3px_0_#2FA65A]' : 'shadow-[3px_3px_0_#1F1B2E]')} style={{ transform: `rotate(${tilt(r.id, 0.8)}deg)` }}>
                    <span className="st-marker w-5 text-center text-xl text-[#8B8698]">{i + 1}</span>
                    <Face p={p} size={32} />
                    <span className="min-w-0 flex-1 truncate text-xl font-bold">{p?.name ?? r.id}</span>
                    {r.id === s.drawer && s.stage === 'draw' && <span className="st-hand text-xl text-[#575168]">drawing</span>}
                    {got && s.stage === 'draw' && (
                      <span className="st-pop grid h-7 w-7 place-items-center rounded-full border-2 border-[#1F1B2E] bg-[#9FE3C1]" aria-label="got it">
                        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden><path d="M4 12.5l5 5L20 6.5" fill="none" stroke="#1F1B2E" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </span>
                    )}
                    {gain ? <span key={`${s.turn}-${r.id}`} className="st-marker st-pop text-lg text-[#2FA65A]">+{gain}</span> : null}
                    <span className="st-marker tabular text-2xl">{r.score}</span>
                  </div>
                )
              })}
            </div>
            <div className="flex min-h-0 flex-col gap-2 overflow-hidden">
              <div className="st-hand text-2xl leading-none text-[#575168]">guesses</div>
              {s.stage === 'draw' && !s.guesses.length && <div className="st-hand text-3xl text-[#8B8698]">Shout it into your phone.</div>}
              {[...s.guesses].reverse().slice(0, 7).map((g, i) => (
                <GuessNote key={`${g.at}-${g.playerId}`} g={g} who={who} seat={Math.max(0, seats.indexOf(g.playerId))} i={i} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </Page>
  )
}

// ---------------- apart phones ----------------

function Compact({ s, who, now, me }: { s: SketchState; who: Who; now: number; me?: string | null }) {
  const drawer = who(s.drawer)
  const { frac, seconds } = clock(s.endsAt, s.stageTotal, now)
  // On the drawer's own phone the pad below already shows the drawing.
  const drawerHere = me === s.drawer && (s.stage === 'draw' || s.stage === 'choose')
  const lastWrong = [...s.guesses].reverse().find((g) => !g.correct)
  return (
    <div className="st-page-plain -m-3 grid gap-2 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Face p={drawer} size={30} />
          <span className="st-marker truncate text-lg">{drawer?.name} {s.stage === 'choose' ? 'is picking' : s.stage === 'draw' ? 'is drawing' : 'drew this'}</span>
        </div>
        <span className="st-marker shrink-0 text-base text-[#575168]">{Math.min(s.turn + 1, s.order.length)}/{s.order.length}</span>
      </div>
      {s.stage !== 'reveal' && <Pencil frac={frac} seconds={seconds} />}
      {!drawerHere && (
        <>
          {s.stage === 'draw' && <HintTiles word={s.word} frac={1 - frac} size={30} />}
          <div className="flex justify-center"><Easel s={s} who={who} now={now} size="min(100%, 40vh)" compact /></div>
          {s.stage === 'draw' && lastWrong && (
            <div key={`${lastWrong.at}`} className="st-slide flex items-center justify-center gap-2 text-center">
              <Face p={who(lastWrong.playerId)} size={22} />
              <span className={cx('st-hand text-2xl leading-none', !lastWrong.close && 'line-through decoration-[#E5484D] decoration-2')}>{lastWrong.text}</span>
              {lastWrong.close && <span className="st-marker rounded bg-[#FF6B3D] px-1.5 text-sm text-white">so close</span>}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ---------------- the wall ----------------

function Gallery({ s, who, compact, skip }: { s: SketchState; who: Who; compact: boolean; skip: (() => void) | null }) {
  const items = s.gallery
  const n = items.length
  const cols = compact ? Math.min(3, n) : n <= 3 ? n : n <= 6 ? 3 : n <= 8 ? 4 : 5
  const rows = Math.ceil(n / cols)
  const thumb = compact ? 96 : Math.floor(Math.min(1100 / cols - 60, 470 / rows - 70))
  const fastest = items.reduce<number>((m, x) => (x.ms !== null && (m < 0 || x.ms < items[m].ms!) ? items.indexOf(x) : m), -1)
  return (
    <Page className={cx('h-full overflow-hidden', compact && '-m-3 p-3')} style={{ ['--st-margin' as string]: compact ? '14px' : '40px' }}>
      <div className={cx('flex h-full min-h-0 flex-col', compact ? 'gap-3' : 'gap-5 px-16 py-6')}>
        <div className="flex items-center justify-between gap-4">
          <Title className={compact ? 'text-2xl' : 'text-6xl'}>Tonight's sketchbook</Title>
          {skip && <button onClick={skip} className="st-btn bg-white text-xl">Scores</button>}
        </div>
        <div className="grid flex-1 content-center justify-center gap-x-8 gap-y-6" style={{ gridTemplateColumns: `repeat(${cols}, ${thumb + 20}px)` }}>
          {items.map((it, i) => {
            const p = who(it.drawer)
            return (
              <div key={i} className="st-drop grid justify-items-center gap-1.5" style={{ animationDelay: `${i * 140}ms`, ['--st-rot' as string]: `${tilt(it.word, 4)}deg` }}>
                <Taped tape={!compact} className="relative" style={{ padding: compact ? 4 : 8 }}>
                  <StrokeThumb strokes={it.strokes} size={thumb} className="block" />
                  {i === fastest && !compact && (
                    <span className="absolute -right-5 -top-6 z-10"><Stamp color={ST.blue} rot={12} className="text-lg" style={{ animationDelay: `${n * 140 + 300}ms` }}>fastest</Stamp></span>
                  )}
                </Taped>
                <div className="st-marker max-w-full truncate text-center capitalize leading-tight" style={{ fontSize: compact ? 14 : 24 }}>{it.word}</div>
                {!compact && (
                  <div className="flex items-center gap-1.5">
                    <Face p={p} size={22} />
                    <span className="st-hand text-xl leading-none text-[#575168]">{it.solvers.length ? `${it.solvers.length} got it` : 'nobody got it'}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </Page>
  )
}
