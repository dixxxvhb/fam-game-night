// QA driver for Sketch: every turn the drawer picks a word and draws, one guesser
// misses, then everyone gets it. Ends the night after the game.
export default async function ({ tv, phones, shot, wait }) {
  const drawerOf = async () => {
    for (const p of phones) if (await p.getByText('Pick one to draw').count()) return p
    return null
  }
  for (let turn = 0; turn < 12; turn++) {
    let drawer = null
    for (let i = 0; i < 20 && !drawer; i++) { drawer = await drawerOf(); if (!drawer) await wait(500) }
    if (!drawer) break
    await shot(`turn${turn}-choose`)
    await drawer.locator('main button').first().click()
    await wait(800)
    const word = (await drawer.locator('[data-qa=word]').first().innerText()).trim()
    const pad = drawer.locator('.touch-none-all').first()
    const box = await pad.boundingBox()
    const path = [[0.2, 0.3], [0.5, 0.15], [0.8, 0.3], [0.8, 0.7], [0.2, 0.7], [0.2, 0.3]]
    await drawer.mouse.move(box.x + box.width * path[0][0], box.y + box.height * path[0][1])
    await drawer.mouse.down()
    for (const [x, y] of path.slice(1)) await drawer.mouse.move(box.x + box.width * x, box.y + box.height * y, { steps: 8 })
    await drawer.mouse.up()
    // Paint-bucket the shape.
    await drawer.getByRole('button', { name: 'Yellow', exact: true }).click()
    await drawer.getByRole('button', { name: 'Fill', exact: true }).click()
    await drawer.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5)
    await wait(700)
    const guessers = phones.filter((p) => p !== drawer)
    await guessers[0].getByLabel('Your guess').fill('definitely not it')
    await guessers[0].getByLabel('Your guess').press('Enter')
    await wait(600)
    await shot(`turn${turn}-draw`)
    for (const g of guessers) {
      await g.getByLabel('Your guess').fill(word)
      await g.getByLabel('Your guess').press('Enter')
      await wait(300)
      if (g === guessers[0]) await shot(`turn${turn}-got-it`)
    }
    await wait(800)
    await shot(`turn${turn}-reveal`)
    await wait(5200)
    if (await phones[0].getByText('Next game').count()) break
  }
  await wait(1500)
  await shot('gallery')
  await phones[0].getByRole('button', { name: 'Next game' }).waitFor({ timeout: 30000 })
  await wait(1000)
  await shot('results')
  await phones[0].getByRole('button', { name: 'Next game' }).click()
  await wait(800)
  await phones[0].getByRole('button', { name: 'End the night' }).click()
  await wait(1200)
  await shot('summary')
}
