import type { GameDef } from '../../engine/types'
import { outcome, reduce, setup, tick, type TriviaState } from './logic'
import { TriviaStage } from './Stage'
import { TriviaController } from './Controller'

const trivia: GameDef<TriviaState> = {
  id: 'trivia',
  name: 'Trivia Night',
  tagline: 'Spin the wheel, answer fast, bet it all on the last one.',
  instead: 'Instead of trivia apps',
  minPlayers: 1,
  maxPlayers: 8,
  modes: ['together', 'apart'],
  minutes: 15,
  setup,
  reduce,
  tick,
  outcome,
  Stage: TriviaStage,
  Controller: TriviaController,
}

export default trivia
