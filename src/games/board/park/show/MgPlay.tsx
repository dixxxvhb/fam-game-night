import { INK } from '../cast'
import { Outlined, PARK, SKY_BG } from '../ui'
import type { BoardState } from '../../logic'
import { minigame } from '../../minigames/registry'
import { VIEWS } from '../../minigames/views'
import type { Who } from '../../view'
import { MgBadge } from './bits'

/** How long GO! stays up after the start. */
const GO_MS = 700

/**
 * mgPlay: the minigame's own TV view, full size, in a park frame. Before the start the
 * frame shows the 3, 2, 1 over the view (so everyone sees the scene they are about to play),
 * then GO! slams and clears.
 */
export function MgPlayFrame({ s, who, now, compact = false }: { s: BoardState; who: Who; now: () => number; compact?: boolean }) {
  const run = s.mg!
  const views = VIEWS[run.id]
  const m = minigame(run.id)
  const st = run.s as { startAt: number }
  const left = st.startAt - now()
  const count = left > 0 ? Math.ceil(left / 1000) : 0
  const go = left <= 0 && left > -GO_MS

  if (compact) {
    return (
      <div className="relative overflow-hidden rounded-[18px] border-[3px]" style={{ borderColor: INK, background: SKY_BG }}>
        {views && <views.Stage s={run.s} run={run} who={who} now={now} compact />}
        {(count > 0 || go) && (
          <div className="absolute inset-0 grid place-items-center" style={{ background: 'rgba(194,238,255,0.7)' }}>
            <div key={count || 'go'} className="ps-pop-big"><Outlined size={64} color={go ? PARK.good : PARK.coral} stroke={4}>{go ? 'GO!' : count}</Outlined></div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="absolute inset-0 z-30 p-2.5" style={{ background: PARK.sun }}>
      <div className="relative h-full w-full overflow-hidden rounded-[26px] border-[5px]" style={{ borderColor: INK, background: SKY_BG }}>
        {views && <views.Stage s={run.s} run={run} who={who} now={now} compact={false} />}
        {count > 0 && (
          <div className="absolute inset-0 grid place-items-center" style={{ background: 'rgba(194,238,255,0.72)' }}>
            <div className="grid justify-items-center gap-3">
              <div className="flex items-center gap-4">
                <MgBadge id={run.id} size={72} />
                <Outlined size={60} stroke={5}>{m?.name ?? run.id}</Outlined>
              </div>
              <div key={count} className="ps-pop-big"><Outlined size={240} color={PARK.coral} stroke={9}>{count}</Outlined></div>
            </div>
          </div>
        )}
        {go && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="ps-slam"><Outlined size={220} color={PARK.good} stroke={9}>GO!</Outlined></div>
          </div>
        )}
      </div>
    </div>
  )
}
