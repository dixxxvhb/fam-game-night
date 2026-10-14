import type { GameDef } from '../../engine/types'
import { bot, outcome, reduce, setup, tick, type KartState } from './logic'
import { KartStage } from './Stage'
import { KartController } from './Controller'
import { TRACK_DEFS } from './tracks'
import { CUPS, SPEED_NAMES, type SpeedClass } from './contract'

const kart: GameDef<KartState> = {
  id: 'kart',
  name: 'Turnpike',
  tagline: 'Eight critters, four-race cups, one turnpike. Florida driving rules apply.',
  instead: 'Instead of Mario Kart',
  minPlayers: 1,
  maxPlayers: 6,
  modes: ['together', 'apart'],
  minutes: 10,
  options: [
    { key: 'race', label: 'Race', choices: [{ value: 'gp', label: 'Grand Prix (4 races)' }, { value: 'single', label: 'Single race' }], default: 'gp' },
    { key: 'cup', label: 'Cup', choices: CUPS.map((c) => ({ value: c.id, label: c.name.replace(/ Cup$/, '') })), default: 'sunshine' },
    { key: 'track', label: 'Track', choices: TRACK_DEFS.map((t) => ({ value: t.id, label: t.name })), default: 'oval' },
    {
      key: 'speed', label: 'Speed',
      choices: (['sunday', 'rush', 'florida'] as SpeedClass[]).map((c) => ({ value: c, label: SPEED_NAMES[c] })),
      default: 'rush',
    },
    { key: 'gas', label: 'Gas', choices: [{ value: 'auto', label: 'Always on' }, { value: 'hold', label: 'Hold to go' }], default: 'auto' },
    { key: 'cam', label: 'TV camera', choices: [{ value: 'split', label: 'Split screen' }, { value: 'overview', label: 'Overview' }], default: 'split' },
    { key: 'apart', label: 'Apart', choices: [{ value: 'race', label: 'Race' }, { value: 'trial', label: 'Time trial' }], default: 'race' },
  ],
  setup,
  reduce,
  tick,
  outcome,
  // Race bots drive inside the host Stage sim (AI karts); this picks critters and posts time-trial laps.
  bot,
  Stage: KartStage,
  Controller: KartController,
}

export default kart
