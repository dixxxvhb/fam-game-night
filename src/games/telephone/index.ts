import type { GameDef } from '../../engine/types'
import { bot, outcome, reduce, setup, tick, type TelephoneState } from './logic'
import { TelephoneStage } from './Stage'
import { TelephoneController } from './Controller'

const telephone: GameDef<TelephoneState> = {
  id: 'telephone',
  name: 'Telephone',
  tagline: 'Write it, draw it, describe it. Watch it fall apart.',
  instead: 'Instead of Gartic Phone',
  minPlayers: 3,
  maxPlayers: 8,
  modes: ['together', 'apart'],
  minutes: 12,
  options: [
    { key: 'steps', label: 'Steps per chain', choices: [{ value: 4, label: '4' }, { value: 6, label: '6' }, { value: 8, label: '8' }], default: 6 },
  ],
  setup,
  reduce,
  tick,
  outcome,
  bot,
  Stage: TelephoneStage,
  Controller: TelephoneController,
}

export default telephone
