import type { GameDef } from '../../engine/types'
import { bot, outcome, reduce, setup, tick, type ArenaState } from './logic'
import { ArenaStage } from './Stage'
import { ArenaController } from './Controller'

/**
 * Kaboom (id 'arena', was Arena): Bomberman in the Party Park, Mingo's fireworks stand gone
 * wrong. Critters pick, then rounds in four rotating arenas. The arena runs on the host device
 * (the TV together, the host phone apart) at 30 steps a second; phones stream their thumbs
 * (limiter.ts), bots play inside the same simulation (bots.ts), and apart phones draw the arena
 * from the host's snapshots (snap.ts), which also let a new host pick a round up mid-fight.
 */
const arena: GameDef<ArenaState> = {
  id: 'arena',
  name: 'Kaboom',
  tagline: 'Drop firecrackers, box people in, last critter standing.',
  instead: 'Like Bomberman',
  minPlayers: 2,
  maxPlayers: 6,
  modes: ['together', 'apart'],
  minutes: 6,
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
