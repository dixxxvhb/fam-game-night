import type { SimEvent } from '../sim'
import type { TrackId } from '../contract'

/**
 * Everything Mingo says on the TV during Turnpike. Mingo runs the Turnpike now: theme park
 * employee, hour eleven of a double. Deadpan, short, Florida. No em dashes, no emojis.
 * A line is a list of parts; `who` parts render as the racer's colored name.
 */
export type Part = string | { who: string; pos?: boolean }
export type Line = Part[]

const n = (who: string): Part => ({ who })
const of = (who: string): Part => ({ who, pos: true })

/** Feed line for a sim event, or null for events the feed skips. `k` varies the wording. */
export function feedLine(e: SimEvent, k: number): Line | null {
  switch (e.t) {
    case 'lead':
      return [
        [n(e.id), ' takes the lead. Enjoy it.'],
        [n(e.id), ' is in front. For now.'],
        ['New leader: ', n(e.id), '. Somebody check the tape.'],
        [n(e.id), ' moves to first. Mingo is contractually impressed.'],
      ][k % 4]
    case 'hit':
      if (e.kind === 'coconut' && e.by && e.by !== e.id) return [[n(e.by), ' coconutted ', n(e.id), '. Rude. Effective.'], [n(e.id), ' took a coconut from ', n(e.by), '.']][k % 2]
      if (e.kind === 'coconut') return [n(e.id), ' hit their own coconut. It came back.']
      if (e.kind === 'pelican' && e.by) return [[n(e.by), ' sent a pelican after ', n(e.id), '. The pelican was happy to help.'], ['A pelican found ', n(e.id), '. Courtesy of ', n(e.by), '.']][k % 2]
      if (e.kind === 'mango' && e.by === e.id) return [n(e.id), ' slipped on their own mango. Classic.']
      if (e.kind === 'mango' && e.by) return [[n(e.id), ' ate ', of(e.by), ' mango.'], [n(e.id), ' found ', of(e.by), ' mango the hard way.']][k % 2]
      if (e.kind === 'mango') return [n(e.id), ' hit a mango. It was just lying there.']
      if (e.kind === 'hurricane') return [n(e.id), ' made landfall.']
      if (e.kind === 'wave') return [['The Gulf got ', n(e.id), '.'], [n(e.id), ' got a wave. Free rinse.']][k % 2]
      if (e.kind === 'gator') return [['The gator got ', n(e.id), '. He was here first.'], ['Florida claims ', n(e.id), '.'], [n(e.id), ' met the gator. The gator is fine.']][k % 3]
      return null
    case 'block':
      return [of(e.id), ' floatie ate it.']
    case 'storm':
      return [[n(e.by), ' called in a storm. Afternoon, right on schedule.'], [n(e.by), ' brought the 4 PM storm. Everybody else, slow down.']][k % 2]
    case 'hurricane':
      return e.target ? [n(e.by), ' sent a hurricane at ', n(e.target), '. Board up.'] : [n(e.by), ' sent a hurricane. Board up.']
    case 'bugs':
      return [[n(e.by), ' let the love bugs out. Windshields everywhere weep.'], ['Love bugs, courtesy of ', n(e.by), '. Nobody can see. Normal May.']][k % 2]
    case 'rocket':
      return e.ok ? [[n(e.id), ' rocket started. Show-off.'], [n(e.id), ' nailed the start. Mingo saw it. Mingo will not say anything nice.']][k % 2] : null
    case 'liftoff':
      return ['Liftoff. Please do not look directly at the rocket.']
    case 'finish':
      if (e.place === 1) return [[n(e.id), ' wins it. Mingo is required to say congratulations.'], [n(e.id), ' takes the checkered flag. Somebody get them a lanyard.']][k % 2]
      return null
    case 'finalLap':
      return null
  }
  return null
}

/** What Mingo says on the cup card. */
export const CUP_LINES: Record<string, string[]> = {
  sunshine: [
    'Four tracks. Three laps each. Keep all limbs inside the kart. Or don\'t. I\'m not your mom.',
    'Welcome to the Sunshine Cup. The sunshine is not included. It is just always there.',
  ],
  hurricane: [
    'The Hurricane Cup. We did not name it. Insurance named it.',
    'Four tracks, all near water. Please know where your floatie is.',
  ],
}

/** Under the light tree during the countdown. */
export const START_LINES = [
  'Go right before GO for a rocket start. Too early is a sputter.',
  'Rocket start: wait for the last light. Not the first one. The last one.',
  'Engines on. Phones up. Nobody hit the flamingo.',
]

/** Under each track's title card. Track blurbs live in tracks.ts; this is the rule of the road. */
export const TRACK_TIPS: Record<TrackId, string> = {
  oval: 'Boost pads on the straights. The statue is not a shortcut.',
  eight: 'The bridge is the fast line. The underpass is the other line.',
  swamp: 'Stay out of the water. The gator lunges from the left bank.',
  night: 'The barrels move every lap. The cones do not care.',
  pier: 'Waves hit the end of the pier. Watch the white water.',
  coaster: 'Hit the ramp over the lazy river. Tap HOP in the air for a trick.',
  keys: 'Wind gusts push you sideways. The arrows warn you first.',
  launch: 'The rocket goes up on lap two. The smoke slows everybody.',
}

/** Results card, by how the race went for the winner. */
export const RESULT_LINES = [
  'Results are final. Complaints go in the lazy river.',
  'Mingo has reviewed the tape. Mingo did not watch the tape.',
  'Everybody gets a participation lanyard. Not really.',
  'Points are in. Some of you should stretch.',
]

export const PODIUM_LINES = [
  'Your champion. Please hold applause until Mingo clocks out.',
  'The trophy is real. The gold is spray paint. The glory is real.',
  'A winner. Everyone else, the gift shop is to your left.',
]
