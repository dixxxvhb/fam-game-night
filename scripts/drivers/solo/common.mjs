// Shared loop for solo QA drivers (qa-room --mode solo: one phone hosts, two bots play).
// The human phone does the bare minimum through `act(page)`, called about twice a second;
// the bots and the timers carry the rest. Screens every `every` ms, then the results and
// the night summary.
export async function soloLoop({ phones, shot, wait }, { label, act, every = 8000, maxMs = 15 * 60_000, firstShots = 4 }) {
  const p = phones[0]
  const t0 = Date.now()
  let next = t0
  let n = 0
  const resultsUp = async () => (await p.getByRole('button', { name: 'Next game' }).count()) > 0
  while (Date.now() - t0 < maxMs) {
    if (await resultsUp()) break
    if (Date.now() >= next) {
      n += 1
      const secs = Math.round((Date.now() - t0) / 1000)
      await shot(`${label}-${String(secs).padStart(4, '0')}s`)
      next = Date.now() + (n < firstShots ? 3000 : every)
    }
    try { await act(p) } catch (e) { console.log(`[${label}] act failed: ${String(e).split('\n')[0]}`) }
    await wait(450)
  }
  const done = await resultsUp()
  console.log(`[${label}] ${done ? 'reached results' : 'TIMED OUT'} after ${Math.round((Date.now() - t0) / 1000)} s`)
  await wait(1200)
  await shot(`${label}-results`)
  console.log(`[${label}] results: ${(await p.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 300)}`)
  if (!done) { process.exitCode = 1; return }
  await p.getByRole('button', { name: 'Next game' }).click()
  await wait(800)
  await p.getByRole('button', { name: 'End the night' }).click()
  await wait(1200)
  await shot('summary')
}

/** Click the first visible, enabled match, if any. True if it clicked. */
export async function tap(locator) {
  const n = await locator.count()
  for (let i = 0; i < n; i++) {
    const el = locator.nth(i)
    if ((await el.isVisible()) && (await el.isEnabled())) { await el.click({ timeout: 2000 }); return true }
  }
  return false
}
