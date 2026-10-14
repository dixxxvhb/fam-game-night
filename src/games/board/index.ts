import type { GameDef } from '../../engine/types'
import { bot, outcome, reduce, setup, tick, TURN_CHOICES, type BoardState } from './logic'
import { BoardStage } from './Stage'
import { BoardController } from './Controller'

const board: GameDef<BoardState> = {
  id: 'board',
  name: 'Board Night',
  tagline: 'Roll, buy Stars, ruin friendships. A minigame every turn.',
  instead: 'Instead of Mario Party',
  minPlayers: 2,
  maxPlayers: 4,
  modes: ['together', 'apart'],
  minutes: 35,
  options: [
    {
      key: 'turns',
      label: 'Turns',
      choices: TURN_CHOICES.map((v) => ({ value: v, label: v === 6 ? 'Short (6)' : String(v) })),
      default: 12,
    },
  ],
  setup,
  reduce,
  tick,
  outcome,
  bot,
  Stage: BoardStage,
  Controller: BoardController,
}

export default board
