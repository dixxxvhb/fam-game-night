import type { GameDef } from '../../engine/types'
import { outcome, reduce, setup, tick, type KartState } from './logic'
import { KartStage } from './Stage'
import { KartController } from './Controller'
import { TRACK_DEFS } from './tracks'

const kart: GameDef<KartState> = {
  id: 'kart',
  name: 'Kart',
  tagline: 'Tilt your phone to steer. Items, drifting, zero sportsmanship.',
  instead: 'Instead of Mario Kart',
  minPlayers: 1,
  maxPlayers: 6,
  modes: ['together', 'apart'],
  minutes: 6,
  options: [
    { key: 'track', label: 'Track', choices: TRACK_DEFS.map((t) => ({ value: t.id, label: t.name })), default: 'oval' },
    { key: 'laps', label: 'Laps', choices: [{ value: 3, label: '3' }, { value: 5, label: '5' }], default: 3 },
    { key: 'gas', label: 'Gas', choices: [{ value: 'auto', label: 'Always on' }, { value: 'hold', label: 'Hold to go' }], default: 'auto' },
  ],
  setup,
  reduce,
  tick,
  outcome,
  Stage: KartStage,
  Controller: KartController,
}

export default kart
