import type { GameDef } from '../../engine/types'
import { outcome, reduce, setup, tick, type PhasesState } from './logic'
import { PhasesStage } from './Stage'
import { PhasesController } from './Controller'

const phases: GameDef<PhasesState> = {
  id: 'phases',
  name: 'Phases',
  tagline: 'Ten phases, private hands, Skips aimed at people you love.',
  instead: 'Instead of Phase 10',
  minPlayers: 2,
  maxPlayers: 6,
  modes: ['together', 'apart'],
  minutes: 45,
  options: [
    {
      key: 'length',
      label: 'Length',
      choices: [
        { value: 'full', label: 'Full (1-10)' },
        { value: 'short', label: 'Short (1-5)' },
        { value: 'odds', label: 'Odds (1, 3, 5, 7, 9)' },
      ],
      default: 'full',
    },
  ],
  setup,
  reduce,
  tick,
  outcome,
  Stage: PhasesStage,
  Controller: PhasesController,
}

export default phases
