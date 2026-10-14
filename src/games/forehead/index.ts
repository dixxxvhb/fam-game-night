import type { GameDef } from '../../engine/types'
import { bot, outcome, reduce, setup, tick, type ForeheadState } from './logic'
import { ForeheadStage } from './Stage'
import { ForeheadController } from './Controller'
import { DECK_OPTIONS } from './decks'

const forehead: GameDef<ForeheadState> = {
  id: 'forehead',
  name: 'Forehead',
  tagline: 'Phone on your forehead. The room acts it out. Tilt down when you get it.',
  instead: 'Instead of Heads Up',
  minPlayers: 2,
  maxPlayers: 8,
  modes: ['together'],
  minutes: 10,
  options: [
    { key: 'deck', label: 'Deck', choices: DECK_OPTIONS, default: 'mixed' },
    { key: 'turns', label: 'Turns each', choices: [{ value: 1, label: '1' }, { value: 2, label: '2' }, { value: 3, label: '3' }], default: 2 },
  ],
  setup,
  reduce,
  tick,
  outcome,
  Stage: ForeheadStage,
  bot,
  Controller: ForeheadController,
}

export default forehead
