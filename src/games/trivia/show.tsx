/**
 * Pieces shared by the TV Stage, the apart-mode compact Stage and the phones: the question
 * board, player tokens, what Chip says and does at each moment, and the show's sound.
 */
import { useEffect, useRef, type ReactNode } from 'react'
import type { RoomView } from '../../engine/types'
import { cx } from '../../ui/kit'
import { LETTERS, type LiveQ } from '../_quiz/bank'
import { catLabel } from '../_quiz/categories'
import { quizMusic, useQuizMusic, type QuizTrack } from '../_quiz/music'
import { whoIn } from '../_quiz/who'
import { INK, type ChipMood, type ChipPose } from './host'
import { chipLine, revealLine, type LineKind } from './lines'
import { ANSWER, Bulbs, DISPLAY, TN } from './look'
import { STEAL_ROUND, type TriviaState } from './logic'
import { BUZZ, CHIPS, DING, FANFARE, FINALE, LAND, LOCK, STEAL, TRACKS } from './music'
import { SPIN_ANIM_MS } from './wheelMath'

export const isFinal = (s: TriviaState) => s.round > s.rounds
export const isSteal = (s: TriviaState) => s.round === STEAL_ROUND && !isFinal(s) && s.rounds >= STEAL_ROUND
export const spinKeyOf = (s: TriviaState) => `${s.round}-${s.q}`
export const landedNow = (s: TriviaState, now: () => number) =>
  (s.phase === 'spin' || s.phase === 'finalSpin') && now() - s.phaseAt >= SPIN_ANIM_MS

export function roundRule(s: TriviaState): string {
  if (isSteal(s)) return 'Steal round. Points double. First right answer takes it all, everyone after gets half.'
  if (s.round === s.rounds && s.round !== 1) return 'Everything counts triple. Comebacks happen here.'
  if (s.round === 1) return 'Right answers score 100, plus up to 100 more for speed.'
  return `Points count ${s.round} times over. Be right, be fast.`
}

export function roundTitle(s: TriviaState): string {
  if (isSteal(s)) return 'Steal round'
  if (s.round === s.rounds && s.round !== 1) return 'Triple points'
  if (s.round === 1) return 'Speed pays'
  return `Times ${s.round}`
}

export interface Moment { line: string | null; mood: ChipMood; pose: ChipPose; key: string }

/** What Chip says and does right now. The same on every screen. */
export function chipMoment(s: TriviaState, room: RoomView, now: () => number): Moment {
  const who = whoIn(room)
  const seed = s.asked + s.round * 3 + s.q
  const key = `${s.phase}-${s.round}-${s.q}`
  const say = (kind: LineKind, vars: { name?: string; cat?: string } = {}) => chipLine(kind, seed, vars)
  switch (s.phase) {
    case 'roundIntro': {
      const kind: LineKind = s.round === 1 ? 'open' : isSteal(s) ? 'steal' : s.round === s.rounds ? 'last' : 'round'
      return { line: say(kind), mood: 'grin', pose: s.round === 1 ? 'cheer' : 'point', key }
    }
    case 'pick': {
      const solo = room.gamePlayers.length < 2
      return { line: solo ? say('pickSolo') : say('pick', { name: who(s.picker ?? '').name }), mood: 'wink', pose: 'point', key }
    }
    case 'spin':
    case 'finalSpin': {
      if (!landedNow(s, now)) return { line: s.phase === 'finalSpin' ? say('finalSpin') : say('spin'), mood: 'wow', pose: 'cheer', key }
      return { line: say('landed', { cat: catLabel(s.cat) }), mood: 'grin', pose: 'point', key: `${key}-landed` }
    }
    case 'question': return { line: say('question'), mood: 'grin', pose: 'mic', key }
    case 'finalQ': return { line: say('finalQ'), mood: 'grin', pose: 'mic', key }
    case 'wager': return { line: say('wager'), mood: 'wink', pose: 'point', key }
    case 'reveal':
    case 'finalReveal': {
      if (!s.last) return { line: null, mood: 'grin', pose: 'mic', key }
      const r = revealLine(s.last, room.gamePlayers, s.phase === 'finalReveal')
      const bad = r.kind === 'allWrong' || r.kind === 'finalWrong'
      return { line: say(r.kind, { name: r.who ? who(r.who).name : undefined }), mood: bad ? 'wince' : 'grin', pose: bad ? 'mic' : 'cheer', key }
    }
    case 'done': return { line: say('done'), mood: 'grin', pose: 'cheer', key }
  }
  return { line: null, mood: 'grin', pose: 'mic', key }
}

/** Who got the last question right. */
export function rightIds(s: TriviaState, players: string[]): string[] {
  const last = s.last
  if (!last) return []
  return players.filter((id) => last.picks[id] === last.correct)
}

// ---------------- sound ----------------

function trackFor(s: TriviaState, landed: boolean): QuizTrack | null {
  switch (s.phase) {
    case 'spin':
    case 'finalSpin': return landed ? TRACKS.theme : TRACKS.roll
    case 'question': return TRACKS.think
    case 'wager':
    case 'finalQ': return TRACKS.final
    case 'done': return null
    default: return TRACKS.theme
  }
}

/** The band and the stingers, one cue per moment. Call from the Stage only (it plays where the game is shown). */
export function useShowSound(s: TriviaState, room: RoomView, now: () => number) {
  const landed = landedNow(s, now)
  useQuizMusic(trackFor(s, landed))
  const answered = Object.keys(s.answers).length
  const wagered = Object.keys(s.wagers).length
  const prev = useRef({ phase: s.phase, answered, wagered, landed })
  useEffect(() => {
    const p = prev.current
    if (p.phase !== s.phase) {
      if (s.phase === 'roundIntro') quizMusic.stinger(FANFARE)
      if ((s.phase === 'reveal' || s.phase === 'finalReveal') && s.last) {
        const right = rightIds(s, room.gamePlayers).length > 0
        quizMusic.stinger(right ? DING : BUZZ)
        if (s.phase === 'reveal' && s.last.steal && s.last.first && room.gamePlayers.length > 1) {
          setTimeout(() => quizMusic.stinger(STEAL), 900)
        }
      }
      if (s.phase === 'done') quizMusic.stinger(FINALE)
    } else {
      if (answered > p.answered) quizMusic.stinger(LOCK)
      if (wagered > p.wagered) quizMusic.stinger(CHIPS)
    }
    if (landed && !p.landed && p.phase === s.phase) quizMusic.stinger(LAND)
    prev.current = { phase: s.phase, answered, wagered, landed }
  }, [s.phase, answered, wagered, landed]) // eslint-disable-line react-hooks/exhaustive-deps
}

// ---------------- tokens ----------------

/** A player's round token: their color, their initial. */
export function Token({ name, color, size = 34, ring }: { name: string; color: string; size?: number; ring?: string }) {
  return (
    <span
      className="inline-grid shrink-0 place-items-center rounded-full border-[3px]"
      style={{ width: size, height: size, background: color, borderColor: INK, boxShadow: ring ? `0 0 0 3px ${ring}` : `0 3px 0 ${INK}`, fontFamily: DISPLAY, fontSize: size * 0.5, color: INK, lineHeight: 1 }}
      title={name}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  )
}

// ---------------- the board ----------------

function questionSize(text: string, compact: boolean) {
  if (compact) return text.length > 90 ? 17 : 19
  if (text.length > 120) return 32
  if (text.length > 80) return 36
  return 42
}

/** The question on the big board and the four colored answer tiles. On reveal: the right one flashes. */
export function Board({
  q,
  room,
  reveal,
  compact = false,
  head,
}: {
  q: LiveQ
  room: RoomView
  reveal?: { correct: number; picks: Record<string, number | null> } | null
  compact?: boolean
  head?: ReactNode
}) {
  const who = whoIn(room)
  return (
    <div className={cx('grid min-h-0 w-full', compact ? 'gap-2' : 'gap-4')}>
      <Bulbs b={compact ? 7 : 11} r={compact ? 14 : 22} frame="#6A1450">
        <div className={cx('grid rounded-xl', compact ? 'gap-1 px-3 py-2' : 'gap-2 px-6 py-3')} style={{ background: 'linear-gradient(180deg, #2E0A3E, #1A0526)' }}>
          {head}
          <h2 className="font-bold leading-tight text-white" style={{ fontSize: questionSize(q.q, compact) }}>{q.q}</h2>
        </div>
      </Bulbs>
      <div className={cx('grid grid-cols-2', compact ? 'gap-2' : 'gap-3')}>
        {q.options.map((opt, i) => {
          const c = ANSWER[i]
          const right = !!reveal && i === reveal.correct
          const wrong = !!reveal && i !== reveal.correct
          const pickers = reveal ? room.gamePlayers.filter((id) => reveal.picks[id] === i) : []
          return (
            <div
              key={i}
              className={cx('relative flex min-w-0 items-center rounded-2xl border-4', compact ? 'min-h-11 gap-2 px-2 py-1.5' : 'min-h-[76px] gap-3 px-3 py-1.5', right && 'tn-flash', wrong && 'tn-dim')}
              style={{
                borderColor: INK,
                background: right ? `linear-gradient(180deg, #7DFFB5, ${TN.green})` : `linear-gradient(180deg, ${c.bg}, ${c.edge})`,
                boxShadow: right ? `0 6px 0 ${INK}, 0 0 0 4px ${TN.cream}, 0 0 36px 8px rgba(120,255,180,0.6)` : `0 6px 0 ${INK}`,
                color: right ? INK : c.fg,
                zIndex: right ? 2 : undefined,
              }}
            >
              <span
                className="grid shrink-0 place-items-center rounded-full border-[3px]"
                style={{ width: compact ? 28 : 46, height: compact ? 28 : 46, background: TN.cream, borderColor: INK, color: INK, fontFamily: DISPLAY, fontSize: compact ? 15 : 26, boxShadow: `inset 0 -4px 0 ${TN.gold}` }}
              >
                {LETTERS[i]}
              </span>
              <span className="min-w-0 flex-1 font-bold leading-tight" style={{ fontSize: compact ? 14 : opt.length > 28 ? 23 : 28 }}>{opt}</span>
              {pickers.length > 0 && (
                <span className="flex shrink-0 -space-x-2">
                  {pickers.map((id) => <Token key={id} name={who(id).name} color={who(id).color} size={compact ? 22 : 38} />)}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** A category name on a small lit sign. */
export function CatSign({ cat, size = 22, className, wrap = false }: { cat: string; size?: number; className?: string; wrap?: boolean }) {
  // Long names ("Broadway and musicals") step down so they fit on one line, or wrap when allowed.
  const fit = !wrap && cat.length > 12 ? Math.max(size * 0.62, size * (12 / cat.length)) : size
  return (
    <Bulbs b={Math.max(6, Math.round(size / 3))} r={12} frame="#7A1458" className={cx('tn-sign inline-block', className)}>
      <div className="rounded-md px-3 py-0.5" style={{ background: '#16040F' }}>
        <span className={cx('tn-lit block leading-tight', wrap ? 'whitespace-normal' : 'whitespace-nowrap')} style={{ fontFamily: DISPLAY, fontSize: Math.round(fit) }}>{cat}</span>
      </div>
    </Bulbs>
  )
}
