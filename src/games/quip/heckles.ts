/**
 * The House talks. Short, deadpan, a little smug. Picked by a stable index (round, prompt)
 * so every screen shows the same line and it never changes mid-moment.
 */
export type Moment =
  | 'intro1' | 'intro2' | 'intro3' | 'waiting' | 'allIn' | 'vote' | 'reveal'
  | 'houseWins' | 'beaten' | 'tied' | 'sweep' | 'silence' | 'scores' | 'finalWon' | 'finalLost'

const LINES: Record<Moment, string[]> = {
  intro1: [
    "Two-drink minimum. I'm the drinks.",
    "I wrote my answers this morning. They're fine.",
    "Be funnier than a building. Low bar. Allegedly.",
  ],
  intro2: [
    "Points double. So does my confidence.",
    "Round two. I took notes on all of you.",
    "Same rules. Bigger numbers. Same me.",
  ],
  intro3: [
    "Last Quip. I saved my best one.",
    "Three votes each. Spread them on me.",
    "Final round. Tip your House.",
  ],
  waiting: [
    "Take your time. I own the place.",
    "I finished hours ago.",
    "Somebody's typing. I can hear it.",
  ],
  allIn: ["Everybody is in. Brave.", "All in. Let's see it."],
  vote: [
    "Mine's the funny one. You'll know.",
    "Vote with your heart. Then vote for me.",
    "I'd vote for me, but I'm not allowed.",
    "One of these is mine. No pressure.",
  ],
  reveal: ["Who wrote what. Brace yourselves.", "Let's find out who to blame."],
  houseWins: [
    "I'd like to thank me.",
    "Nobody laughs at a building. Except tonight.",
    "That one was mine. Obviously.",
    "Tip your waitstaff. Pay your House.",
  ],
  beaten: [
    "Fine. That was funny.",
    "Rude. Accurate, but rude.",
    "I'm putting that on my wall. Of shame.",
  ],
  tied: ["A tie. I'll allow it.", "Shared custody of the laugh."],
  sweep: ["Mic drop. Somebody sweep that up. Not me.", "Every vote. Show-off."],
  silence: ["Silence. My favorite sound.", "Crickets. They pay rent here too."],
  scores: [
    "I'm on the leaderboard. I'm also the building it's in.",
    "Points are temporary. Real estate is forever.",
    "Check the board. Then check yourselves.",
  ],
  finalWon: ["I won. Nobody tell them.", "House always wins. It's in the name."],
  finalLost: ["Enjoy it. I close at two.", "Fine. You can have the poster."],
}

export function heckle(m: Moment, k = 0): string {
  const list = LINES[m]
  return list[((k % list.length) + list.length) % list.length]
}
