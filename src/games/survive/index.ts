import type { GameDef } from '../../engine/types'
import { outcome, reduce, setup, tick, type SurviveState } from './logic'
import { SurviveStage } from './Stage'
import { SurviveController } from './Controller'

const survive: GameDef<SurviveState> = {
  id: 'survive',
  name: 'Survive the Quiz',
  tagline: 'Wrong answers go in a trap. Ghosts still play. First out the door wins.',
  instead: 'Instead of Trivia Murder Party',
  minPlayers: 2,
  maxPlayers: 8,
  modes: ['together', 'apart'],
  minutes: 20,
  setup,
  reduce,
  tick,
  outcome,
  Stage: SurviveStage,
  Controller: SurviveController,
}

export default survive
