import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import type { RoomView, StageProps } from '../../engine/types'
import { useTicker } from '../../engine/context'
import { Avatar, cx } from '../../ui/kit'
import { BEAT_FLIP_MS, BEAT_PICKERS_MS, FOOL_POINTS, HOUSE_PENALTY, TRUTH_POINTS, pickersOf, type Answer, type LieState } from './logic'
import { Prompt } from './Prompt'
import { Heart, HeartRow } from './Heart'
import { HostArt } from './hosts'
import { cue, useCue, useSting, type StingId } from './audio'
import { line, themeFor, useThemeFonts, type HostMood, type LieTheme } from './theme'
import { colorOf, joinNames, nameOf, playerOf, waitingOn, type LieView } from './view'
import './lie.css'

type Props = StageProps<LieState> & { view: LieView }

/** When the needle starts going wild before a lie is stamped. */
const BEAT_NEEDLE_MS = 1_700
/** In the truth step: the drumroll, then the stamp. */
const BEAT_TRUTH_MS = 1_350
/** The round title card at the top of each question. */
const SPLASH_MS = 2_400
/** The tally counts scores up over this long. */
const COUNT_MS = 1_400

// ---------------- little pieces ----------------

function ease(x: number) {
  const t = Math.max(0, Math.min(1, x))
  return 1 - Math.pow(1 - t, 3)
}

function roman(n: number) {
  return ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n - 1] ?? String(n)
}

function factorText(s: LieState) {
  const last = s.round === s.items.length - 1
  if (last && s.cur.factor === 3) return 'Final question. Triple points'
  if (s.cur.factor === 3) return 'Triple points'
  if (s.cur.factor === 2) return 'Double points'
  return ''
}

/** Scores to show now: last round's until the tally, then counting up to this round's. */
function liveScores(s: LieState, now: number): Record<string, number> {
  if (s.stage !== 'reveal') return s.scores
  const step = s.cur.steps[s.cur.step]
  if (step?.kind !== 'tally') return s.before
  const k = ease((now - s.stageStartedAt) / COUNT_MS)
  const out: Record<string, number> = {}
  for (const id of Object.keys(s.scores)) out[id] = Math.round((s.before[id] ?? 0) + ((s.scores[id] ?? 0) - (s.before[id] ?? 0)) * k)
  return out
}

/** Play a sting `at` ms into the current stage, once per `key`. */
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

function useLieSound(s: LieState, t: LieTheme, now: () => number) {
  const stage = s.stage
  useCue(stage === 'lie' ? t.cues.lie : stage === 'pick' ? t.cues.pick : stage === 'reveal' ? t.cues.reveal : t.cues.final)
  useSting('splash', stage === 'lie' ? `r${s.round}` : null)
  const count = stage === 'lie' ? Object.keys(s.cur.lies).length : stage === 'pick' ? Object.keys(s.cur.picks).length : 0
  useSting('lock', count > 0 ? `${stage}-${s.round}-${count}` : null)
  const step = stage === 'reveal' ? s.cur.steps[s.cur.step] : undefined
  const key = step ? `${s.round}-${s.cur.step}` : null
  const a = step?.answerId ? s.cur.answers.find((x) => x.id === step.answerId) : undefined
  useBeat(t.id === 'word' ? 'page' : null, step?.kind === 'lie' ? key : null, 0, s.stageStartedAt, now)
  useBeat(t.id === 'bluff' ? 'needle' : 'quill', step?.kind === 'lie' ? key : null, BEAT_NEEDLE_MS, s.stageStartedAt, now)
  useBeat('stamp', step?.kind === 'lie' ? key : null, BEAT_FLIP_MS, s.stageStartedAt, now)
  useBeat(a?.house ? 'buzz' : null, step?.kind === 'lie' ? key : null, BEAT_FLIP_MS + 120, s.stageStartedAt, now)
  useBeat('drumroll', step?.kind === 'truth' ? key : null, 0, s.stageStartedAt, now)
  const found = a?.truth ? pickersOf(s.cur, a.id).length > 0 : false
  useBeat(found ? 'truth' : 'nobody', step?.kind === 'truth' ? key : null, BEAT_TRUTH_MS, s.stageStartedAt, now)
  useBeat('tally', step?.kind === 'tally' ? key : null, 200, s.stageStartedAt, now)
  const hearts = Object.values(s.cur.likes).reduce((n, l) => n + l.length, 0)
  const last = useRef(hearts)
  useEffect(() => {
    if (hearts > last.current) cue.sting('heart')
    last.current = hearts
  }, [hearts])
  useSting('win', stage === 'final' ? 'final' : null)
}

function Who({ room, id, size = 40, className, nameClass }: { room: RoomView; id: string; size?: number; className?: string; nameClass?: string }) {
  const p = playerOf(room, id)
  return (
    <span className={cx('inline-flex min-w-0 items-center gap-2', className)}>
      <Avatar name={p?.name ?? id} color={p?.color ?? '#8790B6'} size={size} />
      <span className={cx('truncate font-bold', nameClass)}>{p?.name ?? id}</span>
    </span>
  )
}

function Dial({ s, now, size = 64 }: { s: LieState; now: () => number; size?: number }) {
  const left = Math.max(0, s.endsAt - now())
  const frac = s.stageTotal > 0 ? Math.min(1, left / s.stageTotal) : 0
  const secs = Math.ceil(left / 1000)
  const r = 26
  const c = 2 * Math.PI * r
  const urgent = secs <= 5
  return (
    <div className={cx('relative grid shrink-0 place-items-center', urgent && 'l-jitter')} style={{ width: size, height: size }} aria-label={`${secs} seconds left`}>
      <svg viewBox="0 0 64 64" width={size} height={size} className="absolute inset-0 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="7" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={urgent ? 'var(--l-bad)' : 'var(--l-accent)'} strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} style={{ transition: 'stroke-dashoffset 120ms linear' }} />
      </svg>
      <span className={cx('l-display relative tabular leading-none', urgent && 'l-bad')} style={{ fontSize: size * 0.36 }}>{secs}</span>
    </div>
  )
}

function Stamp({ text, truth, size, rot = -12, className, style }: { text: string; truth?: boolean; size: number; rot?: number; className?: string; style?: CSSProperties }) {
  return (
    <span className={cx('l-stamp inline-block', truth && 'l-truth', className)} style={{ fontSize: size, ['--l-rot' as string]: `${rot}deg`, ...style }}>
      {text}
    </span>
  )
}

const CONFETTI = ['#FFC83D', '#FF3DA5', '#3DE0FF', '#3CEB8A', '#FFF6E8', '#B67CFF']
const CONFETTI_WORD = ['#B8862B', '#8E2A2A', '#2E6B3A', '#F4EAD3', '#D9B76A']
function Confetti({ theme, n = 44 }: { theme: LieTheme; n?: number }) {
  const colors = theme.id === 'word' ? CONFETTI_WORD : CONFETTI
  return (
    <div className="l-confetti" aria-hidden>
      {Array.from({ length: n }, (_, i) => (
        <i
          key={i}
          style={{
            left: `${(i * 37) % 100}%`,
            background: colors[i % colors.length],
            animationDelay: `${(i % 9) * 60}ms`,
            animationDuration: `${2000 + ((i * 131) % 1200)}ms`,
            width: theme.id === 'word' ? 8 : 10,
            height: theme.id === 'word' ? 8 : 16,
            borderRadius: theme.id === 'word' ? 999 : 2,
          }}
        />
      ))}
    </div>
  )
}

// ---------------- what the host says and how it looks ----------------

function hostSays(s: LieState, room: RoomView, t: LieTheme, now: number): { text: string; mood: HostMood; key: string } {
  const el = now - s.stageStartedAt
  const L = t.lines
  if (s.stage === 'lie') {
    if (el < SPLASH_MS + 2_600) return { text: L.intro(s.round, s.items.length, s.cur.factor), mood: 'talk', key: `intro${s.round}` }
    const left = waitingOn(s, room).length
    if (!left) return { text: L.allIn, mood: 'cheer', key: `in${s.round}` }
    const k = Math.floor(el / 9_000)
    return { text: line(L.writing, s.round + k), mood: 'idle', key: `w${s.round}-${k}` }
  }
  if (s.stage === 'pick') {
    const k = Math.floor(el / 10_000)
    return { text: line(L.pick, s.round + k), mood: 'nervous', key: `p${s.round}-${k}` }
  }
  if (s.stage === 'reveal') {
    const step = s.cur.steps[s.cur.step]
    const a = step?.answerId ? s.cur.answers.find((x) => x.id === step.answerId) : undefined
    const key = `${s.round}-${s.cur.step}`
    if (step?.kind === 'lie' && a) {
      if (el < BEAT_NEEDLE_MS) return { text: line(L.lieHeld, s.cur.step + s.round), mood: 'talk', key: `${key}a` }
      if (el < BEAT_FLIP_MS) return { text: t.id === 'bluff' ? 'Running it now...' : 'Consulting the archive...', mood: 'shock', key: `${key}b` }
      if (a.by.length) return { text: L.lieOut(joinNames(a.by.map((id) => nameOf(room, id)))), mood: 'smug', key: `${key}c` }
      return { text: line(L.house, s.round), mood: 'cheer', key: `${key}c` }
    }
    if (step?.kind === 'truth') {
      if (el < BEAT_TRUTH_MS) return { text: L.truthWait, mood: 'nervous', key: `${key}a` }
      const found = a ? pickersOf(s.cur, a.id).length > 0 : false
      return { text: line(found ? L.truthFound : L.nobody, s.round), mood: found ? 'shock' : 'smug', key: `${key}b` }
    }
    return { text: line(L.tally, s.round), mood: 'talk', key: `${key}t` }
  }
  const top = [...room.gamePlayers].sort((x, y) => (s.scores[y] ?? 0) - (s.scores[x] ?? 0))[0]
  return { text: L.final(top ? nameOf(room, top) : 'Someone'), mood: 'cheer', key: 'final' }
}

function Host({ s, room, t, now, size = 150, bubble = true, bubbleClass }: { s: LieState; room: RoomView; t: LieTheme; now: number; size?: number; bubble?: boolean; bubbleClass?: string }) {
  const say = hostSays(s, room, t, now)
  return (
    <div className="flex min-w-0 items-end gap-4">
      <div className="shrink-0"><HostArt theme={t.id} mood={say.mood} size={size} /></div>
      {bubble && (
        <div key={say.key} className={cx('l-bubble mb-6 min-w-0', bubbleClass)}>
          {say.text}
        </div>
      )}
    </div>
  )
}

// ---------------- backdrop ----------------

function Backdrop({ t, compact }: { t: LieTheme; compact?: boolean }) {
  if (t.id === 'bluff') {
    return (
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="l-spot l-spot-l" />
        <div className="l-spot l-spot-r" />
        <div className="l-floor" />
        <div className={cx('l-bulbs', compact ? 'top-1' : 'top-1.5')}>{Array.from({ length: compact ? 16 : 48 }, (_, i) => <span key={i} className={cx('l-bulb', compact && '!h-1.5 !w-1.5')} />)}</div>
      </div>
    )
  }
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="l-desk-grain" />
      <div className="l-lamp" />
    </div>
  )
}

// ---------------- the top bar ----------------

function TopBar({ s, now, t }: { s: LieState; now: () => number; t: LieTheme }) {
  const timed = s.stage === 'lie' || s.stage === 'pick'
  const factor = s.stage === 'final' || s.stage === 'done' ? '' : factorText(s)
  const stageName = s.stage === 'lie' ? (t.id === 'bluff' ? 'Write a lie' : 'Write a definition') : s.stage === 'pick' ? (t.id === 'bluff' ? 'Find the truth' : 'Find the real one') : s.stage === 'reveal' ? 'The reveal' : 'Final'
  return (
    <div className="relative flex min-h-16 items-center gap-4">
      <div className={cx('l-logo leading-none', t.id === 'bluff' ? 'text-[2.6rem] text-[#FFC83D]' : 'text-[2.4rem] font-black italic text-[#F4EAD3]')}>{t.title}</div>
      {s.stage !== 'final' && s.stage !== 'done' && (
        <span className="l-pill text-lg">
          {t.id === 'word' ? `Entry ${roman(s.round + 1)} of ${roman(s.items.length)}` : `Question ${s.round + 1} of ${s.items.length}`}
        </span>
      )}
      <span className={cx('text-lg font-bold', t.id === 'word' ? 'text-[#E8D9B8]' : 'l-ink-2')}>{stageName}</span>
      {factor && <span className="l-factor text-lg">{factor}</span>}
      <div className="flex-1" />
      {timed && <div className={t.id === 'word' ? 'text-[#F4EAD3]' : 'l-ink'}><Dial s={s} now={now} /></div>}
    </div>
  )
}

// ---------------- the players ----------------

function Contestants({ s, room, t, now }: { s: LieState; room: RoomView; t: LieTheme; now: number }) {
  const ids = room.gamePlayers
  const many = ids.length > 4
  const shown = liveScores(s, now)
  const waiting = waitingOn(s, room)
  const busy = s.stage === 'lie' || s.stage === 'pick'
  const step = s.stage === 'reveal' ? s.cur.steps[s.cur.step] : undefined
  const el = now - s.stageStartedAt
  const a = step?.answerId ? s.cur.answers.find((x) => x.id === step.answerId) : undefined
  const pickers = a && el >= BEAT_PICKERS_MS ? pickersOf(s.cur, a.id) : []
  const authors = a && step?.kind === 'lie' && el >= BEAT_FLIP_MS ? a.by : []
  const finders = a && step?.kind === 'truth' && el >= BEAT_TRUTH_MS ? pickersOf(s.cur, a.id) : []
  const tally = step?.kind === 'tally'
  const top = Math.max(...ids.map((id) => s.scores[id] ?? 0))
  const final = s.stage === 'final' || s.stage === 'done'
  return (
    <div className={cx('flex min-w-0 flex-1 items-end justify-end', many ? 'gap-2' : 'gap-4')}>
      {ids.map((id) => {
        const p = playerOf(room, id)
        const on = busy && !waiting.includes(id)
        const net = s.cur.gains[id]?.net ?? 0
        const up = authors.includes(id) || finders.includes(id) || (final && (s.scores[id] ?? 0) === top)
        const status = busy ? (on ? (s.stage === 'lie' ? 'Locked in' : 'Picked') : (s.stage === 'lie' ? 'Writing' : 'Thinking')) : ''
        return (
          <div
            key={id}
            className={cx('l-podium min-w-0 flex-1', many ? 'max-w-40 px-2 pb-2 pt-2' : 'max-w-56 px-3 pb-3 pt-3', (on || up) && 'l-on', up && 'l-up')}
            style={{ ['--l-c' as string]: p?.color ?? '#888' }}
          >
            {tally && net !== 0 && (
              <span key={`d${s.round}`} className={cx('l-drop absolute -top-9 rounded-full px-3 py-0.5 font-mono text-lg font-bold tabular', net > 0 ? 'bg-[var(--l-good)] text-[#06210F]' : 'bg-[var(--l-bad)] text-white')}>
                {net > 0 ? '+' : ''}{net}
              </span>
            )}
            {pickers.includes(id) && step?.kind === 'lie' && (
              <span key={`f${s.round}-${s.cur.step}`} className="l-drop absolute -top-8 rounded-full bg-[var(--l-bad)] px-2.5 py-0.5 text-sm font-bold text-white">Fooled</span>
            )}
            {finders.includes(id) && (
              <span key={`t${s.round}`} className="l-drop absolute -top-8 rounded-full bg-[var(--l-good)] px-2.5 py-0.5 text-sm font-bold text-[#06210F]">Found it</span>
            )}
            <div className="flex w-full min-w-0 items-center gap-2">
              <Avatar name={p?.name ?? id} color={p?.color ?? '#888'} size={many ? 26 : 34} dim={busy && !on} />
              <span className={cx('min-w-0 flex-1 truncate font-bold', many ? 'text-base' : 'text-xl')}>{p?.name ?? id}</span>
              {busy && <span className={cx('l-light', on && 'l-on')} />}
            </div>
            <div className="mt-1.5 flex w-full items-center justify-between gap-2">
              <span className={cx('truncate text-sm', on ? 'font-bold' : 'opacity-70')}>{status}</span>
              <span className={cx('l-scorebox', many ? 'text-lg' : 'text-2xl')}>{shown[id] ?? 0}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------------- the stages ----------------

function Slots({ s, room, t }: { s: LieState; room: RoomView; t: LieTheme }) {
  const ids = room.gamePlayers
  const waiting = waitingOn(s, room)
  if (t.id === 'word') {
    return (
      <div className="grid content-start gap-3">
        <div className="l-label">Entries received</div>
        {ids.map((id) => {
          const done = !waiting.includes(id)
          return (
            <div key={id} className="flex items-baseline gap-3 border-b border-dashed border-[#C9B48C] pb-1.5">
              <span className="w-28 shrink-0 truncate text-lg italic l-ink-3 l-entry">{nameOf(room, id)}</span>
              {done ? (
                <span key="d" className="l-sign l-drop text-3xl leading-none" style={{ color: colorOf(room, id) }}>{nameOf(room, id)}</span>
              ) : (
                <span className="l-ink-3 text-lg italic l-entry">awaiting signature</span>
              )}
            </div>
          )
        })}
      </div>
    )
  }
  return (
    <div className="flex flex-wrap items-center justify-center gap-4">
      {ids.map((id) => {
        const done = !waiting.includes(id)
        return (
          <div key={id} className={cx('l-tile grid h-24 w-44 place-items-center px-3', done && 'l-tile-lit')}>
            {done ? (
              <span key="d" className="l-drop grid justify-items-center gap-1">
                <span className="l-display text-2xl text-[var(--l-accent)]">Locked</span>
                <span className="text-base font-bold">{nameOf(room, id)}</span>
              </span>
            ) : (
              <span className="grid justify-items-center gap-1 opacity-60">
                <span className="l-display text-2xl">. . .</span>
                <span className="text-base font-bold">{nameOf(room, id)}</span>
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

const SIZES = ['text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl']
function answerSize(n: number, kind: LieView['kind'], len: number) {
  let i = kind === 'word' ? (n <= 5 ? 3 : n <= 7 ? 2 : 1) : (n <= 5 ? 4 : n <= 7 ? 3 : 2)
  if (len > (kind === 'word' ? 60 : 40)) i -= 1
  return SIZES[Math.max(0, i)]
}

function PickGrid({ s, view, t }: { s: LieState; view: LieView; t: LieTheme }) {
  const n = s.cur.answers.length
  const picked = new Set(Object.values(s.cur.picks))
  void picked
  if (t.id === 'word') {
    return (
      <div className={cx('grid content-start gap-x-6', n > 5 ? 'grid-cols-2 gap-y-2' : 'gap-y-3')}>
        {s.cur.answers.map((a, i) => (
          <div key={a.id} className="l-deal flex items-baseline gap-3" style={{ animationDelay: `${i * 90}ms` }}>
            <span className={cx('l-num', n > 5 ? 'text-2xl' : 'text-3xl')}>{i + 1}.</span>
            <span className={cx('l-entry min-w-0 leading-snug [overflow-wrap:anywhere]', n > 5 ? 'text-lg' : answerSize(n, 'word', a.text.length))}>{a.text}</span>
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className="grid h-full min-h-0 auto-rows-fr grid-cols-2 gap-3">
      {s.cur.answers.map((a, i) => (
        <div key={a.id} className="l-tile l-deal flex min-h-0 items-center gap-4 overflow-hidden px-4 py-2" style={{ animationDelay: `${i * 80}ms` }}>
          <span className="l-num h-12 w-12 text-2xl">{i + 1}</span>
          <span className={cx('min-w-0 font-bold leading-tight [overflow-wrap:anywhere]', answerSize(n, view.kind, a.text.length))}>{a.text}</span>
        </div>
      ))}
    </div>
  )
}

function authorPoints(s: LieState, a: Answer, author: string) {
  const fooled = pickersOf(s.cur, a.id).filter((x) => x !== author).length
  return fooled * FOOL_POINTS * s.cur.factor * (a.copout.includes(author) ? 0.5 : 1)
}

function RevealLie({ s, room, a, t, el }: { s: LieState; room: RoomView; a: Answer; t: LieTheme; el: number }) {
  const pickers = pickersOf(s.cur, a.id)
  const flipped = el >= BEAT_FLIP_MS
  const n = s.cur.answers.findIndex((x) => x.id === a.id) + 1
  const word = t.id === 'word'
  return (
    <div className="relative grid w-full content-center justify-items-center gap-5">
      <div key={`${s.round}-${s.cur.step}`} className={cx('l-zoom relative w-full', word ? 'max-w-none' : 'max-w-4xl')}>
        <div className={cx(flipped && 'l-shake')}>
          <div className={cx(word ? 'grid gap-2 px-2 py-2' : 'l-tile l-tile-lit grid gap-3 px-8 py-7')}>
            <div className="flex items-center justify-between gap-4">
              <span className="l-label">{word ? `Definition ${n}` : `Answer ${n}`}</span>
              <HeartRow likers={s.cur.likes[a.id] ?? []} colorOf={(id) => colorOf(room, id)} size={24} />
            </div>
            <div className={cx('leading-tight [overflow-wrap:anywhere]', word ? 'l-entry text-4xl italic' : 'text-5xl font-bold')}>{a.text}</div>
            <div className="min-h-16">
              {flipped ? (
                a.by.length ? (
                  <div className="l-slide-up flex flex-wrap items-center gap-x-8 gap-y-2">
                    <span className={cx('text-xl', word ? 'l-entry italic l-ink-3' : 'l-ink-3')}>{word ? 'Forged by' : 'Written by'}</span>
                    {a.by.map((id) => (
                      <span key={id} className="flex items-center gap-3">
                        {word
                          ? <span className="l-sign text-5xl leading-none" style={{ color: colorOf(room, id) }}>{nameOf(room, id)}</span>
                          : <Who room={room} id={id} size={48} nameClass="text-3xl" />}
                        <span className="font-mono text-2xl font-bold tabular l-good">+{authorPoints(s, a, id)}</span>
                        {a.copout.includes(id) && <span className="rounded-full border border-current px-2 py-0.5 text-sm l-ink-3">Lie for me: half points</span>}
                      </span>
                    ))}
                    {a.house && <span className="text-xl l-ink-3">(the House wrote it too)</span>}
                  </div>
                ) : (
                  <div className="l-slide-up flex flex-wrap items-baseline gap-4">
                    <span className="l-display text-4xl l-bad">The House</span>
                    <span className="text-xl l-ink-2">{word ? 'forged this one.' : 'wrote this one.'} Minus {HOUSE_PENALTY} each.</span>
                  </div>
                )
              ) : (
                <span className={cx('text-2xl', word ? 'l-entry italic l-ink-3' : 'l-ink-3')}>{word ? 'Whose forgery is it?' : 'Who wrote this?'}</span>
              )}
            </div>
          </div>
        </div>
        {flipped && (
          <div className={cx('pointer-events-none absolute z-10', word ? '-bottom-2 right-0' : '-right-2 -top-6')}>
            <Stamp text={a.by.length ? t.stampLie : t.stampHouse} size={word ? 44 : 64} rot={word ? -7 : -11} />
          </div>
        )}
      </div>
      <div className="flex min-h-14 flex-wrap items-center justify-center gap-x-5 gap-y-2">
        {el >= BEAT_PICKERS_MS && (
          <>
            <span className={cx('text-2xl', word ? 'l-entry italic l-ink-2' : 'l-ink-2')}>Fell for it:</span>
            {pickers.map((id, i) => (
              <span key={id} className="l-drop" style={{ animationDelay: `${i * 120}ms` }}>
                <Who room={room} id={id} size={44} nameClass="text-2xl" />
              </span>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

function RevealTruth({ s, room, view, t, el }: { s: LieState; room: RoomView; view: LieView; t: LieTheme; el: number }) {
  const a = s.cur.answers.find((x) => x.truth)
  const finders = a ? pickersOf(s.cur, a.id) : []
  const open = el >= BEAT_TRUTH_MS
  const word = t.id === 'word'
  if (!open) {
    return (
      <div className="grid w-full place-items-center gap-4">
        <div className={cx('l-display l-jitter', word ? 'text-6xl italic' : 'text-7xl l-accent')}>{word ? 'The genuine article' : 'The truth is'}</div>
        <div className="flex gap-3">{[0, 1, 2].map((i) => <span key={i} className="h-5 w-5 rounded-full bg-current opacity-70 l-glow-pulse" style={{ animationDelay: `${i * 160}ms` }} />)}</div>
      </div>
    )
  }
  return (
    <div className="relative grid w-full content-center justify-items-center gap-5 text-center">
      <div className="relative">
        <div className={cx('l-zoom leading-tight [overflow-wrap:anywhere]', word ? 'l-entry max-w-full text-4xl font-bold' : 'max-w-4xl text-6xl font-bold', view.kind === 'blank' && 'l-accent')}>
          {s.cur.item.truth}
        </div>
        <div className="mt-4 flex justify-center">
          <Stamp text={t.stampTruth} truth size={word ? 46 : 56} rot={-6} />
        </div>
      </div>
      <div className="flex min-h-14 flex-wrap items-center justify-center gap-x-6 gap-y-2 text-2xl">
        {finders.length ? (
          <>
            {finders.map((id, i) => <span key={id} className="l-drop" style={{ animationDelay: `${300 + i * 140}ms` }}><Who room={room} id={id} size={46} nameClass="text-2xl" /></span>)}
            <span className="l-ink-2">found it. +{TRUTH_POINTS * s.cur.factor}</span>
          </>
        ) : (
          <span className="l-ink-2">Nobody found it.</span>
        )}
      </div>
      {s.cur.item.source && <div className="font-mono text-sm l-ink-3">Source: {s.cur.item.source}</div>}
    </div>
  )
}

function Tally({ s, room, t, now }: { s: LieState; room: RoomView; t: LieTheme; now: number }) {
  const order = [...room.gamePlayers].sort((a, b) => (s.scores[b] ?? 0) - (s.scores[a] ?? 0))
  const shown = liveScores(s, now)
  const max = Math.max(1, ...order.map((id) => s.scores[id] ?? 0))
  const lies = s.cur.answers.filter((a) => !a.truth)
  const many = order.length > 4
  const word = t.id === 'word'
  return (
    <div className="grid w-full content-center gap-5">
      <div className={cx('grid', many ? 'gap-1.5' : 'gap-3')}>
        {order.map((id, i) => {
          const g = s.cur.gains[id]
          return (
            <div key={id} className="l-slide-up grid grid-cols-[11rem_minmax(0,1fr)_6rem] items-center gap-4" style={{ animationDelay: `${i * 90}ms` }}>
              <Who room={room} id={id} size={many ? 28 : 38} nameClass={many ? 'text-lg' : 'text-2xl'} />
              <div className={cx('relative overflow-hidden rounded-full', many ? 'h-5' : 'h-8', word ? 'bg-[#E6D8B8]' : 'bg-white/10')}>
                <div className="l-bar" style={{ width: `${(100 * (shown[id] ?? 0)) / max}%`, background: colorOf(room, id) }} />
                <span className="absolute inset-y-0 left-3 flex items-center gap-2 text-sm font-bold text-[#0A0520] mix-blend-normal">
                  {g?.truth ? <span>Found it +{g.truth}</span> : null}
                  {g?.fooled ? <span>Fooled {g.fooledCount} +{g.fooled}</span> : null}
                  {g?.house ? <span>House {g.house}</span> : null}
                  {g?.likes ? <span className="inline-flex items-center gap-1"><Heart size={12} color="#0A0520" />+{g.likes}</span> : null}
                </span>
              </div>
              <span className={cx('text-right tabular', word ? 'l-entry text-3xl font-bold' : 'l-display text-3xl')}>{shown[id] ?? 0}</span>
            </div>
          )
        })}
      </div>
      <div className="grid gap-2">
        <div className="l-label">{word ? 'Every forgery' : 'Every lie'}</div>
        <div className={cx('grid gap-x-6 gap-y-1', lies.length > 3 && 'grid-cols-2')}>
          {lies.map((a) => (
            <div key={a.id} className="flex min-w-0 items-baseline gap-2 text-lg">
              <span className={cx('min-w-0 truncate', word && 'l-entry italic')}>{a.text}</span>
              <span className="shrink-0 l-ink-3">{a.house && !a.by.length ? 'the House' : joinNames(a.by.map((id) => nameOf(room, id)))}</span>
              <HeartRow likers={s.cur.likes[a.id] ?? []} colorOf={(id) => colorOf(room, id)} size={14} className="shrink-0 self-center" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Final({ s, room, t, compact }: { s: LieState; room: RoomView; t: LieTheme; compact?: boolean }) {
  const ids = room.gamePlayers
  const best = (key: 'fooled' | 'truths') => {
    const n = Math.max(0, ...ids.map((id) => s.stats[id]?.[key] ?? 0))
    return n ? { ids: ids.filter((id) => (s.stats[id]?.[key] ?? 0) === n), n } : null
  }
  const liar = best('fooled')
  const finder = best('truths')
  const top = Math.max(...ids.map((id) => s.scores[id] ?? 0))
  const winners = ids.filter((id) => (s.scores[id] ?? 0) === top)
  const word = t.id === 'word'
  const loved = s.best
  return (
    <div className={cx('relative grid w-full content-center justify-items-center text-center', compact ? 'gap-2' : 'gap-5')}>
      {!compact && <Confetti theme={t} n={60} />}
      {!compact && <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 h-[26rem] w-[44rem] -translate-x-1/2 rounded-full" style={{ background: word ? 'radial-gradient(closest-side, rgba(184, 134, 43, 0.22), rgba(184, 134, 43, 0))' : 'radial-gradient(closest-side, rgba(255, 200, 61, 0.28), rgba(255, 200, 61, 0))' }} />}
      {!compact && <div className="l-drop"><Trophy word={word} /></div>}
      <div className={cx('l-label', compact ? '' : 'text-base')}>{word ? 'Honorary lexicographer' : 'Tonight\'s champion'}</div>
      <div className={cx('l-zoom leading-none', word ? 'l-entry font-black italic' : 'l-logo text-[var(--l-accent)]', compact ? 'text-3xl' : 'text-7xl')}>
        {joinNames(winners.map((id) => nameOf(room, id)))}
      </div>
      <div className={cx('l-ink-2', compact ? 'text-sm' : 'text-2xl')}>{top} points</div>
      <div className={cx('grid w-full', compact ? 'gap-2 text-left text-sm' : 'max-w-5xl grid-cols-3 gap-4 text-left')}>
        {liar && (
          <div className={cx(word ? 'l-card' : 'l-tile', compact ? 'p-2.5' : 'p-5')}>
            <div className="l-label">{word ? 'Master forger' : 'Best liar'}</div>
            <div className={cx('mt-1 font-bold', compact ? 'text-base' : 'text-2xl')}>{joinNames(liar.ids.map((id) => nameOf(room, id)))}</div>
            <div className="l-ink-2">fooled people {liar.n} {liar.n === 1 ? 'time' : 'times'}</div>
          </div>
        )}
        {finder && (
          <div className={cx(word ? 'l-card' : 'l-tile', compact ? 'p-2.5' : 'p-5')}>
            <div className="l-label">{word ? 'Scholar' : 'Lie detector'}</div>
            <div className={cx('mt-1 font-bold', compact ? 'text-base' : 'text-2xl')}>{joinNames(finder.ids.map((id) => nameOf(room, id)))}</div>
            <div className="l-ink-2">found the truth {finder.n} {finder.n === 1 ? 'time' : 'times'}</div>
          </div>
        )}
        {loved && (
          <div className={cx(word ? 'l-card' : 'l-tile l-tile-lit', compact ? 'p-2.5' : 'p-5')}>
            <div className="l-label">Most loved {word ? 'forgery' : 'lie'}</div>
            <div className={cx('mt-1 font-bold leading-snug [overflow-wrap:anywhere]', word && 'l-entry italic', compact ? 'text-base' : 'text-xl')}>{loved.text}</div>
            <div className="mt-1 flex items-center gap-1.5 l-ink-2">{nameOf(room, loved.playerId)} <Heart size={compact ? 14 : 18} color="var(--l-hot)" /> {loved.likes}</div>
          </div>
        )}
      </div>
    </div>
  )
}

function Trophy({ word }: { word: boolean }) {
  if (word) {
    // A wax seal with a ribbon.
    return (
      <svg viewBox="0 0 120 120" width="92" height="92" aria-hidden>
        <path d="M44 70 L30 116 L46 106 L56 118 L62 74 Z" fill="#8E2A2A" stroke="#4A1212" strokeWidth="3" strokeLinejoin="round" />
        <path d="M76 70 L90 116 L74 106 L64 118 L58 74 Z" fill="#A3262A" stroke="#4A1212" strokeWidth="3" strokeLinejoin="round" />
        <path d="M60 8 l8 6 10 -2 4 9 10 4 -2 10 6 8 -6 8 2 10 -10 4 -4 9 -10 -2 -8 6 -8 -6 -10 2 -4 -9 -10 -4 2 -10 -6 -8 6 -8 -2 -10 10 -4 4 -9 10 2 Z" fill="#B8862B" stroke="#6E4D12" strokeWidth="3" strokeLinejoin="round" />
        <circle cx="60" cy="46" r="22" fill="none" stroke="#F1D79A" strokeWidth="3" />
        <path d="M50 46 l7 7 14 -15" fill="none" stroke="#F8EAC4" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 120 120" width="96" height="96" aria-hidden>
      <path d="M34 18 H86 V44 C86 62 74 72 60 72 C46 72 34 62 34 44 Z" fill="#FFC83D" stroke="#07031A" strokeWidth="5" strokeLinejoin="round" />
      <path d="M34 26 H18 C18 44 26 52 38 52" fill="none" stroke="#07031A" strokeWidth="5" />
      <path d="M86 26 H102 C102 44 94 52 82 52" fill="none" stroke="#07031A" strokeWidth="5" />
      <path d="M52 72 H68 V88 H52 Z" fill="#FFB21E" stroke="#07031A" strokeWidth="5" />
      <path d="M38 88 H82 V104 H38 Z" fill="#FF3DA5" stroke="#07031A" strokeWidth="5" strokeLinejoin="round" />
      <path d="M46 26 V44" stroke="#FFF1B8" strokeWidth="6" strokeLinecap="round" />
    </svg>
  )
}

// ---------------- TV ----------------

function Splash({ s, t, el }: { s: LieState; t: LieTheme; el: number }) {
  if (s.stage !== 'lie' || el > SPLASH_MS) return null
  const factor = factorText(s)
  const word = t.id === 'word'
  return (
    <div key={`splash${s.round}`} className="l-splash-bg absolute inset-0 z-30 grid place-items-center" style={{ background: word ? 'rgba(30, 18, 10, 0.82)' : 'rgba(10, 5, 32, 0.86)' }}>
      <div className="l-splash grid justify-items-center gap-3 text-center">
        <div className={cx('leading-none', word ? 'l-entry text-5xl italic text-[#E8D9B8]' : 'l-display text-5xl text-[#FF3DA5]')}>{word ? 'Entry' : 'Question'}</div>
        <div className={cx('leading-none', word ? 'l-entry text-[11rem] font-black italic text-[#F4EAD3]' : 'l-logo text-[12rem] text-[#FFC83D]')}>
          {word ? roman(s.round + 1) : s.round + 1}
        </div>
        <div className={cx('l-label text-lg', word && 'text-[#E8D9B8]')}>of {s.items.length}</div>
        {factor && <div className="l-factor text-3xl">{factor}</div>}
      </div>
    </div>
  )
}

function Book({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <div className="l-panel relative grid h-full min-h-0 grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
      <div className="l-gutter" />
      <div className="relative min-h-0 overflow-hidden px-10 py-7">{left}</div>
      <div className="relative min-h-0 overflow-hidden px-10 py-7">{right}</div>
    </div>
  )
}

function Headword({ s, t }: { s: LieState; t: LieTheme }) {
  const item = s.cur.item
  const len = item.prompt.length
  const size = len <= 9 ? 'text-7xl' : len <= 12 ? 'text-6xl' : len <= 15 ? 'text-5xl' : 'text-[2.6rem]'
  return (
    <div className="grid h-full content-between gap-4">
      <div className="grid gap-2">
        <div className="l-label">{t.title}, vol. {roman(s.round + 1)}</div>
        <div key={item.id} className={cx('l-entry l-zoom font-black leading-[1.02] [overflow-wrap:anywhere]', size)}>{item.prompt}</div>
        <div className="l-entry text-2xl italic l-ink-2">{item.pos}</div>
        <div className="mt-2 h-px w-24 bg-[#8E2A2A]" />
      </div>
      <div className="l-entry text-lg italic l-ink-3">A real word. Nobody knows what it means. Except me.</div>
    </div>
  )
}

function Main({ s, room, now, view, t }: { s: LieState; room: RoomView; now: () => number; view: LieView; t: LieTheme }) {
  const el = now() - s.stageStartedAt
  const step = s.stage === 'reveal' ? s.cur.steps[s.cur.step] : undefined
  const a = step?.answerId ? s.cur.answers.find((x) => x.id === step.answerId) : undefined

  let body: ReactNode = null
  if (s.stage === 'lie') body = <Slots s={s} room={room} t={t} />
  else if (s.stage === 'pick') body = <PickGrid s={s} view={view} t={t} />
  else if (step?.kind === 'lie' && a) body = <RevealLie s={s} room={room} a={a} t={t} el={el} />
  else if (step?.kind === 'truth') body = <RevealTruth s={s} room={room} view={view} t={t} el={el} />
  else if (step?.kind === 'tally') body = <Tally s={s} room={room} t={t} now={now()} />
  else body = <Final s={s} room={room} t={t} />
  const confetti = step?.kind === 'truth' && el >= BEAT_TRUTH_MS && a && pickersOf(s.cur, a.id).length > 0

  if (t.id === 'word') {
    if (s.stage === 'final' || s.stage === 'done') {
      return <div className="l-panel relative grid h-full min-h-0 place-items-center overflow-hidden px-10 py-6">{body}</div>
    }
    return (
      <div className="relative h-full min-h-0">
        <Book left={<Headword s={s} t={t} />} right={<div className="grid h-full min-h-0 content-center">{body}</div>} />
        {confetti && <Confetti theme={t} />}
      </div>
    )
  }

  if (s.stage === 'final' || s.stage === 'done') return <div className="relative grid h-full min-h-0 place-items-center">{body}</div>
  const fill = view.kind === 'blank' && step && step.kind !== 'tally' && (step.kind === 'lie' || el >= BEAT_TRUTH_MS) ? a?.text : undefined
  const hero = s.stage === 'lie'
  if (step?.kind === 'tally') {
    return (
      <div className="relative flex h-full min-h-0 flex-col gap-3">
        <div className="l-display text-4xl l-accent">Question {s.round + 1} results</div>
        <div className="grid min-h-0 flex-1">{body}</div>
      </div>
    )
  }
  return (
    <div className="relative flex h-full min-h-0 flex-col gap-4">
      <div className={cx('l-panel', hero ? 'flex-1 content-center px-12 py-8' : 'px-8 py-5', 'grid')}>
        <Prompt item={s.cur.item} kind={view.kind} size={hero ? 'hero' : 'md'} fill={fill} truth={step?.kind === 'truth'} />
      </div>
      <div className={cx('grid min-h-0', hero ? 'shrink-0' : 'flex-1')}>{body}</div>
      {confetti && <Confetti theme={t} />}
    </div>
  )
}

export function LieStageView({ state: s, room, now, compact, view }: Props) {
  useTicker(100)
  const t = themeFor(view.kind, view.theme)
  useThemeFonts(t)
  useLieSound(s, t, now)
  if (compact) return <CompactStage s={s} room={room} now={now} view={view} t={t} />
  const n = now()
  return (
    <div className={cx('lie-root h-full', `lie-${t.id}`)}>
      <Backdrop t={t} />
      <div className="relative grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-3 px-6 pb-2 pt-4">
        <TopBar s={s} now={now} t={t} />
        <Main s={s} room={room} now={now} view={view} t={t} />
        <div className="flex min-h-0 items-end gap-6">
          <div className="w-[30rem] shrink-0">
            <Host s={s} room={room} t={t} now={n} size={t.id === 'bluff' ? 168 : 150} bubbleClass="text-xl" />
          </div>
          <Contestants s={s} room={room} t={t} now={n} />
        </div>
      </div>
      <Splash s={s} t={t} el={n - s.stageStartedAt} />
    </div>
  )
}

// ---------------- compact (apart: a phone, above the controls) ----------------

function CompactStage({ s, room, now, view, t }: { s: LieState; room: RoomView; now: () => number; view: LieView; t: LieTheme }) {
  const n = now()
  const el = n - s.stageStartedAt
  const step = s.stage === 'reveal' ? s.cur.steps[s.cur.step] : undefined
  const a = step?.answerId ? s.cur.answers.find((x) => x.id === step.answerId) : undefined
  const word = t.id === 'word'
  const timed = s.stage === 'lie' || s.stage === 'pick'
  const fill = view.kind === 'blank' && step && step.kind !== 'tally' && (step.kind === 'lie' || el >= BEAT_TRUTH_MS) ? a?.text : undefined
  const say = hostSays(s, room, t, n)
  return (
    <div className={cx('lie-root grid gap-2.5 rounded-2xl p-3', t.id === 'bluff' && 'pt-5', `lie-${t.id}`)}>
      <Backdrop t={t} compact />
      <div className="relative flex items-center gap-2">
        <span className={cx('leading-none', word ? 'l-entry text-xl font-black italic text-[#F4EAD3]' : 'l-logo text-xl text-[#FFC83D]')}>{t.title}</span>
        {s.stage !== 'final' && s.stage !== 'done' && <span className="l-pill text-xs">{s.round + 1} of {s.items.length}</span>}
        {factorText(s) && s.stage !== 'final' && s.stage !== 'done' && <span className="l-factor text-xs">x{s.cur.factor}</span>}
        <div className="flex-1" />
        {timed && <div className={word ? 'text-[#F4EAD3]' : ''}><Dial s={s} now={now} size={40} /></div>}
      </div>
      {s.stage === 'final' || s.stage === 'done' ? (
        <div className={cx('relative', word && 'l-panel p-3')}><Final s={s} room={room} t={t} compact /></div>
      ) : (
        <>
          <div className="relative l-panel px-3 py-2.5">
            {word ? (
              <div className="grid gap-0.5">
                <div className="l-entry text-3xl font-black leading-tight [overflow-wrap:anywhere]">{s.cur.item.prompt}</div>
                <div className="l-entry text-sm italic l-ink-2">{s.cur.item.pos}</div>
              </div>
            ) : (
              <Prompt item={s.cur.item} kind={view.kind} size="sm" fill={fill} truth={step?.kind === 'truth'} />
            )}
          </div>
          {s.stage === 'reveal' && step && (
            <div className="relative">
              {step.kind === 'lie' && a && (
                <div key={`${s.round}-${s.cur.step}`} className={cx('l-zoom relative grid gap-1.5', word ? 'l-card p-3' : 'l-tile l-tile-lit p-3')}>
                  <div className={cx('font-bold leading-snug [overflow-wrap:anywhere]', word && 'l-entry italic')}>{a.text}</div>
                  <div className="flex min-h-6 flex-wrap items-center gap-2 text-sm l-ink-2">
                    {el >= BEAT_PICKERS_MS && <>Fell for it: {pickersOf(s.cur, a.id).map((id) => <Who key={id} room={room} id={id} size={20} />)}</>}
                  </div>
                  <div className="min-h-6 text-sm font-bold">
                    {el >= BEAT_FLIP_MS && (a.by.length ? <span className="l-slide-up inline-block">By {joinNames(a.by.map((id) => nameOf(room, id)))}</span> : <span className="l-slide-up inline-block l-bad">The House. Minus {HOUSE_PENALTY}</span>)}
                  </div>
                  {el >= BEAT_FLIP_MS && <div className="pointer-events-none absolute -top-3 right-1"><Stamp text={a.by.length ? t.stampLie : t.stampHouse} size={22} rot={-10} /></div>}
                </div>
              )}
              {step.kind === 'truth' && (
                el < BEAT_TRUTH_MS
                  ? <div className={cx('l-jitter py-2 text-center text-xl', word ? 'l-entry italic text-[#F4EAD3]' : 'l-display l-accent')}>{t.lines.truthWait}</div>
                  : (
                    <div className={cx('l-zoom grid gap-1.5', word ? 'l-card p-3' : 'l-tile l-tile-lit p-3')}>
                      <div className="flex items-start justify-between gap-2">
                        <div className={cx('font-bold leading-snug [overflow-wrap:anywhere]', word ? 'l-entry' : 'l-accent text-lg')}>{s.cur.item.truth}</div>
                        <Stamp text={t.stampTruth} truth size={18} rot={-6} className="shrink-0" />
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-sm l-ink-2">
                        {pickersOf(s.cur, a?.id ?? '').length ? <>{pickersOf(s.cur, a?.id ?? '').map((id) => <Who key={id} room={room} id={id} size={20} />)} found it</> : 'Nobody found it.'}
                      </div>
                    </div>
                  )
              )}
              {step.kind === 'tally' && (
                <div className="flex flex-wrap gap-2">
                  {room.gamePlayers.map((id) => {
                    const net = s.cur.gains[id]?.net ?? 0
                    return (
                      <span key={id} className={cx('l-drop flex items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-sm', word ? 'bg-[#F4EAD3] text-[#2A1E14]' : 'bg-white/10')}>
                        <Avatar name={nameOf(room, id)} color={colorOf(room, id)} size={22} />
                        <span className={cx('font-mono tabular', net > 0 ? 'l-good' : 'l-ink-3')}>{net > 0 ? '+' : ''}{net}</span>
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
          )}
          {s.stage !== 'reveal' && (
            <div className="relative flex items-center gap-2">
              <HostArt theme={t.id} mood={say.mood} size={44} />
              <div key={say.key} className={cx('l-bubble px-3 py-1.5 text-sm')}>{say.text}</div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
