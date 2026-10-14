import type { GameDef } from '../engine/types'
import sketch from './sketch'
import bluff from './bluff'
import fakeword from './fakeword'

/** Every playable game, in shelf order. Each game lives in its own folder under src/games/. */
export const GAMES: GameDef[] = [sketch, bluff, fakeword]

export function getGame(id: string): GameDef | null {
  return GAMES.find((g) => g.id === id) ?? null
}
