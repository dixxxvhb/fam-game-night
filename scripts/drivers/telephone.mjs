// QA driver for Telephone (3 players, 6 steps). Everyone writes a first line (one uses
// "Give me one"), then chains pass around: draw, describe, draw... One describe step is left
// typed but unsent so the clock runs out and the phone auto-sends it. Then the replay: some
// beats run on their own, most are skipped with Next, stars get tapped along the way.
// Ends the night after the game.
const LINES = {
  johnnyboy: ['', 'a house with a party hat', 'a sad pizza with legs'],
  dixxx: ['a goose doing a recital', 'a ghost eating spaghetti', 'a bald man at the beach'],
  torii: ['grandma at a rave', 'a cat stuck in a bucket', 'the moon wearing a tutu'],
}

const SHAPES = [
  // house
  [[[0.2, 0.85], [0.2, 0.45], [0.5, 0.18], [0.8, 0.45], [0.8, 0.85], [0.2, 0.85]], [[0.42, 0.85], [0.42, 0.62], [0.58, 0.62], [0.58, 0.85]]],
  // face
  [Array.from({ length: 25 }, (_, i) => [0.5 + 0.32 * Math.cos((i / 24) * Math.PI * 2), 0.5 + 0.32 * Math.sin((i / 24) * Math.PI * 2)]), [[0.38, 0.42], [0.4, 0.44]], [[0.6, 0.42], [0.62, 0.44]], [[0.36, 0.6], [0.5, 0.7], [0.64, 0.6]]],
  // star
  [Array.from({ length: 11 }, (_, i) => { const r = i % 2 ? 0.16 : 0.38; const a = -Math.PI / 2 + (i / 10) * Math.PI * 2; return [0.5 + r * Math.cos(a), 0.52 + r * Math.sin(a)] })],
]

async function draw(page, shape, colors = []) {
  const pad = page.locator('.touch-none-all').first()
  const box = await pad.boundingBox()
  for (let s = 0; s < shape.length; s++) {
    if (colors[s]) await page.getByRole('button', { name: colors[s], exact: true }).click()
    const path = shape[s]
    await page.mouse.move(box.x + box.width * path[0][0], box.y + box.height * path[0][1])
    await page.mouse.down()
    for (const [x, y] of path.slice(1)) await page.mouse.move(box.x + box.width * x, box.y + box.height * y, { steps: 6 })
    await page.mouse.up()
    await new Promise((r) => setTimeout(r, 150))
  }
}

export default async function ({ phones, shot, wait }) {
  const steps = 6
  for (let k = 0; k < steps; k++) {
    const write = k % 2 === 0
    for (const p of phones) {
      if (write) await p.getByRole('textbox').first().waitFor({ timeout: 60000 })
      else await p.locator('.touch-none-all').first().waitFor({ timeout: 60000 })
    }
    await wait(500)
    await shot(`step${k + 1}-${write ? 'write' : 'draw'}`)

    if (write) {
      const line = k / 2
      for (let i = 0; i < phones.length; i++) {
        const p = phones[i]
        if (k === 0 && i === 0) await p.getByRole('button', { name: 'Give me one' }).click()
        else await p.getByRole('textbox').first().fill(LINES[p.playerId]?.[line] || 'a mystery blob')
        if (k === 2 && i === 2) continue // typed, never sent: the clock will send it
        await p.getByRole('button', { name: 'Send', exact: true }).click()
        await wait(400)
        if (i === 0) await shot(`step${k + 1}-sent-one`)
      }
      if (k === 2) {
        await shot(`step${k + 1}-waiting-on-one`)
        // Let the 40 second clock run out.
        await phones[0].locator('.touch-none-all').first().waitFor({ timeout: 60000 })
      }
    } else {
      for (let i = 0; i < phones.length; i++) {
        await draw(phones[i], SHAPES[(i + k) % SHAPES.length], i === 1 ? ['Red', 'Blue', 'Blue', 'Green'] : [])
      }
      await wait(600)
      await shot(`step${k + 1}-drawn`)
      for (let i = 0; i < phones.length; i++) {
        await phones[i].getByRole('button', { name: 'Done', exact: true }).click()
        await wait(300)
        if (i === 0) await shot(`step${k + 1}-done-one`)
      }
    }
  }

  // ---------------- replay ----------------
  const p0 = phones[0]
  let lastLabel = ''
  for (let beat = 0; beat < 40; beat++) {
    if (await p0.getByRole('button', { name: 'Next game' }).count()) break
    let label = ''
    for (let i = 0; i < 30 && !label; i++) {
      if (await p0.getByText('Your favorites').count()) label = 'tally'
      else if (await p0.getByRole('button', { name: /^(Next chain|See the favorites)$/ }).count()) label = `recap-${beat}`
      else {
        // Together: the phone says "Step 2 of 6". Apart: the screen above says "2 of 6".
        const l = p0.getByText(/^(Step )?\d+ of \d+$/).first()
        if (await l.count()) label = 'step-' + (await l.innerText()).replace(/^Step /, '').replace(/\s+/g, '-').toLowerCase() + `-${beat}`
      }
      if (await p0.getByRole('button', { name: 'Next game' }).count()) break
      if (!label) await wait(300)
    }
    if (!label) break
    if (label === lastLabel) { await wait(300); continue }
    lastLabel = label
    await wait(label.startsWith('recap') || label === 'tally' ? 900 : 2900)
    await shot(`replay-${label}`)

    // Stars: the first two phones star what they can on most beats.
    for (const p of phones.slice(beat % 2, (beat % 2) + 2)) {
      const fav = p.getByRole('button', { name: 'Favorite', exact: true })
      if (beat % 3 !== 2 && (await fav.count())) await fav.click()
    }
    if (label.startsWith('recap')) {
      const stars = phones[2].getByRole('button', { name: /^Favorite: step/ })
      if (await stars.count()) await stars.first().click()
      await wait(500)
      await shot(`replay-${label}-starred`)
    }
    if (label === 'tally') {
      await wait(800)
      await shot('replay-tally-final')
    }

    // The first two beats run on their own clock; after that, skip ahead.
    if (beat < 2) continue
    await wait(400)
    const next = p0.getByRole('button', { name: /^(Next|Next chain|See the favorites|Finish)$/ })
    if (await next.count()) await next.first().click()
    await wait(700)
  }

  await p0.getByRole('button', { name: 'Next game' }).waitFor({ timeout: 30000 })
  await wait(1000)
  await shot('results')
  await p0.getByRole('button', { name: 'Next game' }).click()
  await wait(800)
  await p0.getByRole('button', { name: 'End the night' }).click()
  await wait(1200)
  await shot('summary')
}
