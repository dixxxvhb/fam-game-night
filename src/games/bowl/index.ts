import type { GameDef } from '../../engine/types'
import { bot, outcome, reduce, setup, tick, type BowlState } from './logic'
import { BowlStage } from './Stage'
import { BowlController } from './Controller'

const bowl: GameDef<BowlState> = {
  id: 'bowl',
  name: 'Gator Lanes',
  tagline: 'Cosmic bowling at Party Park. Swing your phone, pick a critter, try not to gutter.',
  instead: 'Instead of Wii Bowling',
  minPlayers: 1,
  maxPlayers: 6,
  modes: ['together', 'apart'],
  minutes: 10,
  options: [
    { key: 'frames', label: 'Frames', choices: [{ value: 5, label: '5' }, { value: 10, label: '10' }], default: 5 },
  ],
  setup,
  reduce,
  tick,
  outcome,
  Stage: BowlStage,
  Controller: BowlController,
  bot,
}

export default bowl
