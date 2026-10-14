import type { GameDef } from '../../engine/types'
import { outcome, reduce, setup, tick, type QuipState } from './logic'
import { QuipStage } from './Stage'
import { QuipController } from './Controller'
import { PACK_OPTIONS } from './prompts'

const quip: GameDef<QuipState> = {
  id: 'quip',
  name: 'Quip',
  tagline: 'Everyone answers. So does the House. Vote for anything but yours.',
  instead: 'Instead of Quiplash',
  minPlayers: 2,
  maxPlayers: 8,
  modes: ['together', 'apart'],
  minutes: 15,
  options: [{ key: 'pack', label: 'Prompts', choices: PACK_OPTIONS, default: 'mixed' }],
  setup,
  reduce,
  tick,
  outcome,
  Stage: QuipStage,
  Controller: QuipController,
}

export default quip
