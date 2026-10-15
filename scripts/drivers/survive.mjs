// QA driver for Survive the Quiz: plays a whole game through the phones. Torii always
// answers right; Johnnyboy misses questions 2 and 5; Dixxx misses question 1, plays the trap
// badly and dies, then plays the rest as a ghost. Traps are played for real (read the sum,
// find the odd tile, watch the flashes, wait for NOW, pick a door). In the finale the ghost
// sorts everything right, so he should catch the living and come back to win.
export default async function ({ tv, phones, shot, wait }) {
  // Other games may be mid-edit on the same dev server: keep Vite's error overlay off these screens.
  for (const p of [tv, ...phones].filter(Boolean)) await p.addStyleTag({ content: 'vite-error-overlay { display: none !important; }' }).catch(() => {})
  // The host saves its room to localStorage on every change: the driver reads the answer key
  // there so it can be right or wrong on purpose (QA only; the app never shows it).
  const hostPage = tv ?? phones[0]
  const hostGame = () => hostPage.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith('gn-host-')) { try { return JSON.parse(localStorage.getItem(k)).state.game?.state ?? null } catch { return null } }
    }
    return null
  })
  const seen = new Set()
  const snap = async (tag) => { if (!seen.has(tag)) { seen.add(tag); await shot(tag) } }
  const attr = async (p, name) => {
    const el = p.locator('[data-phase]').first()
    return (await el.count()) ? el.getAttribute(name) : null
  }
  const done = async () => (await phones[0].getByRole('button', { name: 'Next game' }).count()) > 0
  const bad = (p) => p.playerId === 'dixxx'

  async function playTrap(p, kind) {
    const area = p.locator('[data-trap]')
    try { await area.waitFor({ timeout: 6000 }) } catch { return }
    if (kind === 'math') {
      for (let i = 0; i < 3; i++) {
        const text = await p.locator('[data-trap] [data-sum]').first().innerText().catch(() => '')
        const m = text.match(/(\d+) ([+\-x]) (\d+)/)
        if (!m) return
        const [a, op, b] = [Number(m[1]), m[2], Number(m[3])]
        const val = op === '+' ? a + b : op === '-' ? a - b : a * b
        const answer = bad(p) ? val + 1 : val
        const btn = p.locator('[data-trap] button', { hasText: new RegExp(`^${answer}$`) })
        if (!(await btn.count())) { await p.locator('[data-trap] button').first().click(); return }
        await btn.first().click()
        await wait(500)
        if (!(await area.count())) return
      }
    }
    if (kind === 'odd') {
      for (let i = 0; i < 3; i++) {
        const idx = await p.evaluate(() => {
          const tiles = [...document.querySelectorAll('[data-trap] button[aria-label^="Tile"]')]
          const colors = tiles.map((t) => getComputedStyle(t).backgroundColor)
          return colors.findIndex((c) => colors.filter((x) => x === c).length === 1)
        })
        if (idx < 0) return
        const tiles = p.locator('[data-trap] button[aria-label^="Tile"]')
        await tiles.nth(bad(p) ? (idx + 1) % (await tiles.count()) : idx).click()
        await wait(500)
        if (!(await area.count())) return
      }
    }
    if (kind === 'memory') {
      const seq = []
      let last = null
      for (let t = 0; t < 80; t++) {
        const lit = await p.evaluate(() => {
          const pads = [...document.querySelectorAll('[data-trap] button[data-lit]')]
          return { i: pads.findIndex((x) => x.getAttribute('data-lit') === '1'), off: pads.every((x) => !x.disabled) }
        })
        if (lit.off) break
        if (lit.i >= 0 && lit.i !== last) seq.push(lit.i)
        last = lit.i
        await wait(60)
      }
      const order = bad(p) ? [...seq].reverse() : seq
      for (const i of order.slice(0, 4)) { await p.locator('[data-trap] button[data-lit]').nth(i).click(); await wait(150) }
    }
    if (kind === 'quick') {
      if (bad(p)) { await p.locator('[data-trap] button').first().click(); return }
      await p.locator('[data-trap] button[data-go="1"]').waitFor({ timeout: 9000 }).catch(() => {})
      await p.locator('[data-trap] button').first().click()
    }
    if (kind === 'door') {
      // Luck, except the driver peeks so Dixxx reliably dies and the others live.
      const g = await hostGame()
      const deadly = g?.trap?.seats?.[p.playerId]?.deadly ?? 0
      await p.locator('[data-trap] button[aria-label^="Door"]').nth(bad(p) ? deadly : (deadly + 1) % 3).click()
    }
  }

  let lastKey = ''
  let qn = 0
  for (let guard = 0; guard < 6000; guard++) {
    if (await done()) break
    const phase = await attr(phones[0], 'data-phase')
    const step = await attr(phones[0], 'data-step')
    if (!phase) { await wait(300); continue }
    const key = `${phase}-${step}`
    const isNew = key !== lastKey
    lastKey = key
    if (!isNew) { await wait(250); continue }

    if (phase === 'intro') { await wait(800); await snap('intro'); continue }
    if (phase === 'question') {
      qn++
      await wait(400)
      const g = await hostGame()
      const right = g?.current?.answer ?? 0
      const wrong = (right + 1) % 4
      const plan = { torii: right, johnnyboy: qn === 2 || qn === 5 ? wrong : right, dixxx: qn === 1 ? wrong : right }
      // Johnnyboy answers first, then Dixxx, screenshot, then Torii.
      for (const [k, p] of phones.entries()) {
        await p.locator(`[data-answer="${plan[p.playerId] ?? right}"]`).click()
        await wait(350)
        if (k === Math.min(1, phones.length - 1)) await snap(`q${qn}-question`)
      }
      await wait(1200)
      await snap(`q${qn}-reveal`)
      continue
    }
    if (phase === 'trap') {
      const kind = await attr(phones[0], 'data-trap-kind')
      await wait(400)
      await snap(`trap-${kind}-intro`)
      // Everyone in the trap plays at once.
      const seats = (await hostGame())?.trap?.seats ?? {}
      const trapped = phones.filter((p) => seats[p.playerId])
      const mid = (async () => { await wait(kind === 'memory' ? 6200 : 3600); await snap(`trap-${kind}-play`) })()
      await Promise.all([...trapped.map((p) => playTrap(p, kind)), mid])
      continue
    }
    if (phase === 'trapResult') { await wait(300); await snap(`trapresult-${step}-mid`); await wait(1400); await snap(`trapresult-${step}`); continue }
    if (phase === 'finaleIntro') { await wait(800); await snap('finale-intro'); continue }
    if (phase === 'finaleQ') {
      await wait(500)
      const g = await hostGame()
      const key = g?.finale?.sort?.key ?? [0, 0, 0]
      // Right sorts per player: the ghost gets all three, Johnnyboy two, Torii one.
      const good = { dixxx: 3, johnnyboy: 2, torii: 1 }
      for (const [i, p] of phones.entries()) {
        const rows = p.locator('[data-side]')
        // Phones that aren't hosting can lag a moment behind the host.
        await rows.first().waitFor({ timeout: 15000 }).catch(() => {})
        const n = (await rows.count()) / 2
        const ok = good[p.playerId] ?? 2
        for (let k = 0; k < n; k++) await rows.nth(k * 2 + (k < ok ? key[k] : 1 - key[k])).click()
        if (i === 0) await snap(`${step}-sort-picked`)
        await p.getByRole('button', { name: 'Lock it in' }).click()
        await wait(300)
        if (i === Math.min(1, phones.length - 1)) await snap(`${step}-sort`)
      }
      await wait(2600)
      await snap(`${step}-finale-reveal`)
      // The door opens for whoever got out, once the steps have played.
      if ((await hostGame())?.winner) { await wait(200); await snap('escape') }
      continue
    }
    await wait(250)
  }
  await wait(1500)
  await shot('results')
  if (!(await done())) throw new Error('The game never reached the results screen')
  await phones[0].getByRole('button', { name: 'Next game' }).click()
  await wait(800)
  await phones[0].getByRole('button', { name: 'End the night' }).click()
  await wait(1200)
  await shot('summary')
}
