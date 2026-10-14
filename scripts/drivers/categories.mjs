// QA driver for Categories: three rounds through the phones. Round 1 covers every rule
// on camera: a duplicate, an alliteration, a wrong letter, an article, a blank, a
// challenge that throws an answer out, and thumbs up. Rounds 2 and 3 go quicker.
const WORDS = {
  A: ['Apple', 'Anchor', 'Avocado', 'Alligator', 'Acrobat', 'Antelope', 'Arugula', 'Atlas', 'Accordion', 'Asteroid'],
  B: ['Banana', 'Bagel', 'Balloon', 'Beaver', 'Bowling', 'Biscuit', 'Blender', 'Burrito', 'Bongo', 'Broccoli'],
  C: ['Cactus', 'Candle', 'Canoe', 'Cheetah', 'Cupcake', 'Coconut', 'Cello', 'Crayon', 'Comet', 'Celery'],
  D: ['Donut', 'Dolphin', 'Daisy', 'Drum', 'Dragon', 'Dumpling', 'Denim', 'Desk', 'Dingo', 'Dill'],
  E: ['Eagle', 'Eggplant', 'Elbow', 'Elevator', 'Emerald', 'Envelope', 'Eclair', 'Engine', 'Eel', 'Easel'],
  F: ['Falcon', 'Fajita', 'Feather', 'Ferret', 'Fiddle', 'Flamingo', 'Fudge', 'Fern', 'Fork', 'Frisbee'],
  G: ['Giraffe', 'Garlic', 'Guitar', 'Goblin', 'Gumbo', 'Glitter', 'Gecko', 'Grape', 'Gazebo', 'Gnocchi'],
  H: ['Hammock', 'Hamster', 'Harp', 'Hotdog', 'Hippo', 'Helmet', 'Honey', 'Hummus', 'Hula', 'Hedgehog'],
  I: ['Igloo', 'Iguana', 'Icicle', 'Ink', 'Iris', 'Ivy', 'Impala', 'Island', 'Ibex', 'Icing'],
  J: ['Jaguar', 'Jelly', 'Jacket', 'Jukebox', 'Jasmine', 'Jet', 'Jicama', 'Juggler', 'Jade', 'Jambalaya'],
  K: ['Kangaroo', 'Kayak', 'Kettle', 'Kiwi', 'Kazoo', 'Koala', 'Kale', 'Kimono', 'Kite', 'Ketchup'],
  L: ['Lemon', 'Llama', 'Lantern', 'Lobster', 'Lasagna', 'Lizard', 'Ladder', 'Lute', 'Lilac', 'Locket'],
  M: ['Mango', 'Moose', 'Muffin', 'Marimba', 'Magnet', 'Meerkat', 'Mitten', 'Mustard', 'Mosaic', 'Mermaid'],
  N: ['Nacho', 'Narwhal', 'Necklace', 'Noodle', 'Nectarine', 'Nutmeg', 'Newt', 'Napkin', 'Nebula', 'Nugget'],
  O: ['Octopus', 'Olive', 'Otter', 'Oboe', 'Omelet', 'Orchid', 'Ostrich', 'Oven', 'Oyster', 'Oatmeal'],
  P: ['Pancake', 'Penguin', 'Piano', 'Pretzel', 'Puffin', 'Pumpkin', 'Parrot', 'Paprika', 'Pillow', 'Pickle'],
  R: ['Raccoon', 'Radish', 'Rocket', 'Ravioli', 'Robin', 'Ruby', 'Raft', 'Rhubarb', 'Ribbon', 'Rattle'],
  S: ['Salsa', 'Sloth', 'Saxophone', 'Sushi', 'Sparrow', 'Spinach', 'Scooter', 'Sequin', 'Squid', 'Strudel'],
  T: ['Taco', 'Toucan', 'Trumpet', 'Turnip', 'Tiger', 'Toffee', 'Tulip', 'Tiara', 'Tofu', 'Tractor'],
  W: ['Waffle', 'Walrus', 'Wombat', 'Whistle', 'Wasabi', 'Wagon', 'Walnut', 'Wizard', 'Weasel', 'Willow'],
}
const NAMES = { johnnyboy: 'Johnnyboy', dixxx: 'Dixxx', torii: 'Torii' }

/** What phone p types for category i. */
function answerFor(L, p, i, round) {
  const w = WORDS[L] ?? WORDS.S
  if (round > 0) return i < 4 ? w[(i * 3 + p + 1) % w.length] : ''
  if (i === 0) return w[9] // everyone the same: all three cancel
  if (i === 1 && p === 0) return `${w[0]} ${w[1]}` // alliteration
  if (i === 2 && p === 1) return L === 'Z' ? 'Apple' : 'Zebra' // wrong letter
  if (i === 2 && p === 2) return `The ${w[7]}` // article ignored
  if (i === 3 && p === 2) return '' // blank
  return w[(i * 3 + p + 2) % 9]
}

export default async function ({ phones, shot, wait }) {
  const until = async (fn, ms = 20000, step = 250) => {
    const end = Date.now() + ms
    while (Date.now() < end) { if (await fn()) return true; await wait(step) }
    return false
  }
  const visible = (p, sel) => p.locator(sel).first().isVisible().catch(() => false)

  for (let round = 0; round < 3; round++) {
    const ok = await until(async () => (await Promise.all(phones.map((p) => visible(p, '#cat-answer')))).every(Boolean), 30000)
    if (!ok) { console.log(`round ${round + 1}: write screen never showed`); break }
    const label = await phones[0].locator('[aria-label^="Letter "]').first().getAttribute('aria-label')
    const L = label.replace('Letter ', '').trim()
    console.log(`round ${round + 1}: letter ${L}`)
    if (round === 0) await shot('r1-write-start')

    for (let p = 0; p < phones.length; p++) {
      const ph = phones[p]
      for (let i = 0; i < 8; i++) {
        const text = answerFor(L, p, i, round)
        const input = ph.locator('#cat-answer')
        if (text) await input.fill(text)
        if (round === 0 && p === 1 && i === 2) {
          await wait(200)
          await shot('r1-write-wrong-letter')
        }
        await input.press('Enter')
        await wait(60)
      }
      await wait(500)
      if (round === 0 && p === 0) await shot('r1-review-list')
      await ph.getByRole('button', { name: 'Lock it in' }).click()
      await wait(400)
      if (round === 0 && p === 1) await shot('r1-two-locked')
    }

    // Judging, category by category.
    for (let idx = 0; idx < 8; idx++) {
      const tag = `Category ${idx + 1} of 8`
      // The first category can wait on bots still writing (solo mode), so give it the whole clock.
      const here = await until(async () => (await Promise.all(phones.map((p) => p.getByText(tag).first().isVisible().catch(() => false)))).every(Boolean), idx === 0 ? 130000 : 20000, 150)
      if (!here) { console.log(`round ${round + 1}: never saw ${tag}`); break }
      await wait(350)
      if (round === 0 && idx === 1) {
        if (phones.length >= 3) {
          // Dixxx and Torii love Johnnyboy's alliteration.
          await phones[1].getByRole('button', { name: `Thumbs up for ${NAMES[phones[0].playerId]}` }).click()
          await phones[2].getByRole('button', { name: `Thumbs up for ${NAMES[phones[0].playerId]}` }).click()
        } else {
          // Solo: the human gives a bot a thumbs up if there's anything to like.
          const up = phones[0].locator('button[aria-label^="Thumbs up for"]:not([disabled])').first()
          if (await up.count()) await up.click()
        }
        await wait(500)
        await shot('r1-judge-thumbs-up')
      }
      if (round === 0 && idx === 4 && phones.length >= 3) {
        // Challenge: the other two vote Johnnyboy's answer down. Majority of the others = out.
        await phones[1].getByRole('button', { name: `Thumbs down for ${NAMES[phones[0].playerId]}` }).click()
        await wait(400)
        await shot('r1-judge-one-down')
        await phones[2].getByRole('button', { name: `Thumbs down for ${NAMES[phones[0].playerId]}` }).click()
        await wait(500)
        await shot('r1-judge-thrown-out')
      }
      if (round === 0 && (idx === 0 || idx === 2 || idx === 3)) await shot(`r1-judge-${idx + 1}`)
      for (const p of phones) {
        const b = p.getByRole('button', { name: 'Looks good, next' })
        if (await b.isVisible().catch(() => false)) await b.click().catch(() => {})
        await wait(80)
      }
      if (round === 0 && idx <= 4) { await wait(600); await shot(`r1-verdict-${idx + 1}`) }
    }

    const ended = await until(async () => (await Promise.all(phones.map((p) => p.getByText('You made +').first().isVisible().catch(() => false)))).every(Boolean), 20000)
    if (!ended) console.log(`round ${round + 1}: round end never showed`)
    await wait(500)
    await shot(`r${round + 1}-round-end`)
    await wait(7000)
  }

  await until(async () => phones[0].getByRole('button', { name: 'Next game' }).isVisible().catch(() => false), 15000)
  await wait(1000)
  await shot('results')
  await phones[0].getByRole('button', { name: 'Next game' }).click()
  await wait(800)
  await phones[0].getByRole('button', { name: 'End the night' }).click()
  await wait(1200)
  await shot('summary')
}
