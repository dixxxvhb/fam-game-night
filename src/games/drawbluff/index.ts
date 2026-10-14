import type { GameDef } from '../../engine/types'
import { outcome, reduce, setup, tick, type DrawBluffState } from './logic'
import { DrawBluffStage } from './Stage'
import { DrawBluffController } from './Controller'

const drawbluff: GameDef<DrawBluffState> = {
  id: 'drawbluff',
  name: 'Draw Bluff',
  tagline: 'Draw a weird secret prompt. Lie about everyone else\'s.',
  instead: 'Instead of Drawful',
  minPlayers: 3,
  maxPlayers: 8,
  modes: ['together', 'apart'],
  minutes: 15,
  setup,
  reduce,
  tick,
  outcome,
  Stage: DrawBluffStage,
  Controller: DrawBluffController,
}

export default drawbluff
