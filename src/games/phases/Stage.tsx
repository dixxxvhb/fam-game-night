import type { StageProps } from '../../engine/types'
import { useTicker } from '../../engine/context'
import type { PhasesState } from './logic'
import { whoFrom } from './view'
import { TvTable } from './tv/Table'
import { CompactTable } from './lounge/Compact'

/** The Phase Lounge on the TV (a card table seen from above), or a strip of it above an apart phone's controller. */
export function PhasesStage({ state: s, room, now, compact, me }: StageProps<PhasesState>) {
  useTicker(250)
  const who = whoFrom(room.players)
  if (compact) return <CompactTable s={s} who={who} now={now} me={me} />
  return <TvTable s={s} who={who} now={now} />
}
