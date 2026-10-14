// TV check for bot jars in Melon (together mode, one phone): qa-room starts Melon with just
// Johnnyboy; this ends it, seats two bots from the phone, and plays a 2 minute Race so the
// TV shows the bots' model jars next to a real phone jar.
//   node scripts/qa-room.mjs --game melon --name Melon --players 1 --driver scripts/drivers/solo/melon-tv.mjs
export default async function ({ tv, phones, shot, wait }) {
  const p = phones[0]
  await tv.getByRole('button', { name: 'End game' }).click()
  await wait(1200)
  await p.getByRole('button', { name: /Add a bot/ }).click()
  await wait(500)
  await p.getByRole('button', { name: /Another bot/ }).click()
  await wait(800)
  await shot('lobby-bots')
  const card = p.locator('button[aria-expanded]', { hasText: /Melon/ }).first()
  if ((await card.getAttribute('aria-expanded')) !== 'true') await card.click()
  await p.getByRole('button', { name: 'Race', exact: true }).click()
  await p.getByRole('button', { name: '2 min', exact: true }).click()
  await p.getByRole('button', { name: 'Start Melon' }).click()
  await wait(1000)

  const t0 = Date.now()
  let next = t0 + 4000
  let k = 0
  while (Date.now() - t0 < 150_000) {
    if (await p.getByRole('button', { name: 'Next game' }).count()) break
    const c = p.locator('canvas[data-myjar]').first()
    if (await c.count()) {
      const b = await c.boundingBox()
      if (b) { k += 1; await p.touchscreen.tap(b.x + b.width * (0.1 + 0.8 * ((k * 0.37) % 1)), b.y + b.height * 0.35).catch(() => {}) }
    }
    if (Date.now() >= next) {
      next += 20_000
      const secs = Math.round((Date.now() - t0) / 1000)
      await shot(`race-${String(secs).padStart(3, '0')}s`)
      const jars = await tv.evaluate(() => [...document.querySelectorAll('canvas[data-jar]')].map((x) => `${x.dataset.jar}:${x.dataset.count ?? 0} fruit/${x.dataset.frames ?? 0} snaps`))
      console.log(`[melon-tv] ${secs}s TV jars: ${jars.join('  ')}`)
    }
    await wait(900)
  }
  for (let i = 0; i < 20 && !(await p.getByRole('button', { name: 'Next game' }).count()); i++) await wait(1000)
  await wait(1200)
  await shot('results')
  console.log(`[melon-tv] TV results: ${(await tv.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 300)}`)
}
