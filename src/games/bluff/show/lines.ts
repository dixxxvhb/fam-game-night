// What Polly says in the interrogation room. Deadpan, short, no em dashes.
import { line } from '../../_lie/theme'

export const POLLY = {
  category: ['Pick a line of questioning. I am not picky. I am a machine.', 'Choose a topic. Choose wisely. I am recording.', 'You pick the subject. I pick the liar.'],
  writing: ['Write a lie. Make it smell true.', 'I see you typing. I see everything.', 'Short lies fool more people. That is free advice.', 'Do not write the truth. I will know.'],
  aboutIntro: (name: string) => `${name}, please take a seat. Tell me the truth. Your friends will not.`,
  aboutWriting: (name: string) => [`${name} is telling the truth. Everyone else, lie about ${name}.`, `I am watching ${name}'s pulse. It is elevated.`, `Lie about ${name}. Make it a lie ${name} would tell.`],
  aboutPick: (name: string) => [`One of these is really about ${name}. Find it.`, `${name}, stay very still. Your friends are deciding.`],
  allIn: 'Everybody lied. Wonderful. Let us see who believes it.',
  pick: ['One of these is true. The rest are your friends lying to you.', 'Pick the truth. Trust no one. Not even yourself.', 'Take your time. Actually, do not.'],
  lieHeld: ['Did you fall for this one?', 'Somebody believed this.', 'Hm. Let me run this one.'],
  lieOut: (a: string) => `${a} wrote that. I am not even surprised.`,
  house: ['That one was mine. I lie for fun.', 'House lie. You fell for a machine.'],
  truthWait: 'And the truth is...',
  truthFound: ['Somebody actually knew. Gross.', 'The truth, found. My needle is calm.'],
  aboutFound: (name: string) => `They know you, ${name}. That is either sweet or a problem.`,
  nobody: ['Nobody found it. The lies win.', 'Not one of you. Incredible.'],
  aboutNobody: (name: string) => `Nobody believed the real ${name}. Think about that.`,
  skipped: (name: string) => `${name} pleaded the fifth. Noted. Permanently.`,
  tally: ['Here is the damage.', 'Points, as I see them.'],
  verdict: (w: string) => `My verdict: ${w}. I would like to run more tests.`,
}

export { line }
