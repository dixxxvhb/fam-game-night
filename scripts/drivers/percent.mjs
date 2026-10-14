// QA driver for Guess the Percent: every round the Spy drags the slider, nudges it +1 and
// locks in; one bettor bets Higher (or Much), the other Lower. Then the final round, where
// everyone guesses. Screens at the question, the bets and the reveal. Ends the night after.
export default async function ({ tv, phones, shot, wait }) {
  const spyOf = async () => {
    for (const p of phones) if (await p.getByText("You're the Spy").count()) return p
    return null
  }
  const isFinal = async () => (await phones[0].getByText('Final round. Everyone guesses').count()) > 0

  // Drag across the track to land near `pct`, then nudge with +1.
  async function setPercent(page, pct) {
    const track = page.getByRole('slider', { name: 'Percent' })
    const box = await track.boundingBox()
    const y = box.y + box.height / 2
    await page.mouse.move(box.x + box.width * 0.5, y)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * (pct / 100), y, { steps: 6 })
    await page.mouse.up()
    await page.getByRole('button', { name: 'Plus one' }).click()
  }

  const targets = [22, 61, 74, 9, 47, 84, 33, 55, 68]
  let round = 0
  for (; round < 12; round++) {
    let spy = null
    for (let i = 0; i < 40 && !spy; i++) {
      spy = await spyOf()
      if (!spy) { if (await isFinal()) break; await wait(500) }
    }
    if (!spy) break
    const t = targets[round % targets.length]
    await setPercent(spy, t)
    await wait(500)
    await shot(`r${round}-question`)
    await spy.getByRole('button', { name: /^Lock in/ }).click()
    await wait(900)
    const bettors = phones.filter((p) => p !== spy)
    // first bettor: Much higher on odd rounds, Higher on even; second bettor: Lower or Much lower.
    const up = round % 2 ? /^Much higher/ : /^Higher/
    const down = round % 3 === 0 ? /^Much lower/ : /^Lower/
    const b0 = bettors[0].getByRole('button', { name: up })
    await (await b0.isEnabled() ? b0 : bettors[0].getByRole('button', { name: /^Higher/ })).click()
    await wait(700)
    await shot(`r${round}-bets`)
    for (const b of bettors.slice(1)) {
      const d = b.getByRole('button', { name: down })
      await (await d.isEnabled() ? d : b.getByRole('button', { name: /^Lower/ })).click()
      await wait(200)
    }
    await wait(1100)
    await shot(`r${round}-sweep`)
    await wait(2000)
    await shot(`r${round}-reveal`)
    await wait(6500)
  }

  // Final round: everyone guesses at once.
  for (let i = 0; i < 30 && !(await isFinal()); i++) await wait(500)
  const finals = [38, 52, 71, 15, 90]
  for (let i = 0; i < phones.length; i++) {
    await setPercent(phones[i], finals[i % finals.length])
    if (i === 0) { await wait(300); await shot('final-question') }
    await phones[i].getByRole('button', { name: /^Lock in/ }).click()
    await wait(300)
    if (i === 0) await shot('final-locked')
  }
  await wait(1000)
  await shot('final-sweep')
  await wait(2200)
  await shot('final-reveal')
  for (let i = 0; i < 40 && !(await phones[0].getByText('Next game').count()); i++) await wait(500)
  await wait(800)
  await shot('results')
  await phones[0].getByRole('button', { name: 'Next game' }).click()
  await wait(800)
  await phones[0].getByRole('button', { name: 'End the night' }).click()
  await wait(1200)
  await shot('summary')
  console.log(`percent driver: ${round} Spy rounds played`)
}
