import type { GameDef } from '../../engine/types'
import { createLieGame, type LieItem, type LieState } from '../_lie/logic'
import { createLieViews } from '../_lie/make'
import { FACTS, type FactCat } from './facts'
import { ABOUT } from './about'
import BluffStage from './show/Stage'

export const BLUFF_MAX_LEN = 60

export const BLUFF_BANK: LieItem[] = FACTS.map((f) => ({
  id: f.id,
  prompt: f.q,
  truth: f.truth,
  ...(f.alt?.length ? { alt: f.alt } : {}),
  house: [...f.house],
  source: f.source,
  cat: f.cat,
}))

/** What the category pick shows. */
export const BLUFF_CATS: Record<FactCat, string> = {
  history: 'History',
  inventions: 'Inventions',
  animals: 'Animals',
  science: 'Science',
  food: 'Food',
  laws: 'Weird laws',
  florida: 'Florida',
  disney: 'Disney',
  broadway: 'Broadway',
  dance: 'Dance',
  music: 'Music',
  sports: 'Sports',
  wildcard: 'Wild card',
}

const engine = createLieGame(BLUFF_BANK, { kind: 'blank', maxLen: BLUFF_MAX_LEN, cats: BLUFF_CATS, about: ABOUT })
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
  Stage: BluffStage,
  Controller: views.Controller,
  bot: engine.bot,
}

export default bluff
