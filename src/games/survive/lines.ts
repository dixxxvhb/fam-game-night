// The host's voice on the TV. Dry, a little mean to the dead, never gory.
// {n} is a name, {names} a list of names.

export const INTRO =
  'Answer right and you live. Answer wrong and you go in a trap. Lose the trap and you are a ghost. Ghosts still play.'

export const DEATH = [
  "{n} has joined the ghosts. They're thrilled.",
  '{n} is a ghost now. Same personality, less pulse.',
  '{n} is out. The ghosts saved {n} a seat.',
  '{n} did not survive. The quiz feels nothing.',
  'Say hi to Ghost {n}. Ghost {n} still has to answer questions.',
  '{n} has been ghosted. By a quiz.',
  '{n} is see-through now. Honestly, it is a look.',
  '{n} lost the trap. {n} can still haunt the rest of you.',
]

export const SURVIVE = [
  '{n} lives. The quiz is disappointed.',
  '{n} survived. Do not get comfortable.',
  '{n} made it out. Barely, but it counts.',
  '{n} is still alive. Annoying, but fine.',
]

export const ALL_RIGHT = [
  'Everyone got it. Boring. Next.',
  'All correct. The trap goes hungry.',
  'Nobody dies this round. Try harder to be wrong.',
]

export const ALL_WRONG = [
  'Not one of you. Impressive, in a sad way.',
  'Everyone missed it. The trap is going to need a bigger room.',
]

export const SOME_WRONG = [
  '{names}: this way to the trap.',
  'Wrong answers have consequences. {names}, you are up.',
  '{names}, step into the trap. Mind the floor.',
]

export const GHOSTS_KNOW = 'The ghosts know things.'
export const ONLY_GHOSTS = 'Only ghosts left. Nobody can die, which is its own kind of sad.'

export const FINALE =
  'Race to the exit. Sort each answer to the right side to move. The living start ahead. The dead start with a grudge.'

export const REVIVE = [
  '{n} caught the living and is alive again. Nobody asked for this.',
  '{n} is back from the dead. Act normal.',
]

export const ESCAPE = '{n} escaped. Everyone else lives here now.'
export const PHOTO_FINISH = 'Photo finish. {n} ran the furthest past the door.'
export const TIE_ESCAPE = '{names} escaped at the same time. Nobody is happy about it.'
export const GHOST_ESCAPE = '{n} died on question {q} and still won. Let that sink in.'

export function fill(line: string, vars: Record<string, string | number>): string {
  return line.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''))
}

export function pickLine(list: string[], random: () => number): string {
  return list[Math.floor(random() * list.length)] ?? list[0]
}

export function names(list: string[]): string {
  if (list.length <= 1) return list[0] ?? ''
  if (list.length === 2) return `${list[0]} and ${list[1]}`
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`
}
