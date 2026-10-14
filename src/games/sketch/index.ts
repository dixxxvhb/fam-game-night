import type { GameDef } from '../../engine/types'
import { outcome, reduce, setup, tick, type SketchState } from './logic'
import { SketchStage } from './Stage'
import { SketchController } from './Controller'
import { PACK_OPTIONS } from './words'

const sketch: GameDef<SketchState> = {
  id: 'sketch',
  name: 'Sketch',
  tagline: 'One draws on their phone, everyone races to guess.',
  instead: 'Instead of Pictionary',
  minPlayers: 2,
  maxPlayers: 8,
  modes: ['together', 'apart'],
  minutes: 10,
  options: [
    { key: 'pack', label: 'Words', choices: PACK_OPTIONS, default: 'classic' },
    { key: 'rounds', label: 'Turns each', choices: [{ value: 1, label: '1' }, { value: 2, label: '2' }, { value: 3, label: '3' }], default: 2 },
    { key: 'drawTime', label: 'Seconds to draw', choices: [{ value: 60, label: '60' }, { value: 80, label: '80' }, { value: 100, label: '100' }], default: 80 },
  ],
  setup,
  reduce,
  tick,
  outcome,
  Stage: SketchStage,
  Controller: SketchController,
}

export default sketch
