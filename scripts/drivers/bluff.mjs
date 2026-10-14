// QA driver for Bluff (and, through playLieGame, Fake Word). Plays a whole game the way
// people would: one player types the truth first and gets bounced, one taps "Lie for me",
// one writes a long lie (wrapping check). Everyone picks, hearts a lie, and the reveal is
// shot beat by beat. In together mode it restarts the game as Short from a phone first
// (qa-room starts with defaults); apart mode has no abort, so it plays the default Normal.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const LIES = {
  bluff: ['a haunted accordion', 'his own dentist', 'competitive yodeling', 'an angry goose', 'tax fraud', 'a single grape', 'Nicolas Cage', 'soup'],
  fakeword: [
    'a small spoon for eating soup sideways',
    'to sneeze while trying to look dignified',
    'the smell of a library at closing time',
    'a person who claps when the plane lands',
    'to argue with a vending machine',
    'a fear of being looked at by ducks',
  ],
}
const LONG = {
  bluff: 'a raccoon wearing a tiny cowboy hat and holding a briefcase',
  fakeword: 'a Victorian device for measuring how disappointed your grandmother is in you, in real time',
}

function bank(game) {
  const file = resolve(game === 'bluff' ? 'src/games/bluff/facts.ts' : 'src/games/fakeword/words.ts')
  const src = readFileSync(file, 'utf8')
  const out = []
  if (game === 'bluff') {
    for (const m of src.matchAll(/q: "((?:[^"\\]|\\.)*)", truth: "((?:[^"\\]|\\.)*)"/g)) {
      const [before, after] = JSON.parse(`"${m[1]}"`).split('____')
      out.push({ before: before.trim(), after: after.trim(), truth: JSON.parse(`"${m[2]}"`) })
    }
  } else {
    for (const m of src.matchAll(/word: "([^"]*)", pos: "[^"]*", truth: "((?:[^"\\]|\\.)*)"/g)) out.push({ word: m[1], truth: JSON.parse(`"${m[2]}"`) })
  }
  return out
}

export async function playLieGame({ tv, phones, shot, wait }, { game, name }) {
  const facts = bank(game)
  const until = async (fn, ms = 20000, step = 250) => {
    const end = Date.now() + ms
    while (Date.now() < end) { if (await fn()) return true; await wait(step) }
    return false
  }
  const has = async (p, text) => (await p.getByText(text, { exact: false }).count()) > 0
  const inLie = async (p) => (await p.locator('textarea').count()) > 0
  const inPick = async (p) => (await p.locator('main button[aria-label]:not([aria-pressed])').count()) > 0 && !(await inLie(p))
  const atFinal = async (p) => (await has(p, "That's the game")) || (await p.getByRole('button', { name: 'Next game' }).count()) > 0

  async function truthOn(p) {
    const text = await p.locator('main').innerText()
    if (game === 'bluff') return facts.find((f) => f.before && text.includes(f.before) && text.includes(f.after))?.truth
    const lines = text.split('\n').map((l) => l.trim())
    return facts.find((f) => lines.includes(f.word))?.truth
  }

  // Together: restart as Short from a phone. qa-room started the default (Normal).
  if (tv) {
    await until(() => inLie(phones[0]))
    await tv.getByRole('button', { name: 'End game' }).click()
    await until(async () => (await phones[0].locator('button[aria-expanded]').count()) > 0)
    await phones[0].locator('button[aria-expanded]', { hasText: new RegExp(`^${name}`, 'i') }).first().click()
    await phones[0].getByRole('button', { name: 'Short', exact: true }).click()
    await shot('shelf-short')
    await phones[0].getByRole('button', { name: `Start ${name}` }).click()
  }

  const lies = LIES[game]
  for (let round = 0; round < 8; round++) {
    const ok = await until(async () => (await inLie(phones[0])) || (await atFinal(phones[0])), 30000)
    if (!ok || (await atFinal(phones[0]))) break
    const full = round === 0 || round === 4 || round === 6
    await until(async () => { for (const p of phones) if (!(await inLie(p))) return false; return true }, 10000)
    await wait(400)
    await shot(`r${round + 1}-lie`)

    // Player 1: the truth first (bounced), then a real lie.
    const truth = await truthOn(phones[0])
    if (round === 0 && truth) {
      await phones[0].locator('textarea').fill(truth)
      await phones[0].getByRole('button', { name: 'Lock it in' }).click()
      await until(() => has(phones[0], "That's actually the truth"), 5000)
      await shot(`r${round + 1}-truth-rejected`)
    } else if (round === 0) {
      console.log('driver: could not find the truth on screen for the rejection check')
    }
    await phones[0].locator('textarea').fill(lies[round % lies.length])
    await phones[0].getByRole('button', { name: 'Lock it in' }).click()

    // Player 2: "Lie for me" (a cop-out) on the first round, otherwise a lie.
    if (round === 0) {
      await phones[1].getByRole('button', { name: 'Lie for me' }).click()
      await wait(300)
      await shot(`r${round + 1}-lie-for-me`)
    } else {
      await phones[1].locator('textarea').fill(lies[(round + 3) % lies.length])
    }
    await phones[1].getByRole('button', { name: 'Lock it in' }).click()
    await wait(700)
    if (full) await shot(`r${round + 1}-waiting`)

    // Player 3: the long one.
    if (phones[2]) {
      await phones[2].locator('textarea').fill(round % 2 === 0 ? LONG[game] : lies[(round + 5) % lies.length])
      await phones[2].getByRole('button', { name: 'Lock it in' }).click()
    }

    // Pick: player 1 takes the first open answer, the others spread out.
    await until(async () => { for (const p of phones) if (!(await inPick(p))) return false; return true }, 15000)
    await wait(500)
    await shot(`r${round + 1}-pick`)
    for (let i = 0; i < phones.length; i++) {
      const open = phones[i].locator('main button[aria-label]:not([disabled]):not([aria-pressed])')
      const n = await open.count()
      if (!n) continue
      await open.nth((i * 2 + round) % n).click()
      await wait(250)
      if (i === 0 && full) await shot(`r${round + 1}-picked`)
    }

    // Reveal: shoot the beats, heart a lie or two along the way.
    await until(async () => (await phones[0].locator('main button[aria-pressed]').count()) > 0 || (await has(phones[0], 'No lies to love')), 8000)
    const liked = new Set()
    for (let beat = 0; beat < 16; beat++) {
      // Two of the three heart a lie as soon as their phone shows the list.
      for (const p of phones.slice(1)) {
        if (liked.has(p)) continue
        const hearts = p.locator('main button[aria-pressed="false"]')
        if (await hearts.count()) { await hearts.first().click(); liked.add(p) }
      }
      if (!full && beat > 0 && beat % 3 !== 0) { await wait(1400); if (await inLie(phones[0]) || await atFinal(phones[0])) break; continue }
      await shot(`r${round + 1}-reveal-${beat}`)
      await wait(1400)
      if ((await inLie(phones[0])) || (await atFinal(phones[0]))) break
    }
  }

  await until(() => has(phones[0], "That's the game"), 15000)
  await wait(600)
  await shot('final')
  await until(async () => (await phones[0].getByRole('button', { name: 'Next game' }).count()) > 0, 15000)
  await wait(1200)
  await shot('results')
  await phones[0].getByRole('button', { name: 'Next game' }).click()
  await wait(800)
  await phones[0].getByRole('button', { name: 'End the night' }).click()
  await wait(1200)
  await shot('summary')
}

export default async function (env) {
  await playLieGame(env, { game: 'bluff', name: 'Bluff' })
}
