import type { GameDef } from '../../engine/types'
import { outcome, reduce, setup, tick, type MelonState } from './logic'
import { MelonStage } from './Stage'
import { MelonController } from './Controller'

const melon: GameDef<MelonState> = {
  id: 'melon',
  name: 'Melon',
  tagline: "Everyone drops fruit at once. Merge up, don't spill over.",
  instead: 'Instead of the watermelon game',
  minPlayers: 1,
  maxPlayers: 6,
  modes: ['together', 'apart'],
  minutes: 5,
  options: [
    { key: 'mode', label: 'Mode', choices: [{ value: 'race', label: 'Race' }, { value: 'attack', label: 'Attack' }], default: 'race' },
    { key: 'length', label: 'Race length', choices: [{ value: 2, label: '2 min' }, { value: 3, label: '3 min' }, { value: 5, label: '5 min' }], default: 3 },
  ],
  setup,
  reduce,
  tick,
  outcome,
  Stage: MelonStage,
  Controller: MelonController,
}

export default melon
