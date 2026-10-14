export type ItemId = 'double' | 'pick' | 'pickpocket' | 'warp' | 'magnet'

export interface Item {
  id: ItemId
  name: string
  /** What it does, one line for the phone. */
  does: string
  price: number
  /** Needs a target player when used. */
  target?: boolean
}

export const ITEMS: Item[] = [
  { id: 'double', name: 'Double Die', does: 'Roll two dice this turn.', price: 8 },
  { id: 'pick', name: 'Pick Die', does: 'Choose your roll, 1 to 6.', price: 5 },
  { id: 'pickpocket', name: 'Pickpocket', does: 'Steal 5 coins from a player you pick.', price: 8, target: true },
  { id: 'warp', name: 'Warp', does: 'Swap places with a random player.', price: 6 },
  { id: 'magnet', name: 'Star Magnet', does: 'Pull the Star 5 spaces toward you.', price: 10 },
]

export const ITEM_IDS = ITEMS.map((i) => i.id)

export function item(id: ItemId): Item {
  return ITEMS.find((i) => i.id === id)!
}

export function isItemId(x: unknown): x is ItemId {
  return typeof x === 'string' && (ITEM_IDS as string[]).includes(x)
}
