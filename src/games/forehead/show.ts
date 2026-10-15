import type { Call, ForeheadState } from './logic'
import type { GuesserMood } from './club'

/** How long a got/pass stays "just happened" for the show (flash, flying card). */
export const MOMENT_MS = 1000

/** The last call, while it is still a moment (the flash, the flying card). */
export function momentOf(s: ForeheadState, now: () => number): Call | null {
  const last = s.calls.at(-1)
  if (!last || (s.stage !== 'play' && s.stage !== 'turnEnd')) return null
  const age = now() - last.at
  return age >= 0 && age < MOMENT_MS ? last : null
}

export function moodFor(s: ForeheadState, moment: Call | null): GuesserMood {
  if (s.stage === 'turnEnd') {
    const got = s.calls.filter((c) => c.got).length
    return got >= 3 ? 'bow' : got === 0 ? 'sad' : 'happy'
  }
  if (moment) return moment.got ? 'happy' : 'oops'
  return 'think'
}

