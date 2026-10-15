// QA driver for Draw Bluff (3 players, or one phone and two bots with --mode solo). Everyone draws their secret prompt, then for each
// drawing: one guesser tries to submit the real title (rejected), both write lies, picks vary
// (find the truth, fall for a lie, get caught by the House), a like during the reveal.
// Ends the night after the game.
const SHAPES = [
  [[[0.2, 0.85], [0.2, 0.45], [0.5, 0.18], [0.8, 0.45], [0.8, 0.85], [0.2, 0.85]], [[0.42, 0.85], [0.42, 0.62], [0.58, 0.62], [0.58, 0.85]]],
  [Array.from({ length: 25 }, (_, i) => [0.5 + 0.32 * Math.cos((i / 24) * Math.PI * 2), 0.5 + 0.32 * Math.sin((i / 24) * Math.PI * 2)]), [[0.38, 0.42], [0.4, 0.44]], [[0.6, 0.42], [0.62, 0.44]], [[0.36, 0.6], [0.5, 0.7], [0.64, 0.6]]],
  [Array.from({ length: 11 }, (_, i) => { const r = i % 2 ? 0.16 : 0.38; const a = -Math.PI / 2 + (i / 10) * Math.PI * 2; return [0.5 + r * Math.cos(a), 0.52 + r * Math.sin(a)] })],
]
const LIES = [
  ['a pirate who lost a bet', 'my uncle at a wedding'],
  ['a sandwich with feelings', 'the wifi going out'],
  ['a goose in witness protection', 'leg day'],
]

async function draw(page, shape) {
  const pad = page.locator('.touch-none-all').first()
  const box = await pad.boundingBox()
  for (const path of shape) {
    await page.mouse.move(box.x + box.width * path[0][0], box.y + box.height * path[0][1])
    await page.mouse.down()
    for (const [x, y] of path.slice(1)) await page.mouse.move(box.x + box.width * x, box.y + box.height * y, { steps: 6 })
    await page.mouse.up()
    await new Promise((r) => setTimeout(r, 150))
  }
}

const optionTexts = async (p) => (await p.locator('button[aria-pressed]').allTextContents()).map((t) => t.replace(/Yours$/, '').trim())

async function lie(p, text) {
  await p.getByLabel('Your fake title').fill(text)
  await p.getByRole('button', { name: 'Send', exact: true }).click()
}

export default async function (ctx) {
  try {
    await play(ctx)
  } catch (err) {
    await ctx.shot('error')
    throw err
  }
}

async function play({ phones, shot, wait }) {
  for (const p of phones) await p.locator('.touch-none-all').first().waitFor({ timeout: 30000 })
  await wait(500)
  await shot('draw-start')
  for (let i = 0; i < phones.length; i++) await draw(phones[i], SHAPES[i % SHAPES.length])
  await wait(600)
  await shot('drawn')
  await phones[0].getByRole('button', { name: 'Done', exact: true }).click()
  await wait(500)
  await shot('draw-one-done')
  for (const p of phones.slice(1)) await p.getByRole('button', { name: 'Done', exact: true }).click()

  const LIKE = /^(Like this drawing|Liked)$/
  const p0 = phones[0]
  for (let d = 0; d < 8; d++) {
    // Wait for the next drawing: someone sees "That's yours" or a title box (in solo the artist may be a bot).
    let artist = null
    let guessers = []
    for (let t = 0; t < 120; t++) {
      if (await p0.getByRole('button', { name: 'Next game' }).count()) break
      if (await p0.getByRole('button', { name: 'See the scores' }).count()) break
      artist = null
      for (const p of phones) if (await p.getByText("That's yours").count()) artist = p
      guessers = []
      for (const p of phones) if (p !== artist && (await p.getByLabel('Your fake title').count())) guessers.push(p)
      // Wait until every phone has caught up (in apart mode the host phone hears first).
      if ((artist || guessers.length) && guessers.length === phones.length - (artist ? 1 : 0)) break
      await wait(300)
    }
    if (!artist && !guessers.length) break
    const real = artist ? (await artist.locator('[data-qa="prompt"]').first().textContent()).trim() : null
    const [g0, g1] = guessers
    await wait(400)
    await shot(`d${d + 1}-title`)

    if (g0 && real) {
      // Try to pass off the real title: rejected on the phone.
      await lie(g0, real)
      await wait(400)
      await shot(`d${d + 1}-real-rejected`)
    }
    if (g0) {
      await lie(g0, LIES[d % LIES.length][0])
      await wait(500)
      await shot(`d${d + 1}-one-lie-in`)
    }
    if (g1) await lie(g1, LIES[d % LIES.length][1])

    // Everyone's phone moves to the picks (the host phone hears first in apart mode).
    for (const g of guessers) await g.locator('button[aria-pressed]').first().waitFor({ timeout: 60000 })
    if (artist) await artist.getByText("They're picking. Don't make a face.").waitFor({ timeout: 60000 })
    await wait(500)
    await shot(`d${d + 1}-pick`)
    if (g0 && g1 && real) {
      const texts = await optionTexts(g1)
      const house = texts.find((t) => t !== real && !LIES[d % LIES.length].includes(t))
      const plan = d === 0 ? [real, house] : d === 1 ? [LIES[d][1], real] : [real, real]
      await g0.getByRole('button', { name: plan[0], exact: true }).click()
      await wait(500)
      await shot(`d${d + 1}-picked-one`)
      await g1.getByRole('button', { name: plan[1], exact: true }).click()
    } else if (g0) {
      // Solo guesser: take the first title that isn't yours.
      await g0.locator('button[aria-pressed]:not([disabled])').first().click()
      await wait(500)
      await shot(`d${d + 1}-picked-one`)
    }

    // Reveal: beats every few seconds until the next drawing or the results.
    const watcher = g0 ?? artist
    const inReveal = async () => (await watcher.getByRole('button', { name: LIKE }).count()) + (await watcher.getByText(/likes? on your drawing$/).count()) > 0
    for (let t = 0; t < 120 && !(await inReveal()); t++) await wait(300)
    for (let beat = 0; beat < 6; beat++) {
      await wait(1200)
      if (g0 && (beat === 0 || (beat === 1 && d === 1))) {
        await g0.getByRole('button', { name: LIKE }).click()
        if (d === 1 && g1) await g1.getByRole('button', { name: LIKE }).click()
        await wait(400)
      }
      await shot(`d${d + 1}-reveal-${beat}`)
      await wait(2600)
      if (!(await inReveal())) break
    }
  }

  // Finale: tonight's exhibition with the awards.
  for (let t = 0; t < 100 && !(await p0.getByRole('button', { name: 'See the scores' }).count()); t++) await wait(300)
  await wait(1800)
  await shot('finale')
  if (await p0.getByRole('button', { name: 'See the scores' }).count()) await p0.getByRole('button', { name: 'See the scores' }).click()
  await p0.getByRole('button', { name: 'Next game' }).waitFor({ timeout: 30000 })
  await wait(1000)
  await shot('results')
  await p0.getByRole('button', { name: 'Next game' }).click()
  await wait(800)
  await p0.getByRole('button', { name: 'End the night' }).click()
  await wait(1200)
  await shot('summary')
}
