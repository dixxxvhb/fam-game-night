import type { RoomPlayer, RoomView } from '../../engine/types'

/** Look up a player in the room, with a safe stand-in for anyone who left. */
export function whoIn(room: RoomView) {
  return (id: string): RoomPlayer => room.players.find((p) => p.id === id) ?? { id, name: id, color: '#8790B6', guest: true, connected: false }
}
