// QA driver for Quip: every phone answers every prompt through the phone UI (with an 80-character
// answer, one unbroken word and a safety quip), then votes. Round 1 prompt 2 is set up as a clean
// sweep, round 2 prompt 1 as a House win, Last Quip stacks votes and uses Start over. In together
// mode one phone skips the Last Quip so a "No answer" card shows. TV + phones are shot at answer,
// vote and reveal in every round. Ends the night after the game.
export default async function ({ tv, phones, shot, wait }) {
  const together = Boolean(tv)
  const lead = phones[0]
  const stageOf = async (p) => {
    try { return await p.locator('[data-quip-stage]').first().getAttribute('data-quip-stage', { timeout: 400 }) } catch { return null }
  }
  async function until(fn, ms = 130_000, step = 300) {
    const t0 = Date.now()
    while (Date.now() - t0 < ms) { if (await fn()) return true; await wait(step) }
    console.log('  (timed out waiting)')
    return false
  }
  // Wait for the lead phone, then give every other phone a few seconds to catch up before shooting.
  const at = async (want) => {
    await until(async () => want.includes(await stageOf(lead)))
    await until(async () => { for (const p of phones) if (!want.includes(await stageOf(p))) return false; return true }, 5_000)
  }

  const LONG = 'This answer is the full eighty characters so we can see if the card wraps right'.padEnd(80, '!')
  const LONG2 = 'Another one at the limit: glitter, gators, I-4, hairspray, and a strong opinion.'.padEnd(80, '.').slice(0, 80)
  const UNBROKEN = 'Supercalifragilisticexpialidociouslyoverchoreographed'
  const bank = [
    ['A gator in a tracksuit', LONG, 'Honestly the vibes were off', 'The House can keep it', LONG2],
    [UNBROKEN, 'Five six seven eight and run', 'Rhinestones on everything', 'A strongly worded hug', 'Never again'],
    ['Somebody call my agent', 'Wet socks, emotionally', 'It was like that when I got here', 'Too much hairspray', 'Spite, mostly'],
  ]
  const used = phones.map(() => 0)
  const typedBy = phones.map(() => [])
  const allTyped = () => typedBy.flat()

  async function answerAll(p, idx, round) {
    for (let k = 0; k < 4; k++) {
      if ((await stageOf(p)) !== 'answer') return
      if (round === 1 && idx === 2 && k === 0) {
        await p.getByRole('button', { name: 'Safety quip' }).click()
      } else if (together && round === 3 && idx === 1) {
        return // leaves the Last Quip blank: "No answer"
      } else {
        const t = bank[idx % bank.length][used[idx]++ % 5]
        typedBy[idx].push(t)
        await p.getByLabel('Your answer').fill(t)
        await p.getByRole('button', { name: /Next prompt|Send it/ }).click()
      }
      await wait(450)
    }
  }

  const openCards = (p) => p.locator('[data-vote-card]:not([disabled])')
  async function cardWith(p, texts) {
    const cards = openCards(p)
    const n = await cards.count()
    for (let i = 0; i < n; i++) {
      const t = await cards.nth(i).innerText()
      if (texts.some((x) => t.includes(x))) return cards.nth(i)
    }
    return null
  }
  async function houseCard(p) {
    const cards = openCards(p)
    const n = await cards.count()
    const mine = allTyped()
    for (let i = 0; i < n; i++) {
      const t = await cards.nth(i).innerText()
      if (!mine.some((x) => t.includes(x))) return cards.nth(i)
    }
    return cards.first()
  }

  async function voteOn(p, idx, round, k) {
    if (round === 3) {
      if (idx === 2) {
        await openCards(p).first().click()
        await wait(300)
        await p.getByRole('button', { name: 'Start over' }).click()
        await wait(400)
      }
      for (let v = 0; v < 3; v++) {
        const c = idx === 0 && v === 2 ? openCards(p).last() : openCards(p).first()
        if (!(await c.count())) break
        await c.click()
        await wait(250)
      }
      return
    }
    let target = null
    if (round === 1 && k === 1 && idx !== 0) target = await cardWith(p, typedBy[0])
    if (round === 2 && k === 0) target = await houseCard(p)
    if (!target) target = openCards(p).first()
    await target.click()
  }

  for (let round = 1; round <= 3; round++) {
    await at(['answer'])
    await wait(700)
    await shot(`r${round}-answer`)
    for (let idx = 0; idx < phones.length; idx++) {
      await answerAll(phones[idx], idx, round)
      if (idx === 0) { await wait(500); await shot(`r${round}-answer-one-in`) }
    }
    const prompts = round === 3 ? 1 : phones.length >= 5 ? 3 : 2
    for (let k = 0; k < prompts; k++) {
      await at(['vote'])
      await wait(800)
      await shot(`r${round}-p${k + 1}-vote`)
      for (let idx = 0; idx < phones.length; idx++) {
        await voteOn(phones[idx], idx, round, k)
        if (idx === 0) { await wait(600); await shot(`r${round}-p${k + 1}-one-voted`) }
      }
      if (round === 3) { await wait(300) }
      await at(['reveal'])
      await wait(3000)
      await shot(`r${round}-p${k + 1}-reveal-mid`)
      await wait(4300)
      await shot(`r${round}-p${k + 1}-reveal`)
    }
    if (round < 3) {
      await at(['scores'])
      await wait(900)
      await shot(`r${round}-scores`)
    }
  }

  await until(async () => (await lead.getByRole('button', { name: 'Next game' }).count()) > 0, 30_000)
  await wait(1000)
  await shot('results')
  await lead.getByRole('button', { name: 'Next game' }).click()
  await wait(800)
  await lead.getByRole('button', { name: 'End the night' }).click()
  await wait(1200)
  await shot('summary')
}
