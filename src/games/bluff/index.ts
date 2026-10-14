import type { GameDef } from '../../engine/types'
import { createLieGame, type LieItem, type LieState } from '../_lie/logic'
import { createLieViews } from '../_lie/make'
import { FACTS } from './facts'

export const BLUFF_MAX_LEN = 60

export const BLUFF_BANK: LieItem[] = FACTS.map((f) => ({
  id: f.id,
  prompt: f.q,
  truth: f.truth,
  ...(f.alt?.length ? { alt: f.alt } : {}),
  house: [...f.house],
  source: f.source,
}))

const engine = createLieGame(BLUFF_BANK, { kind: 'blank', maxLen: BLUFF_MAX_LEN })
const views = createLieViews({
  kind: 'blank',
  maxLen: BLUFF_MAX_LEN,
  writeLabel: 'Fill the blank with a lie',
  placeholder: 'Your lie',
  writeHint: 'Write a lie on your phone. Make it believable. Or don\'t, and own it.',
  pickLabel: 'Which one is true?',
})

const bluff: GameDef<LieState> = {
  id: 'bluff',
  name: 'Bluff',
  tagline: 'Real facts with a blank. Lie well enough to fool your friends.',
  instead: 'Instead of Fibbage',
  minPlayers: 2,
  maxPlayers: 8,
  modes: ['together', 'apart'],
  minutes: 15,
  options: [
    { key: 'length', label: 'Length', choices: [{ value: 'short', label: 'Short' }, { value: 'normal', label: 'Normal' }], default: 'normal' },
  ],
  setup: engine.setup,
  reduce: engine.reduce,
  tick: engine.tick,
  outcome: engine.outcome,
  Stage: views.Stage,
  Controller: views.Controller,
  bot: engine.bot,
}

export default bluff
