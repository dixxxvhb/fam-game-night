import type { GameDef } from '../../engine/types'
import { outcome, reduce, setup, tick, type AggroState } from './logic'
import { AggroStage } from './Stage'
import { AggroController } from './Controller'

const aggro: GameDef<AggroState> = {
  id: 'aggro',
  name: 'Aggro',
  tagline: 'Roll, race your marbles home, and send everyone else back to base.',
  instead: 'Instead of Aggravation',
  minPlayers: 2,
  maxPlayers: 4,
  modes: ['together', 'apart'],
  minutes: 30,
  options: [
    {
      key: 'speed',
      label: 'Speed',
      choices: [
        { value: 'classic', label: 'Classic' },
        { value: 'quick', label: 'Quick' },
      ],
      default: 'classic',
    },
  ],
  setup,
  reduce,
  tick,
  outcome,
  Stage: AggroStage,
  Controller: AggroController,
}

export default aggro
