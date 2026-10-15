/**
 * Chip Doubloon's lines. He says everything like it is the best news of your life. Pure: the
 * same moment always picks the same line on every screen (the seed comes from game state).
 * {name} and {cat} are filled in.
 */

export type LineKind =
  | 'open' | 'steal' | 'round' | 'last'
  | 'pick' | 'pickSolo' | 'spin' | 'landed'
  | 'question' | 'right' | 'allRight' | 'allWrong' | 'stole'
  | 'finalSpin' | 'wager' | 'finalQ' | 'finalRight' | 'finalWrong' | 'done'

export const LINES: Record<LineKind, string[]> = {
  open: [
    'Welcome to Trivia Night LIVE! I am Chip Doubloon, and these are my real teeth!',
    'Good evening, contestants! Tonight is brought to you by a timeshare in Kissimmee!',
    'It is Trivia Night LIVE! Nobody in this room has ever been more excited than me!',
  ],
  steal: [
    'The steal round! First right answer takes it all. Everyone else gets half. That is just math!',
    'Round two! Fast thumbs win! Slow thumbs get half! I love both kinds of thumbs!',
  ],
  round: [
    'Another round! Points for being right, more points for being fast!',
    'New round, same teeth! Let us go!',
  ],
  last: [
    'Triple points! Comebacks happen here! So do meltdowns!',
    'Last round before the final! Everything counts triple! Breathe through your nose!',
  ],
  pick: [
    '{name}, you are in last place! Wonderful! Pick a category!',
    '{name} gets the wheel! Pity is a strategy!',
    'Last place picks! {name}, this is your moment! Do not waste it!',
    '{name}, the wheel is yours! Choose wisely, or out of spite!',
  ],
  pickSolo: [
    'You are in first AND last place! Pick a category!',
  ],
  spin: [
    'Spin that wheel! It is purely decorative! I love it so much!',
    'Here she goes! Fourteen hundred dollars of plywood!',
    'Round and round! Like a ceiling fan in Ocala!',
  ],
  landed: [
    '{cat}! What a wedge!',
    '{cat}! The wheel has spoken! It cannot be reasoned with!',
    '{cat}! I had a feeling! I always have a feeling!',
  ],
  question: [
    'Lock it in!',
    'Fast answers score more!',
    'Do not overthink it! Or do! Up to you!',
  ],
  right: [
    '{name} got it! Somebody cue the confetti! It is automatic!',
    '{name}! Correct! I could cry! I might!',
    'That is right, {name}! Take a bow! A small one!',
  ],
  allRight: [
    'Everybody got it! That is fraud, but I love it!',
    'All correct! The judges are suspicious! We do not have judges!',
  ],
  allWrong: [
    'Nobody! Not one of you! I have never been prouder!',
    'Zero for everyone! A clean sweep of nothing!',
    'Wow! Wrong across the board! Bold! Very bold!',
  ],
  stole: [
    '{name} stole it! Fastest thumbs in the state!',
    'A steal by {name}! Everyone else right gets half!',
  ],
  finalSpin: [
    'The final round! One hard question! Every point you own is on the table!',
  ],
  wager: [
    'Push your chips in! These are not real chips! I checked!',
    'Wager some, wager all! Fortune favors the reckless!',
  ],
  finalQ: [
    'One question! All the points! None of it real!',
    'Wagers are locked! No refunds! Never refunds!',
  ],
  finalRight: [
    '{name} doubled up! What a night! What a smile! Mine, I mean!',
    '{name} called it! Somebody get them a sport coat!',
  ],
  finalWrong: [
    'Oh no! Oh my! Anyway! That is the show!',
    'Wrong! All of it! Gone! Like a beach umbrella in August!',
  ],
  done: [
    'That is our show! Tip your bartender! We do not have one!',
  ],
}

/** One line for a moment. `seed` is any number from state (round, question...), so all screens agree. */
export function chipLine(kind: LineKind, seed: number, vars: { name?: string; cat?: string } = {}): string {
  const pool = LINES[kind]
  const line = pool[Math.abs(Math.floor(seed)) % pool.length]
  return line.replace(/\{name\}/g, vars.name ?? 'Contestant').replace(/\{cat\}/g, vars.cat ?? 'Random')
}

/** What Chip says at a reveal, and about whom. */
export function revealLine(
  last: { correct: number; picks: Record<string, number | null>; first: string | null; steal: boolean },
  players: string[],
  final: boolean,
): { kind: LineKind; who: string | null } {
  const right = players.filter((id) => last.picks[id] === last.correct)
  if (final) return right.length ? { kind: 'finalRight', who: right[0] } : { kind: 'finalWrong', who: null }
  if (!right.length) return { kind: 'allWrong', who: null }
  if (last.steal && last.first && players.length > 1) return { kind: 'stole', who: last.first }
  if (right.length === players.length && players.length > 1) return { kind: 'allRight', who: null }
  return { kind: 'right', who: right[0] }
}
