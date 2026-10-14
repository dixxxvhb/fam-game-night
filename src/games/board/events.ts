export type EventKind =
  | 'swap' | 'bank' | 'leaderGives' | 'steal' | 'warpStar' | 'loseRoll' | 'doubleBlue'
  | 'allPay' | 'fine' | 'charity' | 'freeItem' | 'coinFlip' | 'starMoves' | 'encore'
  | 'heist' | 'swapCoins'

export interface EventCard {
  id: string
  kind: EventKind
  title: string
  /** What happens, plain. */
  rule: string
  /** The dry line under it on the TV. */
  joke: string
}

/** Events that need the lander to pick a player. */
export const PICK_EVENTS: EventKind[] = ['steal']

export const EVENTS: EventCard[] = [
  { id: 'swap', kind: 'swap', title: 'Musical Chairs', rule: 'Swap places with a random player.', joke: 'Nobody asked for this. That is what makes it a party.' },
  { id: 'refund', kind: 'bank', title: 'Tax Refund', rule: 'The bank pays you 10 coins.', joke: 'The government made a mistake. Do not call them about it.' },
  { id: 'robin', kind: 'leaderGives', title: 'Robin Hood Lite', rule: 'The leader gives everyone else 3 coins.', joke: 'Wealth redistribution, but make it small.' },
  { id: 'sticky', kind: 'steal', title: 'Sticky Fingers', rule: 'Steal 5 coins from a player you pick.', joke: 'Pick someone you can look in the eye later.' },
  { id: 'uber', kind: 'warpStar', title: 'Wrong Uber', rule: 'Warp to the Star\'s neighborhood.', joke: 'You got in a stranger\'s car. It went somewhere nice.' },
  { id: 'hammy', kind: 'loseRoll', title: 'Pulled a Hammy', rule: 'You lose your next roll.', joke: 'Should have stretched. You of all people.' },
  { id: 'happy', kind: 'doubleBlue', title: 'Happy Hour', rule: 'Your next blue space pays double.', joke: 'Two for one. On coins. Calm down.' },
  { id: 'venmo', kind: 'allPay', title: 'Group Venmo Request', rule: 'Everyone else pays you 2 coins.', joke: 'For "snacks". There were no snacks.' },
  { id: 'parking', kind: 'fine', title: 'Parking Ticket', rule: 'Lose 5 coins.', joke: 'Downtown Orlando. Of course it was.' },
  { id: 'gala', kind: 'charity', title: 'Charity Gala', rule: 'Give 5 coins to whoever is in last.', joke: 'If that is you, the bank feels sorry and pays 5.' },
  { id: 'couch', kind: 'freeItem', title: 'Found in the Couch', rule: 'Get a free random item.', joke: 'Also found: a fry from 2019. You left it.' },
  { id: 'flip', kind: 'coinFlip', title: 'Coin Flip', rule: 'Win 6 coins or lose 6. Fifty fifty.', joke: 'The coin has been waiting for this its whole life.' },
  { id: 'bored', kind: 'starMoves', title: 'The Star Got Bored', rule: 'The Star moves somewhere else.', joke: 'It got a better offer. Stars do that.' },
  { id: 'encore', kind: 'encore', title: 'Encore', rule: 'Roll again right now.', joke: 'Nobody clapped. You are doing it anyway.' },
  { id: 'heist', kind: 'heist', title: 'Star Heist', rule: 'Pay 15 coins to steal a Star from the leader.', joke: 'Too broke? Then it is just a sad walk past a museum.' },
  { id: 'florida', kind: 'swapCoins', title: 'Florida Man', rule: 'Swap coins with a random player.', joke: 'Read the headline. Then read it again.' },
]

export function eventCard(id: string): EventCard | null {
  return EVENTS.find((e) => e.id === id) ?? null
}
