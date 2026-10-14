// QA driver for Trivia Night: plays a whole game through the phones. The underdog picks a
// category every time; Johnnyboy answers right and fast, Torii right but slower on most,
// Dixxx is right about half the time; everyone wagers in the final. Screens once per phase
// per round, then results.
export default async function ({ tv, phones, shot, wait }) {
  // The host saves its room to localStorage on every change: read the answer key from there
  // so the driver can be right or wrong on purpose (QA only; the app never shows it).
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
  const phaseOf = async (p) => {
    const el = p.locator('[data-phase]').first()
    if (!(await el.count())) return null
    return { phase: await el.getAttribute('data-phase'), step: await el.getAttribute('data-step') }
  }
  const done = async () => (await phones[0].getByRole('button', { name: 'Next game' }).count()) > 0

  let lastKey = ''
  let questions = 0
  for (let guard = 0; guard < 6000; guard++) {
    if (await done()) break
    const cur = await phaseOf(phones[0])
    if (!cur) { await wait(300); continue }
    const round = cur.step.split('-')[0]
    const key = `${cur.phase}-${cur.step}`
    const isNew = key !== lastKey
    lastKey = key

    if (cur.phase === 'pick' && isNew) {
      await wait(600)
      await snap(`r${round}-pick`)
      for (const p of phones) {
        const cats = p.locator('[data-cat]')
        if (await cats.count()) { await cats.nth(questions % 3).click(); break }
      }
      continue
    }
    if (cur.phase === 'spin' && isNew) {
      await wait(1200)
      await snap(`r${round}-spin-mid`)
      await wait(2800)
      await snap(`r${round}-spin-landed`)
      continue
    }
    if (cur.phase === 'finalSpin' && isNew) {
      await wait(1200)
      await snap('final-spin-mid')
      await wait(2800)
      await snap('final-spin-landed')
      continue
    }
    if ((cur.phase === 'question' || cur.phase === 'finalQ') && isNew) {
      questions++
      const tag = cur.phase === 'finalQ' ? 'final-q' : `r${round}-question`
      await wait(500)
      const g = await hostGame()
      const right = g?.current?.answer ?? 0
      // Johnnyboy first and right, then Dixxx (right every other one), screenshot, then Torii.
      const plan = { johnnyboy: right, dixxx: questions % 2 ? right : (right + 1) % 4, torii: questions % 3 ? right : (right + 2) % 4 }
      for (const [k, p] of phones.entries()) {
        const pick = plan[p.playerId] ?? (right + k) % 4
        await p.locator(`[data-answer="${pick}"]`).click()
        await wait(k === 0 ? 900 : 500)
        if (k === Math.min(1, phones.length - 1)) await snap(tag)
      }
      await wait(cur.phase === 'finalQ' ? 2200 : 900)
      await snap(cur.phase === 'finalQ' ? 'final-reveal' : `r${round}-reveal`)
      continue
    }
    if (cur.phase === 'roundIntro' && isNew) {
      await wait(700)
      await snap(`r${round}-intro`)
      continue
    }
    if (cur.phase === 'wager' && isNew) {
      await wait(700)
      await snap('wager-open')
      const style = ['All', 'Half', 'None']
      for (const [i, p] of phones.entries()) {
        await p.getByRole('button', { name: style[i % 3], exact: true }).click()
        if (i === 0) await wait(300)
        if (i === 0) await snap('wager-moved')
        await p.getByRole('button', { name: /^Lock in/ }).click()
        await wait(300)
        if (i === 0) await snap('wager-locked-one')
      }
      continue
    }
    await wait(250)
  }
  await wait(1200)
  await shot('results')
  if (!(await done())) throw new Error('The game never reached the results screen')
  await phones[0].getByRole('button', { name: 'Next game' }).click()
  await wait(800)
  await phones[0].getByRole('button', { name: 'End the night' }).click()
  await wait(1200)
  await shot('summary')
}
