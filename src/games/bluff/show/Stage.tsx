import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import type { RoomView, StageProps } from '../../../engine/types'
import { useTicker } from '../../../engine/context'
import { Avatar, cx } from '../../../ui/kit'
import { BEAT_FLIP_MS, BEAT_PICKERS_MS, FOOL_POINTS, TOLD_POINTS, TRUTH_POINTS, isAbout, pickersOf, type Answer, type LieState } from '../../_lie/logic'
import { Prompt } from '../../_lie/Prompt'
import { Heart } from '../../_lie/Heart'
import { HostArt } from '../../_lie/hosts'
import { cue, useCue, useSting, type StingId } from '../../_lie/audio'
import { themeFor, useThemeFonts, type HostMood } from '../../_lie/theme'
import { colorOf, joinNames, nameOf, waitingOn } from '../../_lie/view'
import { POLLY, line } from './lines'
import '../../_lie/lie.css'
import './bluff.css'

/**
 * Bluff on the TV: Polly's interrogation room. A case file under the lamp holds the
 * question, a polygraph chart runs along the bottom with one live trace per player, and
 * every answer is evidence that gets stamped as it comes out.
 */

const T = themeFor('blank', 'bluff')
const BEAT_NEEDLE_MS = 1_700
const BEAT_TRUTH_MS = 1_350
const SPLASH_MS = 2_400
const COUNT_MS = 1_400
const LETTERS = 'ABCDEFGHIJ'

function ease(x: number) {
  const t = Math.max(0, Math.min(1, x))
  return 1 - Math.pow(1 - t, 3)
}

const pad2 = (n: number) => String(n).padStart(2, '0')

function factorText(s: LieState) {
  const last = s.round === s.items.length - 1
  if (last && s.cur.factor === 3) return 'Final case. Triple points'
  if (s.cur.factor === 3) return 'Triple points'
  if (s.cur.factor === 2) return 'Double points'
  return ''
}

function caseTab(s: LieState) {
  if (isAbout(s)) return 'Subject file'
  const cat = s.cur.item.cat ? s.catNames?.[s.cur.item.cat] : null
  return `Case ${pad2(s.round + 1)}${cat ? ` / ${cat}` : ''}`
}

function liveScores(s: LieState, now: number): Record<string, number> {
  if (s.stage !== 'reveal') return s.scores
  const step = s.cur.steps[s.cur.step]
  if (step?.kind !== 'tally') return s.before
  const k = ease((now - s.stageStartedAt) / COUNT_MS)
  const out: Record<string, number> = {}
  for (const id of Object.keys(s.scores)) out[id] = Math.round((s.before[id] ?? 0) + ((s.scores[id] ?? 0) - (s.before[id] ?? 0)) * k)
  return out
}

// ---------------- sound ----------------

function useBeat(id: StingId | null, key: string | null, at: number, startedAt: number, now: () => number) {
  useEffect(() => {
    if (!id || !key) return
    const wait = at - (now() - startedAt)
    if (wait < -400) return
    const t = setTimeout(() => cue.sting(id), Math.max(0, wait))
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per key
  }, [key])
}

function useBluffSound(s: LieState, now: () => number) {
  const stage = s.stage
  useCue(stage === 'category' || stage === 'lie' ? T.cues.lie : stage === 'pick' ? T.cues.pick : stage === 'reveal' ? T.cues.reveal : T.cues.final)
  useSting('splash', stage === 'lie' || stage === 'category' ? `r${s.round}` : null)
  const count = stage === 'lie' ? Object.keys(s.cur.lies).length : stage === 'pick' ? Object.keys(s.cur.picks).length : 0
  useSting('lock', count > 0 ? `${stage}-${s.round}-${count}` : null)
  const step = stage === 'reveal' ? s.cur.steps[s.cur.step] : undefined
  const key = step ? `${s.round}-${s.cur.step}` : null
  const a = step?.answerId ? s.cur.answers.find((x) => x.id === step.answerId) : undefined
  const lieKey = step?.kind === 'lie' ? key : null
  useBeat('needle', lieKey, BEAT_NEEDLE_MS, s.stageStartedAt, now)
  useBeat('stamp', lieKey, BEAT_FLIP_MS, s.stageStartedAt, now)
  useBeat(a?.house ? 'buzz' : null, lieKey, BEAT_FLIP_MS + 120, s.stageStartedAt, now)
  useBeat('drumroll', step?.kind === 'truth' ? key : null, 0, s.stageStartedAt, now)
  const found = a?.truth ? pickersOf(s.cur, a.id).length > 0 : false
  useBeat(found ? 'truth' : 'nobody', step?.kind === 'truth' ? key : null, BEAT_TRUTH_MS, s.stageStartedAt, now)
  useBeat(s.cur.skipped ? 'buzz' : 'tally', step?.kind === 'tally' ? key : null, 200, s.stageStartedAt, now)
  const hearts = Object.values(s.cur.likes).reduce((n, l) => n + l.length, 0)
  const last = useRef(hearts)
  useEffect(() => {
    if (hearts > last.current) cue.sting('heart')
    last.current = hearts
  }, [hearts])
  useSting('win', stage === 'final' ? 'final' : null)
}

// ---------------- the polygraph ----------------

/** How hard each player's trace is moving right now, 0 (flat) to 1 (off the chart). */
function heat(s: LieState, id: string, el: number): number {
  const subject = s.cur.item.subject
  if (s.stage === 'category') return s.choose?.by === id ? 0.35 : 0.06
  if (s.stage === 'lie') return s.cur.lies[id] ? 0.06 : id === subject ? 0.45 : 0.28
  if (s.stage === 'pick') return id === subject ? 0.55 : s.cur.picks[id] ? 0.06 : 0.3
  if (s.stage === 'reveal') {
    const step = s.cur.steps[s.cur.step]
    const a = step?.answerId ? s.cur.answers.find((x) => x.id === step.answerId) : undefined
    if (step?.kind === 'lie' && a) {
      if (a.by.includes(id)) return el >= BEAT_NEEDLE_MS && el < BEAT_FLIP_MS + 300 ? 1 : 0.18
      if (s.cur.picks[id] === a.id) return el >= BEAT_PICKERS_MS && el < BEAT_PICKERS_MS + 700 ? 0.6 : 0.12
    }
    if (step?.kind === 'truth' && a) {
      if (id === subject) return el < BEAT_TRUTH_MS ? 0.7 : 0.1
      if (s.cur.picks[id] === a.id) return el >= BEAT_TRUTH_MS && el < BEAT_TRUTH_MS + 800 ? 0.7 : 0.08
    }
    return 0.08
  }
  return 0.05
}

const SAMPLES = 180
const SAMPLE_MS = 34

/** One trace per player, sampled into a ring buffer and drawn without re-rendering React. */
function Chart({ s, room, now, height }: { s: LieState; room: RoomView; now: () => number; height: number }) {
  const ids = room.gamePlayers
  const paths = useRef<(SVGPathElement | null)[]>([])
  const bufs = useRef<Record<string, number[]>>({})
  const state = useRef(s)
  state.current = s
  const lane = height / Math.max(1, ids.length)
  const W = 1000

  useEffect(() => {
    let raf = 0
    let last = 0
    let t = 0
    const loop = (ts: number) => {
      raf = requestAnimationFrame(loop)
      if (ts - last < SAMPLE_MS) return
      last = ts
      t += 1
      const cur = state.current
      const el = now() - cur.stageStartedAt
      ids.forEach((id, i) => {
        const h = heat(cur, id, el)
        const b = (bufs.current[id] ??= Array(SAMPLES).fill(0))
        const ph = i * 1.7
        const calm = Math.sin(t * 0.21 + ph) * 0.25 + Math.sin(t * 0.07 + ph) * 0.15
        const spike = h > 0.5 ? (Math.random() * 2 - 1) * h : 0
        const v = (calm + Math.sin(t * 0.9 + ph) * h * 0.6 + spike) * (lane * 0.42)
        b.push(v)
        if (b.length > SAMPLES) b.shift()
        const mid = lane * i + lane / 2
        const step = W / (SAMPLES - 1)
        let d = ''
        for (let k = 0; k < b.length; k++) d += `${k ? 'L' : 'M'}${(k * step).toFixed(1)} ${(mid - b[k]).toFixed(1)}`
        paths.current[i]?.setAttribute('d', d)
      })
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [ids, lane, now])

  const scores = liveScores(s, now())
  return (
    <div className="bf-chart flex" style={{ height }}>
      <div className="grid w-56 shrink-0 border-r-2 border-[#050909]/40 bg-[#EDE5CE]" style={{ gridTemplateRows: `repeat(${ids.length}, 1fr)` }}>
        {ids.map((id) => {
          const sub = s.cur.item.subject === id
          return (
            <div key={id} className="flex min-w-0 items-center gap-2 border-b border-[#050909]/15 px-3 text-[#2B2318]">
              <Avatar name={nameOf(room, id)} color={colorOf(room, id)} size={Math.min(30, lane - 8)} />
              <span className="min-w-0 flex-1 truncate font-bold" style={{ fontSize: Math.min(20, lane * 0.42) }}>{nameOf(room, id)}</span>
              {sub && (s.stage === 'lie' || s.stage === 'pick') && <span className="bf-type bf-blink shrink-0 text-xs text-[#D7263D]">SUBJECT</span>}
            </div>
          )
        })}
      </div>
      <div className="relative min-w-0 flex-1">
        <div className="bf-chart-grid" />
        <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          {ids.map((id, i) => (
            <path key={id} ref={(el) => { paths.current[i] = el }} fill="none" stroke={colorOf(room, id)} strokeWidth="2.6" strokeLinejoin="round" vectorEffect="non-scaling-stroke" style={{ filter: 'saturate(1.3) brightness(0.8)' }} />
          ))}
        </svg>
        <div className="bf-pen" />
      </div>
      <div className="grid w-40 shrink-0 border-l-2 border-[#050909]/40 bg-[#EDE5CE]" style={{ gridTemplateRows: `repeat(${ids.length}, 1fr)` }}>
        {ids.map((id) => (
          <div key={id} className="bf-stencil flex items-center justify-end border-b border-[#050909]/15 px-4 tabular text-[#2B2318]" style={{ fontSize: Math.min(28, lane * 0.55) }}>
            {scores[id] ?? 0}
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------- pieces ----------------

function Stamp({ text, truth, size, rot = -10, style }: { text: string; truth?: boolean; size: number; rot?: number; style?: CSSProperties }) {
  return <span className={cx('bf-stamp', truth && 'bf-true')} style={{ fontSize: size, ['--bf-rot' as string]: `${rot}deg`, ...style }}>{text}</span>
}

function Dial({ s, now }: { s: LieState; now: () => number }) {
  const left = Math.max(0, s.endsAt - now())
  const frac = s.stageTotal > 0 ? Math.min(1, left / s.stageTotal) : 0
  const secs = Math.ceil(left / 1000)
  const urgent = secs <= 5
  const r = 26
  const c = 2 * Math.PI * r
  return (
    <div className={cx('relative grid h-16 w-16 shrink-0 place-items-center', urgent && 'bf-shake')} aria-label={`${secs} seconds left`}>
      <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="#111A1A" stroke="#34514B" strokeWidth="7" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={urgent ? '#FF5A5F' : '#2EC4B6'} strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} style={{ transition: 'stroke-dashoffset 120ms linear' }} />
      </svg>
      <span className={cx('bf-stencil relative text-2xl tabular', urgent ? 'text-[#FF5A5F]' : 'text-[#F1EBDC]')}>{secs}</span>
    </div>
  )
}

function TopBar({ s, room, now }: { s: LieState; room: RoomView; now: () => number }) {
  const timed = s.stage === 'category' || s.stage === 'lie' || s.stage === 'pick'
  const f = factorText(s)
  return (
    <div className="flex items-center gap-5 px-8 pt-5">
      <span className="bf-stencil text-5xl leading-none text-[#E5484D] [text-shadow:3px_3px_0_#050909]">BLUFF</span>
      <span className="bf-type rounded-md border-2 border-[#34514B] px-3 py-1 text-lg text-[#BCC7BC]">
        {s.stage === 'final' || s.stage === 'done' ? 'Case closed' : isAbout(s) ? `About Us ${s.round - (s.aboutFrom ?? 0) + 1} of ${s.items.length - (s.aboutFrom ?? 0)}` : `Case ${s.round + 1} of ${s.aboutFrom ?? s.items.length}`}
      </span>
      {f && s.stage !== 'final' && <span className="l-factor text-lg">{f}</span>}
      <div className="flex flex-1 justify-center">{(s.stage === 'lie' || s.stage === 'pick') && <Locks s={s} room={room} />}</div>
      {timed && <Dial s={s} now={now} />}
    </div>
  )
}

function Polly({ text, mood }: { text: string; mood: HostMood }) {
  return (
    <div className="flex items-end gap-3">
      <div className="shrink-0"><HostArt theme="bluff" mood={mood} size={104} /></div>
      <div key={text} className="bf-bubble bf-rise mb-5 max-w-[30rem] px-4 py-2 text-lg leading-snug">{text}</div>
    </div>
  )
}

function CaseFile({ s, room, fill, truth, children }: { s: LieState; room: RoomView; fill?: string; truth?: boolean; children?: ReactNode }) {
  const subject = s.cur.item.subject
  return (
    <div className="bf-file w-full max-w-5xl px-10 pb-7 pt-8" data-tab={caseTab(s)}>
      <svg viewBox="0 0 30 70" width="26" height="62" aria-hidden className="absolute -top-5 right-14">
        <path d="M8 66 V12 a7 7 0 0 1 14 0 V56 a4 4 0 0 1 -8 0 V18" fill="none" stroke="#7E8A88" strokeWidth="3.4" strokeLinecap="round" />
      </svg>
      <div className="flex items-center gap-8">
        {subject && (
          <div className="bf-mug grid shrink-0 justify-items-center gap-2 px-5 pb-3 pt-5">
            <Avatar name={nameOf(room, subject)} color={colorOf(room, subject)} size={96} />
            <span className="bf-mug-plate text-base">{nameOf(room, subject)}</span>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <Prompt item={s.cur.item} kind="blank" size="hero" fill={fill} truth={truth} className={cx('bf-type !font-normal text-[#2B2318]', s.cur.item.prompt.length > 80 || subject ? '!text-[2.5rem]' : '!text-5xl')} />
        </div>
      </div>
      {children}
    </div>
  )
}

function Splash({ s, room }: { s: LieState; room: RoomView }) {
  const subject = s.cur.item.subject
  const firstAbout = subject && s.round === s.aboutFrom
  return (
    <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-[#0A1011]/55">
      <div className="bf-splash bf-file grid justify-items-center gap-2 px-16 py-10 text-center" data-tab={firstAbout ? 'New procedure' : 'Next case'}>
        <div className="bf-stencil text-7xl leading-none text-[#D7263D]">{firstAbout ? 'ABOUT US' : subject ? nameOf(room, subject) : `CASE ${pad2(s.round + 1)}`}</div>
        <div className="bf-type text-2xl">{firstAbout ? 'Polly questions the suspects. One of you at a time.' : subject ? 'Is under questioning.' : factorText(s) || 'Fill the blank with a lie.'}</div>
      </div>
    </div>
  )
}

function Locks({ s, room }: { s: LieState; room: RoomView }) {
  const done = (id: string) => (s.stage === 'lie' ? !!s.cur.lies[id] : !!s.cur.picks[id])
  const ids = room.gamePlayers.filter((id) => !(s.stage === 'pick' && id === s.cur.item.subject))
  return (
    <div className="flex flex-wrap justify-center gap-3">
      {ids.map((id) => (
        <span key={id} className={cx('bf-type flex items-center gap-2 rounded-md border-2 py-1 pl-1 pr-3 text-lg', done(id) ? 'border-[#3DD68C] text-[#F1EBDC]' : 'border-[#34514B] text-[#7F918A]')}>
          <Avatar name={nameOf(room, id)} color={colorOf(room, id)} size={28} dim={!done(id)} />
          {done(id) ? (s.stage === 'lie' && id === s.cur.item.subject ? 'Sworn in' : 'Locked') : s.stage === 'pick' ? 'Picking' : id === s.cur.item.subject ? 'Thinking' : 'Writing'}
        </span>
      ))}
    </div>
  )
}

function Category({ s, room }: { s: LieState; room: RoomView }) {
  const by = s.choose?.by ?? ''
  return (
    <div className="grid w-full max-w-5xl justify-items-center gap-8">
      <div className="bf-type flex items-center gap-3 text-3xl">
        <Avatar name={nameOf(room, by)} color={colorOf(room, by)} size={44} />
        <span><b className="font-bold">{nameOf(room, by)}</b> picks the line of questioning</span>
      </div>
      <div className="grid w-full grid-cols-3 gap-8">
        {(s.choose?.cats ?? []).map((c, i) => (
          <div key={c} className="bf-file bf-rise grid min-h-44 place-items-center px-6 pb-6 pt-8 text-center" data-tab={`File ${LETTERS[i]}`} style={{ animationDelay: `${i * 120}ms` }}>
            <span className="bf-stencil text-4xl leading-tight">{s.catNames?.[c] ?? c}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Exhibits({ s }: { s: LieState }) {
  const n = s.cur.answers.length
  const long = s.cur.answers.some((a) => a.text.length > 40)
  return (
    <div className="grid w-full max-w-6xl grid-cols-2 gap-x-6 gap-y-4">
      {s.cur.answers.map((a, i) => (
        <div key={a.id} className="bf-tag bf-rise flex items-center gap-4 py-4 pl-11 pr-5" style={{ animationDelay: `${i * 80}ms` }}>
          <span className="bf-stencil shrink-0 text-lg text-[#9C7F45]">EXHIBIT {LETTERS[i]}</span>
          <span className={cx('bf-type min-w-0 leading-snug [overflow-wrap:anywhere]', long || n > 5 ? 'text-2xl' : 'text-3xl')}>{a.text}</span>
        </div>
      ))}
    </div>
  )
}

function authorPoints(s: LieState, a: Answer, author: string) {
  const fooled = pickersOf(s.cur, a.id).filter((id) => id !== author).length
  return fooled * FOOL_POINTS * s.cur.factor * (a.copout.includes(author) ? 0.5 : 1)
}

function Pickers({ ids, room, label }: { ids: string[]; room: RoomView; label: string }) {
  if (!ids.length) return null
  return (
    <div className="bf-rise flex flex-wrap items-center justify-center gap-3">
      <span className="bf-type text-xl text-[#BCC7BC]">{label}</span>
      {ids.map((id) => (
        <span key={id} className="flex items-center gap-2 rounded-full bg-[#111A1A] py-1 pl-1 pr-4 text-xl font-bold">
          <Avatar name={nameOf(room, id)} color={colorOf(room, id)} size={32} />{nameOf(room, id)}
        </span>
      ))}
    </div>
  )
}

function RevealLie({ s, room, a, el }: { s: LieState; room: RoomView; a: Answer; el: number }) {
  const pickers = pickersOf(s.cur, a.id)
  const flipped = el >= BEAT_FLIP_MS
  const hearts = s.cur.likes[a.id]?.length ?? 0
  return (
    <div className="grid w-full max-w-5xl justify-items-center gap-6">
      <div className={cx('bf-tag relative w-full py-8 pl-16 pr-10', el >= BEAT_NEEDLE_MS && !flipped && 'bf-shake')}>
        <div className="bf-type text-4xl leading-snug">{a.text}</div>
        {flipped && (
          <div className="absolute -top-6 right-8">
            <Stamp text={a.house ? 'House lie' : 'Lie'} size={a.house ? 44 : 58} rot={-12} />
          </div>
        )}
        {hearts > 0 && <span className="absolute bottom-3 right-5 flex items-center gap-1 text-xl font-bold text-[#D7263D]"><Heart size={22} color="#D7263D" />{hearts}</span>}
      </div>
      {el >= BEAT_PICKERS_MS && <Pickers ids={pickers} room={room} label="Fell for it:" />}
      {flipped && (
        <div className="bf-rise bf-type text-center text-3xl">
          {a.house ? (
            <span>Polly wrote this one. <b className="text-[#FF5A5F]">-250</b> for falling for it.</span>
          ) : (
            <span className="inline-flex flex-wrap items-center justify-center gap-3">
              Written by
              {a.by.map((id) => (
                <span key={id} className="inline-flex items-center gap-2 font-bold" style={{ color: colorOf(room, id) }}>
                  <Avatar name={nameOf(room, id)} color={colorOf(room, id)} size={36} />{nameOf(room, id)}
                  <span className="bf-stencil text-[#3DD68C]">+{authorPoints(s, a, id)}</span>
                </span>
              ))}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function RevealTruth({ s, room, a, el }: { s: LieState; room: RoomView; a: Answer; el: number }) {
  const finders = pickersOf(s.cur, a.id)
  const shown = el >= BEAT_TRUTH_MS
  const subject = s.cur.item.subject
  return (
    <div className="grid w-full justify-items-center gap-6">
      <CaseFile s={s} room={room} fill={shown ? a.text : undefined} truth>
        {shown && (
          <div className="absolute -bottom-7 right-10">
            <Stamp text="True" truth size={58} rot={-8} />
          </div>
        )}
      </CaseFile>
      {shown && (finders.length ? (
        <div className="grid justify-items-center gap-2">
          <Pickers ids={finders} room={room} label={`Found it, +${TRUTH_POINTS * s.cur.factor}:`} />
          {subject && <div className="bf-rise bf-type text-2xl text-[#BCC7BC]">{nameOf(room, subject)} gets <b className="text-[#3DD68C]">+{TOLD_POINTS * s.cur.factor * finders.length}</b> for being known.</div>}
        </div>
      ) : (
        <div className="bf-rise bf-type text-3xl text-[#BCC7BC]">Nobody found it.</div>
      ))}
    </div>
  )
}

function Tally({ s, room, now }: { s: LieState; room: RoomView; now: number }) {
  const scores = liveScores(s, now)
  const order = [...room.gamePlayers].sort((x, y) => (s.scores[y] ?? 0) - (s.scores[x] ?? 0))
  return (
    <div className="grid w-full max-w-4xl gap-3">
      {order.map((id, i) => {
        const g = s.cur.gains[id]
        return (
          <div key={id} className="bf-file bf-rise flex items-center gap-5 px-6 py-3" style={{ animationDelay: `${i * 90}ms` }}>
            <span className="bf-stencil w-8 text-3xl text-[#9C7F45]">{i + 1}</span>
            <Avatar name={nameOf(room, id)} color={colorOf(room, id)} size={44} />
            <span className="min-w-0 flex-1 truncate text-3xl font-bold">{nameOf(room, id)}</span>
            {g && g.net !== 0 && <span className={cx('bf-stencil text-2xl', g.net > 0 ? 'text-[#1F9D5C]' : 'text-[#D7263D]')}>{g.net > 0 ? '+' : ''}{g.net}</span>}
            <span className="bf-stencil w-28 text-right text-4xl tabular">{scores[id] ?? 0}</span>
          </div>
        )
      })}
    </div>
  )
}

function Skipped({ s, room }: { s: LieState; room: RoomView }) {
  const subject = s.cur.item.subject ?? ''
  return (
    <div className="grid justify-items-center gap-6">
      <CaseFile s={s} room={room}>
        <div className="absolute -bottom-7 right-10"><Stamp text="No comment" size={48} rot={-8} /></div>
      </CaseFile>
      <div className="bf-rise bf-type text-3xl text-[#BCC7BC]">{nameOf(room, subject)} pleaded the fifth. No points.</div>
    </div>
  )
}

/** The awards at the end: most fooled, most fooled-by, most truths found. */
export function verdictAwards(s: LieState, room: RoomView) {
  const ids = room.gamePlayers
  const top = (f: (id: string) => number) => {
    const best = Math.max(0, ...ids.map(f))
    return best > 0 ? { ids: ids.filter((id) => f(id) === best), n: best } : null
  }
  return {
    liar: top((id) => s.stats[id]?.fooled ?? 0),
    mark: top((id) => s.stats[id]?.fell ?? 0),
    seeker: top((id) => s.stats[id]?.truths ?? 0),
  }
}

function Final({ s, room, compact }: { s: LieState; room: RoomView; compact?: boolean }) {
  const order = [...room.gamePlayers].sort((x, y) => (s.scores[y] ?? 0) - (s.scores[x] ?? 0))
  const best = s.scores[order[0]] ?? 0
  const winners = order.filter((id) => (s.scores[id] ?? 0) === best)
  const aw = verdictAwards(s, room)
  const cards: { title: string; who: { ids: string[]; n: number } | null; note: (n: number) => string }[] = [
    { title: 'Best liar', who: aw.liar, note: (n) => `Fooled people ${n} ${n === 1 ? 'time' : 'times'}` },
    { title: 'Easiest mark', who: aw.mark, note: (n) => `Fell for ${n} ${n === 1 ? 'lie' : 'lies'}` },
    { title: 'Truth seeker', who: aw.seeker, note: (n) => `Found the truth ${n} ${n === 1 ? 'time' : 'times'}` },
  ]
  return (
    <div className={cx('grid w-full justify-items-center text-center', compact ? 'gap-2' : 'gap-6')}>
      <div className={cx('bf-type text-[#BCC7BC]', compact ? 'text-sm' : 'text-2xl')}>Polly's verdict</div>
      <div className="relative">
        <div className={cx('bf-stencil leading-none text-[#F1EBDC] [text-shadow:4px_4px_0_#050909]', compact ? 'text-3xl' : 'text-7xl')}>{joinNames(winners.map((id) => nameOf(room, id)))}</div>
        {!compact && <div className="absolute -right-24 -top-6"><Stamp text={winners.length > 1 ? 'Tied' : 'Wins'} size={44} rot={12} /></div>}
      </div>
      <div className={cx('bf-type text-[#BCC7BC]', compact ? 'text-sm' : 'text-2xl')}>{best} points</div>
      <div className={cx('grid w-full text-left', compact ? 'gap-2' : 'max-w-5xl grid-cols-3 gap-6')}>
        {cards.map((c, i) => (
          <div key={c.title} className={cx('bf-file bf-slide', compact ? 'px-3 py-2' : 'px-6 pb-5 pt-7')} data-tab={compact ? undefined : c.title} style={{ animationDelay: `${300 + i * 220}ms` }}>
            {compact && <div className="bf-type text-xs uppercase">{c.title}</div>}
            <div className={cx('bf-stencil leading-tight', compact ? 'text-lg' : 'text-3xl')}>{c.who ? joinNames(c.who.ids.map((id) => nameOf(room, id))) : 'Nobody'}</div>
            <div className={cx('bf-type', compact ? 'text-xs' : 'mt-1 text-lg')}>{c.who ? c.note(c.who.n) : 'Clean record'}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------- what Polly says ----------------

function pollySays(s: LieState, room: RoomView, el: number): { text: string; mood: HostMood } {
  const subject = s.cur.item.subject
  const sname = subject ? nameOf(room, subject) : ''
  if (s.stage === 'category') return { text: line(POLLY.category, s.round), mood: 'talk' }
  if (s.stage === 'lie') {
    if (subject && el < SPLASH_MS + 3_500) return { text: POLLY.aboutIntro(sname), mood: 'talk' }
    if (!waitingOn(s, room).length) return { text: POLLY.allIn, mood: 'cheer' }
    const k = Math.floor(el / 9_000)
    return { text: line(subject ? POLLY.aboutWriting(sname) : POLLY.writing, s.round + k), mood: subject ? 'nervous' : 'idle' }
  }
  if (s.stage === 'pick') return { text: line(subject ? POLLY.aboutPick(sname) : POLLY.pick, s.round + Math.floor(el / 10_000)), mood: subject ? 'nervous' : 'idle' }
  if (s.stage === 'reveal') {
    if (s.cur.skipped) return { text: POLLY.skipped(sname), mood: 'smug' }
    const step = s.cur.steps[s.cur.step]
    const a = step?.answerId ? s.cur.answers.find((x) => x.id === step.answerId) : undefined
    if (step?.kind === 'lie' && a) {
      if (el < BEAT_NEEDLE_MS) return { text: line(POLLY.lieHeld, s.round + s.cur.step), mood: 'idle' }
      if (el < BEAT_FLIP_MS) return { text: 'Hold still...', mood: 'nervous' }
      return a.house ? { text: line(POLLY.house, s.round), mood: 'smug' } : { text: POLLY.lieOut(joinNames(a.by.map((id) => nameOf(room, id)))), mood: 'shock' }
    }
    if (step?.kind === 'truth' && a) {
      if (el < BEAT_TRUTH_MS) return { text: POLLY.truthWait, mood: 'nervous' }
      const found = pickersOf(s.cur, a.id).length > 0
      if (subject) return { text: found ? POLLY.aboutFound(sname) : POLLY.aboutNobody(sname), mood: found ? 'cheer' : 'smug' }
      return { text: line(found ? POLLY.truthFound : POLLY.nobody, s.round), mood: found ? 'cheer' : 'smug' }
    }
    return { text: line(POLLY.tally, s.round), mood: 'talk' }
  }
  const order = [...room.gamePlayers].sort((x, y) => (s.scores[y] ?? 0) - (s.scores[x] ?? 0))
  return { text: POLLY.verdict(nameOf(room, order[0] ?? '')), mood: 'cheer' }
}

// ---------------- the screen ----------------

function Main({ s, room, now }: { s: LieState; room: RoomView; now: () => number }) {
  const el = now() - s.stageStartedAt
  if (s.stage === 'category') return <Category s={s} room={room} />
  if (s.stage === 'lie') {
    const subject = s.cur.item.subject
    return (
      <div className="grid w-full justify-items-center gap-8">
        <CaseFile s={s} room={room} />
        <div className="bf-type text-2xl text-[#BCC7BC]">{subject ? `${nameOf(room, subject)}: tell the truth. Everyone else: lie about ${nameOf(room, subject)}.` : 'Fill the blank with a lie on your phone.'}</div>
      </div>
    )
  }
  if (s.stage === 'pick') {
    return (
      <div className="grid w-full justify-items-center gap-6">
        <div className="bf-type max-w-5xl text-center text-2xl text-[#BCC7BC]">{s.cur.item.prompt.replace('____', '_____')}</div>
        <Exhibits s={s} />
      </div>
    )
  }
  if (s.stage === 'reveal') {
    if (s.cur.skipped) return <Skipped s={s} room={room} />
    const step = s.cur.steps[s.cur.step]
    const a = step?.answerId ? s.cur.answers.find((x) => x.id === step.answerId) : undefined
    if (step?.kind === 'lie' && a) return <RevealLie key={a.id} s={s} room={room} a={a} el={el} />
    if (step?.kind === 'truth' && a) return <RevealTruth s={s} room={room} a={a} el={el} />
    return <Tally s={s} room={room} now={now()} />
  }
  return <Final s={s} room={room} />
}

function Backdrop() {
  return (
    <>
      <div className="bf-mirror" aria-hidden />
      <div className="bf-lamp" aria-hidden />
      <svg className="bf-shade" viewBox="0 0 120 34" aria-hidden>
        <rect x="58" y="0" width="4" height="10" fill="#050909" />
        <path d="M30 32 L44 10 H76 L90 32 Z" fill="#1E2A28" stroke="#050909" strokeWidth="3" />
        <ellipse cx="60" cy="32" rx="16" ry="3" fill="#FFE2A6" />
      </svg>
    </>
  )
}

export default function BluffStage({ state: s, room, now, compact }: StageProps<LieState>) {
  useThemeFonts(T)
  useTicker(100)
  useBluffSound(s, now)
  if (compact) return <Compact s={s} room={room} now={now} />
  const el = now() - s.stageStartedAt
  const says = pollySays(s, room, el)
  // A title card opens every case as the writing starts (after the category pick, so it never hides the choices).
  const showSplash = el < SPLASH_MS && s.stage === 'lie'
  const chartH = Math.min(132, 40 * room.gamePlayers.length)
  return (
    <div className="lie-bluff lie-root bf-room flex h-full min-h-[600px] flex-col">
      <Backdrop />
      <TopBar s={s} room={room} now={now} />
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-10 pb-[104px] pt-12">
        <Main s={s} room={room} now={now} />
      </div>
      <div className="pointer-events-none absolute left-6 z-10" style={{ bottom: chartH - 8 }}>
        <Polly text={says.text} mood={says.mood} />
      </div>
      <Chart s={s} room={room} now={now} height={chartH} />
      {showSplash && <Splash s={s} room={room} />}
    </div>
  )
}

// ---------------- compact (apart: a phone, above the controls) ----------------

function Compact({ s, room, now }: { s: LieState; room: RoomView; now: () => number }) {
  const el = now() - s.stageStartedAt
  const step = s.stage === 'reveal' ? s.cur.steps[s.cur.step] : undefined
  const a = step?.answerId ? s.cur.answers.find((x) => x.id === step.answerId) : undefined
  const left = Math.max(0, Math.ceil((s.endsAt - now()) / 1000))
  const timed = s.stage === 'category' || s.stage === 'lie' || s.stage === 'pick'
  return (
    <div className="lie-bluff lie-root bf-room grid gap-2 rounded-2xl p-3">
      <div className="flex items-center gap-2">
        <span className="bf-stencil text-xl text-[#E5484D]">BLUFF</span>
        <span className="bf-type text-sm text-[#BCC7BC]">{s.stage === 'final' || s.stage === 'done' ? 'Case closed' : caseTab(s)}</span>
        <div className="flex-1" />
        {timed && <span className={cx('bf-stencil text-xl tabular', left <= 5 ? 'text-[#FF5A5F]' : 'text-[#F1EBDC]')}>{left}</span>}
      </div>
      {s.stage === 'final' || s.stage === 'done' ? (
        <Final s={s} room={room} compact />
      ) : s.stage === 'category' ? (
        <div className="bf-type text-[#BCC7BC]">{nameOf(room, s.choose?.by ?? '')} picks the topic.</div>
      ) : s.cur.skipped ? (
        <div className="bf-type text-[#BCC7BC]">{nameOf(room, s.cur.item.subject ?? '')} pleaded the fifth.</div>
      ) : step?.kind === 'lie' && a ? (
        <div className="bf-tag py-2 pl-9 pr-3">
          <div className="bf-type text-base leading-snug">{a.text}</div>
          {el >= BEAT_FLIP_MS && <div className="bf-type mt-1 text-sm"><Stamp text={a.house ? 'House lie' : 'Lie'} size={14} rot={-6} /> {a.house ? 'Polly' : joinNames(a.by.map((id) => nameOf(room, id)))}</div>}
        </div>
      ) : step?.kind === 'truth' && a ? (
        <div className="bf-file px-3 py-2"><Prompt item={s.cur.item} kind="blank" size="sm" fill={el >= BEAT_TRUTH_MS ? a.text : undefined} truth className="bf-type !font-normal" /></div>
      ) : step?.kind === 'tally' ? (
        <div className="bf-type text-sm text-[#BCC7BC]">{room.gamePlayers.map((id) => `${nameOf(room, id)} ${s.scores[id] ?? 0}`).join('  /  ')}</div>
      ) : (
        <div className="bf-file px-3 py-2"><Prompt item={s.cur.item} kind="blank" size="sm" className="bf-type !font-normal" /></div>
      )}
    </div>
  )
}
