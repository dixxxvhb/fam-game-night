import { Outlined, PARK, SKY_BG } from '../ui'
import type { BoardState } from '../../logic'
import { VIEWS } from '../../minigames/views'
import type { Who } from '../../view'

/** How long GO! stays up after the start. */
const GO_MS = 700

/**
 * mgPlay: the minigame's own TV view, full size, in a park frame. Before the start the
 * screen shows the 3, 2, 1 over the view (so everyone sees the scene they are about to play),
 * then GO! slams and clears.
 */
export function MgPlayFrame({ s, who, now, compact = false }: { s: BoardState; who: Who; now: () => number; compact?: boolean }) {
  const run = s.mg!
  const views = VIEWS[run.id]
  const st = run.s as { startAt: number }
  const left = st.startAt - now()
  const count = left > 0 ? Math.ceil(left / 1000) : 0
  const go = left <= 0 && left > -GO_MS

  if (compact) {
    return (
      <div className="relative">
        {views && <views.Stage s={run.s} run={run} who={who} now={now} compact />}
        {(count > 0 || go) && (
          <div className="pointer-events-none absolute inset-y-0 right-3 z-50 grid place-items-center">
            <div key={count || 'go'} className="ps-pop-big"><Outlined size={40} color={go ? PARK.good : PARK.coral} stroke={4}>{go ? 'GO!' : count}</Outlined></div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="absolute inset-0 z-30 overflow-hidden" style={{ background: SKY_BG }}>
      {views && <views.Stage s={run.s} run={run} who={who} now={now} compact={false} />}
      {count > 0 && (
        <div className="pointer-events-none absolute inset-0 z-50 grid place-items-center" style={{ background: 'rgba(194,238,255,0.45)' }}>
          <div key={count} className="ps-pop-big"><Outlined size={240} color={PARK.coral} stroke={9}>{count}</Outlined></div>
        </div>
      )}
      {go && (
        <div className="pointer-events-none absolute inset-0 z-50 grid place-items-center">
          <div className="ps-slam"><Outlined size={220} color={PARK.good} stroke={9}>GO!</Outlined></div>
        </div>
      )}
    </div>
  )
}
