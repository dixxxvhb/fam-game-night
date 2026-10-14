import type { GameDef } from '../../engine/types'
import { outcome, reduce, setup, tick, type PercentState } from './logic'
import { PercentStage } from './Stage'
import { PercentController } from './Controller'
import { bot } from './bot'

const percent: GameDef<PercentState> = {
  id: 'percent',
  name: 'Guess the Percent',
  tagline: 'Real polls about real people. The Spy guesses, everyone bets higher or lower.',
  instead: 'Instead of Guesspionage',
  minPlayers: 2,
  maxPlayers: 8,
  modes: ['together', 'apart'],
  minutes: 15,
  options: [
    { key: 'rounds', label: 'Spy turns each', choices: [{ value: 1, label: '1' }, { value: 2, label: '2' }, { value: 3, label: '3' }], default: 2 },
  ],
  setup,
  reduce,
  tick,
  outcome,
  Stage: PercentStage,
  Controller: PercentController,
  bot,
}

export default percent
