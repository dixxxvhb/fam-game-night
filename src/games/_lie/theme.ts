import { useEffect } from 'react'
import type { CueId } from './audio'

/**
 * Each lie game lives in its own world. Bluff is a late-night game show hosted by Polly,
 * a vintage polygraph machine with opinions. Fake Word is an old dictionary on a library
 * desk, edited by Webster, an owl in reading glasses. The rules are the same; the skin,
 * the host, the stamps and the music are not.
 */
export type ThemeId = 'bluff' | 'word'

export type HostMood = 'idle' | 'talk' | 'nervous' | 'shock' | 'smug' | 'cheer'

export interface LieTheme {
  id: ThemeId
  title: string
  host: string
  /** Stamp words. */
  stampLie: string
  stampHouse: string
  stampTruth: string
  /** What the truth is called on screen. */
  truthName: string
  cues: { lie: CueId; pick: CueId; reveal: CueId; final: CueId }
  fonts: string
  lines: {
    intro: (round: number, total: number, factor: number) => string
    writing: string[]
    allIn: string
    pick: string[]
    lieHeld: string[]
    lieOut: (author: string) => string
    house: string[]
    truthWait: string
    truthFound: string[]
    nobody: string[]
    tally: string[]
    final: (winner: string) => string
  }
}

const BLUFF: LieTheme = {
  id: 'bluff',
  title: 'Bluff',
  host: 'Polly',
  stampLie: 'LIE',
  stampHouse: 'HOUSE LIE',
  stampTruth: 'TRUE',
  truthName: 'The truth',
  cues: { lie: 'bluff-lie', pick: 'bluff-pick', reveal: 'bluff-reveal', final: 'bluff-final' },
  fonts: 'https://fonts.googleapis.com/css2?family=Bungee+Inline&family=Bungee+Shade&display=swap',
  lines: {
    intro: (r, total, f) =>
      r === total - 1 ? 'Last one. Triple points. I am calibrated and ready to judge.'
        : f === 2 ? 'Double points. My needle is already twitching.'
          : r === 0 ? 'Good evening. I am Polly, and I can tell when you are lying. Mostly.'
            : 'Another true fact. Another chance to disappoint me.',
    writing: ['Write a lie. Make it smell true.', 'I see you typing. I see everything.', 'Short lies fool more people. That is free advice.', 'Do not write the truth. I will know.'],
    allIn: 'Everybody lied. Wonderful. Let us see who believes it.',
    pick: ['One of these is true. The rest are your friends lying to you.', 'Pick the truth. Trust no one. Not even yourself.', 'Take your time. Actually, do not.'],
    lieHeld: ['Did you fall for this one?', 'Somebody believed this.', 'Hm. Let me run this one.'],
    lieOut: (a) => `${a} wrote that. I am not even surprised.`,
    house: ['That one was mine. I lie for fun.', 'House lie. You fell for a machine.'],
    truthWait: 'And the truth is...',
    truthFound: ['Somebody actually knew. Gross.', 'The truth, found. My needle is calm.'],
    nobody: ['Nobody found it. The lies win.', 'Not one of you. Incredible.'],
    tally: ['Here is the damage.', 'Points, as I see them.'],
    final: (w) => `${w} wins. I would like to run a test on them.`,
  },
}

const WORD: LieTheme = {
  id: 'word',
  title: 'Fake Word',
  host: 'Webster',
  stampLie: 'FORGERY',
  stampHouse: 'HOUSE FORGERY',
  stampTruth: 'AUTHENTIC',
  truthName: 'The real meaning',
  cues: { lie: 'word-lie', pick: 'word-pick', reveal: 'word-reveal', final: 'word-final' },
  fonts: 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,700;0,9..144,900;1,9..144,400;1,9..144,700&family=Caveat:wght@600;700&display=swap',
  lines: {
    intro: (r, total, f) =>
      r === total - 1 ? 'Final entry. Triple points. Do try to sound educated.'
        : f === 2 ? 'Double points. Sharpen your quills.'
          : r === 0 ? 'Welcome to the stacks. I am Webster. I have read every word. You have not.'
            : 'Another real word. Another chance to embarrass yourselves.',
    writing: ['Define it. Sound like a dictionary.', 'Short and dry reads as real.', 'Avoid the truth. I will notice.', 'Use a semicolon. Dictionaries love those.'],
    allIn: 'All entries submitted. To the reading room.',
    pick: ['One definition is genuine. The rest are forgeries.', 'Choose wisely. Or at least choose.', 'I already know the answer. Obviously.'],
    lieHeld: ['Someone found this convincing.', 'This entry fooled a reader.', 'Hm. Let me check the archive.'],
    lieOut: (a) => `A forgery by ${a}. Rather well done.`,
    house: ['My own forgery. I get bored up here.', 'House forgery. You trusted an owl.'],
    truthWait: 'The genuine article...',
    truthFound: ['A scholar among us. Barely.', 'Correct. I am almost proud.'],
    nobody: ['Not one of you knew it. Shameful.', 'The forgers win this round.'],
    tally: ['The ledger, updated.', 'Entered into the record.'],
    final: (w) => `${w} takes the prize. Honorary lexicographer.`,
  },
}

export const THEMES: Record<ThemeId, LieTheme> = { bluff: BLUFF, word: WORD }

export function themeFor(kind: 'blank' | 'word', id?: ThemeId): LieTheme {
  return THEMES[id ?? (kind === 'word' ? 'word' : 'bluff')]
}

/** A deterministic pick from a list of lines. */
export function line(list: string[], k: number): string {
  return list[((k % list.length) + list.length) % list.length]
}

const loaded = new Set<string>()
/** Load the theme's display fonts once (Google Fonts, like the rest of the app). */
export function useThemeFonts(t: LieTheme) {
  useEffect(() => {
    if (loaded.has(t.fonts) || typeof document === 'undefined') return
    loaded.add(t.fonts)
    const l = document.createElement('link')
    l.rel = 'stylesheet'
    l.href = t.fonts
    document.head.appendChild(l)
  }, [t.fonts])
}
