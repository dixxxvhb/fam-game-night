import type { GameDef } from '../../engine/types'
import { bot, outcome, reduce, setup, tick, type CategoriesState } from './logic'
import { CategoriesStage } from './Stage'
import { CategoriesController } from './Controller'

const categories: GameDef<CategoriesState> = {
  id: 'categories',
  name: 'Categories',
  tagline: 'One letter, eight categories, two minutes. Say the same thing as someone and you both get nothing.',
  instead: 'Instead of Scattergories',
  minPlayers: 2,
  maxPlayers: 8,
  modes: ['together', 'apart'],
  minutes: 10,
  setup,
  reduce,
  tick,
  outcome,
  Stage: CategoriesStage,
  bot,
  Controller: CategoriesController,
}

export default categories
