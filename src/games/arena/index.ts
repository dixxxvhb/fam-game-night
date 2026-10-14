import type { GameDef } from '../../engine/types'
import { bot, outcome, reduce, setup, tick, type ArenaState } from './logic'
import { ArenaStage } from './Stage'
import { ArenaController } from './Controller'

/**
 * Arena: Bomberman on the TV, d-pads on the phones. The arena itself runs on the TV (the
 * host) at 30 steps a second; phones stream their thumbs (limiter.ts), and bots play inside
 * the same simulation (bots.ts). Together mode only: the sim lives on the host screen.
 */
const arena: GameDef<ArenaState> = {
  id: 'arena',
  name: 'Arena',
  tagline: 'Drop bombs, box people in, be the last one standing.',
  instead: 'Like Bomberman',
  minPlayers: 2,
  maxPlayers: 6,
  modes: ['together'],
  minutes: 5,
  options: [
    { key: 'rounds', label: 'Rounds', choices: [{ value: 3, label: 'Best of 3' }, { value: 5, label: 'Best of 5' }], default: 3 },
  ],
  setup,
  reduce,
  tick,
  outcome,
  Stage: ArenaStage,
  Controller: ArenaController,
  bot,
}

export default arena
