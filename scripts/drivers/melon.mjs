// QA driver for Melon. Every phone keeps dropping fruit at varied spots (real touch taps
// plus some drag-to-aim mouse drags on the jar canvas).
//   together: restart as a 2 minute Race, play it to the clock, check the TV jars update.
//   apart:    play the default Race until every jar tops out, then an Attack game to the end.
// Screens every ~15 s; TV (or the hosting phone's mini jars) checked for live updates.
export default async function ({ tv, phones, shot, wait }) {
  const apart = !tv
  const log = (...a) => console.log('[melon]', ...a)
  const failures = []

  const resultsUp = async () => {
    for (const p of phones) if (await p.getByRole('button', { name: 'Next game' }).count()) return true
    return false
  }

  async function startMelon(starter, mode, length) {
    await starter.getByText('Pick a game', { exact: true }).waitFor({ timeout: 15000 })
    const card = starter.locator('button[aria-expanded]', { hasText: /Melon/ }).first()
    if ((await card.getAttribute('aria-expanded')) !== 'true') await card.click()
    await starter.getByRole('button', { name: mode, exact: true }).click()
    if (length) await starter.getByRole('button', { name: `${length} min`, exact: true }).click()
    await starter.getByRole('button', { name: 'Start Melon' }).click()
    await wait(800)
  }

  let drops = 0
  async function dropOn(p, fx, drag) {
    const c = p.locator('canvas[data-myjar]').first()
    if (!(await c.count())) return
    const b = await c.boundingBox()
    if (!b) return
    const x = b.x + b.width * (0.06 + 0.88 * fx)
    const y = b.y + b.height * 0.35
    try {
      if (drag) {
        const from = b.x + b.width * (fx > 0.5 ? 0.2 : 0.8)
        await p.mouse.move(from, y)
        await p.mouse.down()
        await p.mouse.move(x, y, { steps: 6 })
        await p.mouse.up()
      } else {
        await p.touchscreen.tap(x, y)
      }
      drops += 1
    } catch { /* page busy, next round */ }
  }

  // Read every remote jar canvas on a page: how many fruit, how many snapshots drawn.
  const jarStats = (page) =>
    page.evaluate(() =>
      [...document.querySelectorAll('canvas[data-jar]')].map((c) => ({ id: c.dataset.jar, n: Number(c.dataset.count || 0), frames: Number(c.dataset.frames || 0) })),
    )

  async function checkLive(page, label, prev) {
    const now = await jarStats(page)
    const line = now.map((j) => `${j.id}:${j.n} fruit/${j.frames} snaps`).join('  ')
    log(label, line)
    if (prev) {
      for (const j of now) {
        const before = prev.find((x) => x.id === j.id)
        if (before && j.frames <= before.frames && j.n > 0) failures.push(`${label}: ${j.id} jar did not update`)
      }
    }
    return now
  }

  async function play({ label, maxMs, aimFor, until }) {
    const t0 = Date.now()
    let nextShot = t0 + 15000
    let round = 0
    const watcher = tv ?? phones[0]
    let prev = await checkLive(watcher, `${label} start`, null)
    await shot(`${label}-start`)
    while (Date.now() - t0 < maxMs) {
      round += 1
      await Promise.all(phones.map((p, i) => dropOn(p, aimFor(i, round), (round + i) % 5 === 0)))
      await wait(520 + Math.floor(Math.random() * 260))
      if (Date.now() >= nextShot) {
        nextShot += 15000
        const secs = Math.round((Date.now() - t0) / 1000)
        await shot(`${label}-${String(secs).padStart(3, '0')}s`)
        prev = await checkLive(watcher, `${label} ${secs}s`, prev)
      }
      if (round % 4 === 0 && (await resultsUp())) break
      if (until && round % 4 === 0 && (await until())) break
    }
    log(`${label}: ${round} rounds, ${drops} drops so far, ${Math.round((Date.now() - t0) / 1000)} s`)
  }

  const varied = (i, round) => ((round * 0.37 + i * 0.29) % 1)

  if (!apart) {
    // The runner started the default game. Restart as a 2 minute Race, the way someone would.
    await tv.getByRole('button', { name: 'End game' }).click()
    await wait(1200)
    await startMelon(phones[0], 'Race', 2)
    await play({ label: 'race', maxMs: 2 * 60_000 + 25_000, aimFor: varied })
  } else {
    // Default Race: stack the middle so every jar tops out and the race ends early.
    await play({ label: 'race', maxMs: 200_000, aimFor: (i, r) => 0.42 + ((r + i) % 3) * 0.08 })
    if (!(await resultsUp())) failures.push('apart race never reached results')
    await wait(1500)
    await shot('race-results')
    await phones[0].getByRole('button', { name: 'Next game' }).click()
    await wait(1000)
    await startMelon(phones[0], 'Attack')
    // The host plays it straight, the other two stack the middle and get buried.
    await play({ label: 'attack', maxMs: 330_000, aimFor: (i, r) => (i === 0 ? varied(i, r) : 0.4 + ((r + i) % 4) * 0.07) })
  }

  for (let i = 0; i < 20 && !(await resultsUp()); i++) await wait(1000)
  if (!(await resultsUp())) failures.push('never reached results')
  await wait(1200)
  await shot('results')
  if (tv) log('tv results:', (await tv.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 300))
  else log('phone results:', (await phones[0].locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 300))

  await phones[0].getByRole('button', { name: 'Next game' }).click()
  await wait(800)
  await phones[0].getByRole('button', { name: 'End the night' }).click()
  await wait(1200)
  await shot('summary')

  log(`drops: ${drops}`)
  if (failures.length) {
    log('FAILURES:')
    for (const f of failures) log(' -', f)
    process.exitCode = 1
  } else {
    log('all checks passed')
  }
}
