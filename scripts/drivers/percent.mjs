// QA driver for Guess the Percent: every round the Spy drags the meter needle, nudges it +1 and
// locks in; one bettor bets Higher (or Much), the other Lower. Then the final round, where
// everyone guesses. Screens at the question, the bets and the reveal. Ends the night after.
export default async function ({ tv, phones, shot, wait }) {
  // Other games may be mid-edit on the same dev server: keep Vite's error overlay from
  // covering this game's screens.
  for (const p of [tv, ...phones].filter(Boolean)) await p.addStyleTag({ content: 'vite-error-overlay { display: none !important; }' }).catch(() => {})
  const spyOf = async () => {
    for (const p of phones) if (await p.getByText("You're the Spy").count()) return p
    return null
  }
  const isFinal = async () => (await phones[0].getByText('Final round. Everyone guesses').count()) > 0

  // Drag the meter needle around its arc to land near `pct`, then nudge with +1.
  // The dial's pivot sits at the bottom middle (data-pivot-y is its height fraction).
  async function setPercent(page, pct) {
    const dial = page.getByRole('slider', { name: 'Percent' })
    const box = await dial.boundingBox()
    const py = Number(await dial.getAttribute('data-pivot-y')) || 0.8
    const cx = box.x + box.width / 2
    const cy = box.y + box.height * py
    const r = box.width * 0.3
    const at = (v) => {
      const a = Math.PI * (1 - v / 100)
      return [cx + Math.cos(a) * r, cy - Math.sin(a) * r]
    }
    const [sx, sy] = at(50)
    await page.mouse.move(sx, sy)
    await page.mouse.down()
    for (let i = 1; i <= 6; i++) {
      const [x, y] = at(50 + ((pct - 50) * i) / 6)
      await page.mouse.move(x, y)
    }
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
    }
    // The reveal starts on the last bet. Shots can be slow, so aim by the clock: the needle
    // mid-swing at ~1.1 s, the verdict after the tear at ~3.2 s, then wait out the 9 s reveal.
    const t0 = Date.now()
    const until = async (ms) => { const left = t0 + ms - Date.now(); if (left > 0) await wait(left) }
    await until(1000)
    await shot(`r${round}-sweep`)
    await until(3200)
    await shot(`r${round}-reveal`)
    await until(9800)
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
  const tf = Date.now()
  await wait(1000)
  await shot('final-sweep')
  const left = tf + 3400 - Date.now()
  if (left > 0) await wait(left)
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
