// QA driver for Draw Bluff (3 players). Everyone draws their secret prompt, then for each
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

  for (let d = 0; d < phones.length; d++) {
    let artist = null
    for (let t = 0; t < 60 && !artist; t++) {
      for (const p of phones) if (await p.getByText("That's yours").count()) artist = p
      if (!artist) await wait(300)
    }
    if (!artist) break
    const real = (await artist.locator('[data-qa="prompt"]').first().textContent()).trim()
    const [g0, g1] = phones.filter((p) => p !== artist)
    await g0.getByLabel('Your fake title').waitFor({ timeout: 10000 })
    await wait(400)
    await shot(`d${d + 1}-title`)

    // Try to pass off the real title: rejected on the phone.
    await lie(g0, real)
    await wait(400)
    await shot(`d${d + 1}-real-rejected`)
    await lie(g0, LIES[d][0])
    await wait(500)
    await shot(`d${d + 1}-one-lie-in`)
    await lie(g1, LIES[d][1])

    // Both guessers see the titles (the host phone hears first in apart mode).
    await g0.getByRole('button', { name: LIES[d][1], exact: true }).waitFor({ timeout: 15000 })
    await g1.getByRole('button', { name: LIES[d][0], exact: true }).waitFor({ timeout: 15000 })
    await wait(500)
    await shot(`d${d + 1}-pick`)
    const texts = await optionTexts(g1)
    const house = texts.find((t) => t !== real && t !== LIES[d][0] && t !== LIES[d][1])
    const plan = d === 0 ? [real, house] : d === 1 ? [LIES[d][1], real] : [real, real]
    await g0.getByRole('button', { name: plan[0], exact: true }).click()
    await wait(500)
    await shot(`d${d + 1}-picked-one`)
    await g1.getByRole('button', { name: plan[1], exact: true }).click()

    await g0.getByRole('button', { name: /^(Like this drawing|Liked)$/ }).waitFor({ timeout: 10000 })
    for (let beat = 0; beat < 6; beat++) {
      await wait(1200)
      if (beat === 0 || (beat === 1 && d === 1)) {
        await g0.getByRole('button', { name: /^(Like this drawing|Liked)$/ }).click()
        if (d === 1) await g1.getByRole('button', { name: /^(Like this drawing|Liked)$/ }).click()
        await wait(400)
      }
      await shot(`d${d + 1}-reveal-${beat}`)
      await wait(2600)
      if (!(await g0.getByRole('button', { name: /^(Like this drawing|Liked)$/ }).count())) break
    }
  }

  const p0 = phones[0]
  await p0.getByRole('button', { name: 'Next game' }).waitFor({ timeout: 30000 })
  await wait(1000)
  await shot('results')
  await p0.getByRole('button', { name: 'Next game' }).click()
  await wait(800)
  await p0.getByRole('button', { name: 'End the night' }).click()
  await wait(1200)
  await shot('summary')
}
