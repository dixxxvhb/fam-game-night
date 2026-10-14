import type { GameDef } from '../../engine/types'
import { createLieGame, type LieItem, type LieState } from '../_lie/logic'
import { createLieViews } from '../_lie/make'
import { WORDS } from './words'

export const FAKEWORD_MAX_LEN = 90

export const FAKEWORD_BANK: LieItem[] = WORDS.map((w) => ({
  id: w.id,
  prompt: w.word,
  pos: w.pos,
  truth: w.truth,
  house: [...w.house],
  source: w.source,
}))

const engine = createLieGame(FAKEWORD_BANK, { kind: 'word', maxLen: FAKEWORD_MAX_LEN })
const views = createLieViews({
  kind: 'word',
  maxLen: FAKEWORD_MAX_LEN,
  writeLabel: 'Write a fake definition',
  placeholder: 'It means...',
  writeHint: 'Write a fake definition on your phone. Sound like a dictionary.',
  pickLabel: 'Which is the real meaning?',
})

const fakeword: GameDef<LieState> = {
  id: 'fakeword',
  name: 'Fake Word',
  tagline: 'A real word nobody knows. Make up what it means and sell it.',
  instead: 'Instead of Dictionarium',
  minPlayers: 2,
  maxPlayers: 8,
  modes: ['together', 'apart'],
  minutes: 12,
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

export default fakeword
