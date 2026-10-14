import type { GameDef } from '../engine/types'
import sketch from './sketch'
import telephone from './telephone'
import drawbluff from './drawbluff'

/** Every playable game, in shelf order. Each game lives in its own folder under src/games/. */
export const GAMES: GameDef[] = [sketch, telephone, drawbluff]

export function getGame(id: string): GameDef | null {
  return GAMES.find((g) => g.id === id) ?? null
}
