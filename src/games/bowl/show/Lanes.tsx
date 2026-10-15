import type { RoomView } from '../../../engine/types'
import { cx } from '../../../ui/kit'
import { CritterArt, INK } from '../../board/park/cast'
import { Banner, Portrait } from '../../board/park/ui'
import { LaneView } from '../LaneView'
import { PinChart, Scoreboard } from '../Scoreboard'
import { nextBowler, type BowlState } from '../logic'
import { position, scoreCard } from '../score'
import { NIGHT, ROOM_BG } from '../look'
import { MirrorBall, Neon, NightPanel, type WhoFn } from './parts'
import { ReactionLayer } from './Reaction'

const WARN_MS = 10_000
/** How long the "up now" card stays on a new bowler. */
const TURN_CARD_MS = 2100

export function ballLine(s: BowlState) {
  const pos = position(s.rolls[s.bowler] ?? [], s.frames)
  const ball = s.stage === 'aim' ? pos.ball : s.roll?.ball ?? pos.ball
  const frame = s.stage === 'aim' ? s.frame : s.roll?.frame ?? s.frame
  return `Frame ${Math.min(frame, s.frames - 1) + 1} of ${s.frames} · Ball ${ball + 1}`
}

/** The TV while bowling: the overhead monitor, the lane, the bowler, the pins, the reactions. */
export function LanesScreen({ s, room, now, who }: { s: BowlState; room: RoomView; now: () => number; who: WhoFn }) {
  const t = now()
  const bowler = who(s.bowler)
  const left = Math.max(0, s.endsAt - t)
  const warn = s.stage === 'aim' && left <= WARN_MS
  const nextId = nextBowler(s)
  const next = nextId && nextId !== s.bowler ? who(nextId) : null
  const chartStanding = s.stage === 'roll' && s.roll ? s.roll.before : s.stage === 'result' && s.roll ? s.roll.left : s.standing
  const chartKnocked = s.stage === 'result' && s.roll ? s.roll.knocked : []
  const status =
    s.stage === 'aim' ? (warn ? `Rolls itself in ${Math.ceil(left / 1000)}` : s.standing.length < 10 ? `${s.standing.length} to pick up` : 'Lining it up')
    : s.stage === 'roll' && s.roll ? `${s.roll.mph} mph${Math.abs(s.roll.th.curve) > 0.15 ? `, hooking ${s.roll.th.curve < 0 ? 'left' : 'right'}` : ''}`
    : s.stage === 'result' && s.result ? `${s.result.pins} down`
    : ''
  const score = scoreCard(s.rolls[s.bowler] ?? [], s.frames).live
  const firstBall = s.stage === 'aim' && position(s.rolls[s.bowler] ?? [], s.frames).ball === 0 && t - s.stageStartedAt < TURN_CARD_MS
  const lastFrame = firstBall && s.frame === s.frames - 1 && s.turn === 0
  const dense = s.order.length >= 4

  return (
    <div className="absolute inset-0 flex flex-col gap-3 px-5 pb-4 pt-3" style={{ background: ROOM_BG }} data-bowl-tv="lanes">
      <Scoreboard s={s} players={room.players} size="tv" />
      <div
        className="relative min-h-0 flex-1 overflow-hidden rounded-[24px] border-4"
        style={{ borderColor: INK, boxShadow: `0 6px 0 ${INK}, 0 0 0 3px ${NIGHT.pink}66, 0 0 34px ${NIGHT.pink}44` }}
      >
        <LaneView s={s} room={room} now={now} className="absolute inset-0" />
        <MirrorBall size={70} className="absolute right-[24%] top-0" />

        {/* the bowler */}
        <div className={cx('absolute left-4 top-4 flex items-center gap-3 transition-opacity', s.stage === 'result' && 'opacity-0')}>
          <div className="rounded-full" style={{ boxShadow: `0 0 0 4px ${bowler.tint}, 0 0 22px ${bowler.tint}` }}>
            <Portrait char={bowler.char} name={bowler.name} size={dense ? 58 : 70} />
          </div>
          <div className="grid gap-1">
            <Neon size={dense ? 34 : 40} stroke={4}>{bowler.name}</Neon>
            <span className="rounded-full px-3 py-0.5 font-mono text-[15px] font-semibold" style={{ background: 'rgba(11,5,34,0.75)', color: NIGHT.text }}>{ballLine(s)}</span>
          </div>
          <div className="ml-1 grid justify-items-center rounded-2xl border-[3px] px-3 py-1" style={{ borderColor: INK, background: 'rgba(11,5,34,0.8)' }}>
            <span className="font-mono text-[12px] uppercase tracking-[0.14em]" style={{ color: NIGHT.text3 }}>Score</span>
            <span className="font-party text-[30px] leading-none tabular" style={{ color: NIGHT.yellow }}>{score}</span>
          </div>
        </div>

        {/* the pins */}
        <NightPanel className={cx('absolute right-4 top-4 grid justify-items-center gap-1.5 px-4 py-3 transition-opacity', s.stage === 'result' && 'opacity-0')} edge={warn ? NIGHT.red : NIGHT.cyan}>
          <PinChart standing={chartStanding} knocked={chartKnocked} size={dense ? 22 : 26} />
          <div className="max-w-[190px] text-center font-party text-[20px] leading-tight" style={{ color: warn ? NIGHT.red : NIGHT.text }}>{status}</div>
        </NightPanel>

        {next && s.stage === 'aim' && !firstBall && (
          <div className="absolute bottom-4 right-4 flex items-center gap-2 rounded-full border-[3px] py-1 pl-1 pr-4" style={{ borderColor: INK, background: 'rgba(11,5,34,0.85)' }}>
            <Portrait char={next.char} name={next.name} size={34} />
            <span className="font-mono text-[12px] uppercase tracking-[0.14em]" style={{ color: NIGHT.text3 }}>Next</span>
            <span className="font-party text-[22px] leading-none" style={{ color: NIGHT.text }}>{next.name}</span>
          </div>
        )}

        {/* a new bowler steps up */}
        {firstBall && !lastFrame && (
          <div key={`turn${s.frame}:${s.turn}`} className="gl-turn pointer-events-none absolute left-[18%] top-[30%] flex items-end gap-4" data-bowl-turn={s.bowler}>
            <div className="relative -mb-3"><CritterArt id={bowler.char ?? 'chomp'} size={150} mood="hop" /></div>
            <div className="-skew-x-6 border-y-[6px] px-10 py-3" style={{ background: bowler.tint, borderColor: INK, boxShadow: `0 8px 0 ${INK}, 0 0 30px ${bowler.tint}` }}>
              <div className="skew-x-6 grid">
                <span className="font-party text-[22px] leading-none" style={{ color: INK }}>UP NOW · FRAME {s.frame + 1}</span>
                <Neon size={62} stroke={5}>{bowler.name}</Neon>
              </div>
            </div>
          </div>
        )}
        {lastFrame && (
          <div key="last" className="pointer-events-none absolute inset-x-0 top-[28%]">
            <Banner text="LAST FRAME" sub={`${bowler.name} leads off. No pressure.`} color={NIGHT.orange} />
          </div>
        )}

        {warn && (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
            <span className="gl-pulse rounded-full border-4 bg-white px-5 py-1.5 font-party text-[28px] leading-none" style={{ borderColor: INK, color: NIGHT.red }}>Rolls itself in {Math.ceil(left / 1000)}</span>
          </div>
        )}

        <ReactionLayer s={s} who={who} />
      </div>
    </div>
  )
}
