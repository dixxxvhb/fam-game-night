import { cx } from '../../../ui/kit'
import { INK } from '../../board/park/cast'
import { Banner } from '../../board/park/ui'
import { Confetti } from '../../board/park/show/bits'
import type { BowlResult, BowlState } from '../logic'
import { mingoLine, streakWord } from '../lines'
import { kindColor, NIGHT } from '../look'
import { CritterOnSpot, MingoLine, Neon, type WhoFn } from './parts'

/** The critter's mood for a result. */
export function moodFor(r: BowlResult) {
  if (r.kind === 'strike' || r.kind === 'spare') return 'happy' as const
  if (r.kind === 'gutter' || r.kind === 'miss') return 'sad' as const
  if (r.kind === 'split') return 'idle' as const
  return r.pins >= 7 ? 'happy' as const : 'idle' as const
}

/** The word, sized and animated for its kind. Carries data-result for QA. */
export function ResultWord({ r, size }: { r: BowlResult; size: number }) {
  const color = kindColor(r.kind)
  const streak = r.kind === 'strike' ? streakWord(r.streak ?? 1) : null
  if (r.kind === 'gutter' || r.kind === 'miss') {
    return (
      <div className="gl-thud grid justify-items-center" data-result={r.kind}>
        <Neon size={size} color={NIGHT.violet} glowColor={NIGHT.violet} stroke={Math.round(size / 10)}>{r.label}</Neon>
      </div>
    )
  }
  if (r.kind === 'split') {
    return (
      <div className="gl-slam grid justify-items-center" data-result={r.kind}>
        <div className="gl-wobble"><Neon size={size * 1.15} color={color} glowColor={color} stroke={Math.round(size / 10)}>{r.label}</Neon></div>
        <Neon size={size * 0.38} color="#FFFFFF" className="-mt-1">SPLIT</Neon>
      </div>
    )
  }
  return (
    <div className="gl-slam grid justify-items-center" data-result={r.kind}>
      <Neon size={r.kind === 'count' ? size * 1.1 : size} color={color} glowColor={color} stroke={Math.round(size / 10)}>
        {r.kind === 'strike' ? 'STRIKE!' : r.kind === 'spare' ? 'SPARE!' : r.label}
      </Neon>
      {streak && <Neon size={size * 0.42} color={NIGHT.yellow} glowColor={NIGHT.yellow} className="-mt-1">{streak}</Neon>}
    </div>
  )
}

/**
 * Everything that lands on top of the lane after a ball (TV): the word (a sweeping banner for a
 * strike or spare), confetti on strikes, the bowler's critter popping up to cheer or slump, and
 * Mingo's line from the shoe counter.
 */
export function ReactionLayer({ s, who }: { s: BowlState; who: WhoFn }) {
  const r = s.result
  if (s.stage !== 'result' || !r) return null
  const w = who(r.by)
  const mood = moodFor(r)
  const streak = r.streak ?? 0
  const banner = r.kind === 'strike' || r.kind === 'spare'
  const color = kindColor(r.kind)
  const line = mingoLine(r, !!s.roll?.auto)
  const sub = r.kind === 'strike' ? (streakWord(streak) ?? r.line) : r.line
  return (
    <div key={r.n} className={cx('pointer-events-none absolute inset-0 overflow-hidden', r.kind === 'strike' && streak >= 3 && 'gl-shake')} data-bowl-reaction={r.kind}>
      {(r.kind === 'gutter' || r.kind === 'miss') && <div className="gl-dim absolute inset-0" style={{ background: 'rgba(11, 5, 34, 0.55)' }} />}
      {r.kind === 'strike' && <Confetti count={streak >= 3 ? 80 : 50} />}
      {r.kind === 'strike' && <div className="gl-breathe absolute inset-0" style={{ boxShadow: `inset 0 0 120px ${NIGHT.pink}` }} />}
      <div className="absolute inset-x-0 top-[7%] grid justify-items-center">
        {banner ? (
          <div data-result={r.kind} className="grid justify-items-center">
            <Banner text={r.kind === 'strike' ? (streak >= 3 ? `${streakWord(streak)}!` : 'STRIKE!') : 'SPARE!'} sub={sub} color={r.kind === 'strike' ? (streak >= 3 ? NIGHT.orange : NIGHT.pink) : NIGHT.cyanDark} />
          </div>
        ) : (
          <div className="grid justify-items-center gap-2">
            <ResultWord r={r} size={r.kind === 'count' ? 104 : 112} />
            <div className="gl-pop rounded-full border-4 bg-white px-6 py-1.5 font-party text-[28px] leading-none" style={{ borderColor: INK, color: INK, animationDelay: '200ms', boxShadow: `0 5px 0 ${INK}` }}>{r.line}</div>
          </div>
        )}
      </div>
      <div className="gl-rise absolute bottom-0 left-6" style={{ animationDelay: banner ? '250ms' : '120ms' }}>
        <CritterOnSpot char={w.char} size={streak >= 3 ? 230 : 196} mood={mood} color={color} />
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border-4 px-4 py-0.5 font-party text-[24px] leading-none" style={{ borderColor: INK, background: w.tint, color: '#FFFFFF', WebkitTextStroke: `1px ${INK}` }}>
          {w.name}
        </div>
      </div>
      <div className="absolute bottom-2 right-4 max-w-[540px]">
        <MingoLine text={line} size={140} mood={r.kind === 'strike' ? 'happy' : r.kind === 'gutter' ? 'sad' : 'idle'} bubbleSize={22} lift={34} />
      </div>
    </div>
  )
}
