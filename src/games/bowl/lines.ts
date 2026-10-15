import type { BowlResult } from './logic'

/**
 * Mingo, working the shoe counter at Gator Lanes on hour eleven of a double. One deadpan line
 * per ball. Picked by throw number, so every screen shows the same one. No em dashes.
 */

export const MINGO: Record<'strike' | 'turkey' | 'spare' | 'split' | 'gutter' | 'miss' | 'count' | 'nine' | 'auto', string[]> = {
  strike: [
    'Strike. I will tell my manager. He will not care.',
    'All ten. The pinsetter needs a minute.',
    'That is a strike. The lane is not going to calm down about it.',
    'Clean. Like the shoes. Not like the shoes.',
    'Strike. Somewhere a ceiling fan applauds.',
    'Big ball. Big pins. Big deal. Fine, it is a big deal.',
    'Strike. I have seen two today. You are the second.',
    'Strike. Please do not ask for a free pitcher.',
  ],
  turkey: [
    'Three in a row. That is a turkey. We do not serve turkey.',
    'Turkey. I am legally required to ring a bell. I lost the bell.',
    'That is a lot of strikes for a Tuesday.',
    'Okay. Okay. I am paying attention now.',
  ],
  spare: [
    'Spare. Cleaned up the mess. Wish you worked here.',
    'Spare. The pins have filed a complaint.',
    'Picked it up. Like a dropped corn dog. Mostly fine.',
    'Spare. Very responsible. Your mother would be proud.',
    'That is a spare. I will allow it.',
    'Spare. The lane said thank you. Quietly.',
  ],
  split: [
    'A split. Pins that far apart are in a custody battle.',
    'That split is wider than I-4 at rush hour.',
    'Split. Thoughts and prayers.',
    'Those two pins are not speaking to each other.',
    'A split. Good luck. I mean that zero percent.',
  ],
  gutter: [
    'Gutter. It wanted to see the gutter. Let it.',
    'Into the ditch. Like a rental car in a hurricane.',
    'Gutter. The bumpers are for kids. And for you, now.',
    'The ball took the scenic route.',
    'Gutter. I have seen worse. I cannot remember when.',
    'That ball is in a better place. The gutter.',
  ],
  miss: [
    'Touched nothing. Very respectful of the pins.',
    'Zero. The pins did not even feel a breeze.',
    'Missed it all. Bold.',
  ],
  count: [
    'Some pins. Not all pins. Fine.',
    'That is a number. I will write it down.',
    'Pins fell. My shift continues.',
    'Respectable. Nobody here is impressed. We are tired.',
    'You knocked some over. Good for you. Genuinely.',
    'Pins down. Shoes still rented.',
  ],
  nine: [
    'Nine. So close. The ten pin is laughing at you.',
    'One standing. It wants to be noticed.',
    'Nine. The last one is a survivor. Respect it.',
  ],
  auto: [
    'Out of time. I threw it for you. Do not tell anyone.',
    'You stalled. The lane got bored and bowled.',
  ],
}

export const PICK_LINES = [
  'Shoes are rented. Lanes are glowing. Pick a bowler.',
  'Everybody gets a critter. Nobody gets a refund.',
  'Cosmic bowling. It is just bowling with the lights off.',
]

export const PODIUM_LINES = [
  'That is the game. Return your shoes. Spray them first.',
  'Good game. The lanes close never. I close at two.',
  'You all bowled. Some of you bowled well.',
  'Congratulations. There is no trophy. There is a coupon.',
]

export function pick<T>(list: T[], n: number): T {
  return list[((n % list.length) + list.length) % list.length]
}

/** Mingo's line for a result. */
export function mingoLine(r: BowlResult, auto = false): string {
  if (auto && r.kind !== 'strike' && r.kind !== 'spare') return pick(MINGO.auto, r.n)
  if (r.kind === 'strike') return (r.streak ?? 1) >= 3 ? pick(MINGO.turkey, r.n) : pick(MINGO.strike, r.n * 3)
  if (r.kind === 'count' && r.pins === 9) return pick(MINGO.nine, r.n)
  return pick(MINGO[r.kind], r.n * 7)
}

/** The extra-big word over a strike streak. */
export function streakWord(streak: number): string | null {
  if (streak === 2) return 'DOUBLE'
  if (streak === 3) return 'TURKEY'
  if (streak === 4) return 'FOUR-BAGGER'
  if (streak === 5) return 'FIVE-BAGGER'
  if (streak >= 6) return `${streak} IN A ROW`
  return null
}
