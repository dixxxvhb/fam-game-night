// QA driver for Phases. Plays round 1 through the phone UI the way people would:
// every player takes at least two full turns, someone lays down Phase 1 (with one wrong
// card first, to show the live explanation), someone hits, and Skips get aimed at people.
// Then it plays on quietly until someone goes out, to show the round summary and the next deal.
// The full-game path is covered by logic.test.ts.
//
// qa-room starts the game with the default options. In together mode this driver ends that
// game from the TV and restarts with Length = Odds. Apart mode has no "end game" control on
// phones, so it keeps the default (Full); round 1 is Phase 1 either way.

const COLORS = ['red', 'blue', 'green', 'yellow']
const dec = (id) => (id < 96 ? { kind: 'num', n: (id % 12) + 1, color: COLORS[Math.floor(id / 24)] } : id < 104 ? { kind: 'wild' } : { kind: 'skip' })
const isWild = (id) => id >= 96 && id < 104
const isSkip = (id) => id >= 104

/** Two sets of 3 out of a hand (wilds fill in, each set keeps a real card). */
function twoSets(hand) {
  const wilds = hand.filter(isWild)
  const byN = {}
  for (const id of hand) if (id < 96) (byN[dec(id).n] ||= []).push(id)
  const ns = Object.keys(byN).map(Number).sort((a, b) => byN[b].length - byN[a].length)
  for (let i = 0; i < ns.length; i++) {
    const a = byN[ns[i]]
    if (a.length >= 2 && a.length + wilds.length >= 6) {
      const k1 = Math.min(3, Math.ceil(a.length / 2))
      const k2 = Math.min(3, a.length - k1)
      const g1 = [...a.slice(0, k1), ...wilds.slice(0, 3 - k1)]
      const g2 = [...a.slice(k1, k1 + k2), ...wilds.slice(3 - k1, 3 - k1 + 3 - k2)]
      if (g1.length === 3 && g2.length === 3) return [g1, g2]
    }
    for (let j = i + 1; j < ns.length; j++) {
      const ga = byN[ns[i]].slice(0, 3)
      const gb = byN[ns[j]].slice(0, 3)
      const wa = 3 - ga.length
      const wb = 3 - gb.length
      if (wa + wb <= wilds.length) return [[...ga, ...wilds.slice(0, wa)], [...gb, ...wilds.slice(wa, wa + wb)]]
    }
  }
  return null
}

export default async function ({ tv, phones, shot, wait }) {
  if (tv) {
    await tv.getByRole('button', { name: 'End game' }).click()
    await wait(1200)
    const p0 = phones[0]
    await p0.locator('button[aria-expanded]', { hasText: /Phases/ }).first().click()
    await p0.getByRole('button', { name: /^Odds/ }).click()
    await shot('options-odds')
    await p0.getByRole('button', { name: 'Start Phases' }).click()
    await wait(1800)
  }
  await shot('start')

  const handOf = (p) => p.locator('[data-hand] button[data-card]').evaluateAll((els) => els.map((e) => Number(e.dataset.card)))
  const isDown = async (p) => (await p.locator('[data-down]').count()) > 0
  const phaseOf = async (p) => p.locator('[data-phase]').first().getAttribute('data-phase')

  async function currentPhone(ms = 12000) {
    const until = Date.now() + ms
    while (Date.now() < until) {
      for (const p of phones) if (await p.getByRole('button', { name: /Draw from deck/ }).count()) return p
      await wait(200)
    }
    return null
  }

  const turns = Object.fromEntries(phones.map((p) => [p.playerId, 0]))
  const laidN = {}
  let laid = false
  let hitDone = false
  let skipShot = false
  let roundOver = false
  let goalMet = false

  for (let t = 0; t < 90; t++) {
    const p = await currentPhone()
    if (!p) {
      if (await phones[0].getByText(/went out/).count()) { roundOver = true; break }
      console.log('No phone has the turn. Stopping.')
      break
    }
    const me = p.playerId
    const early = t < 6
    const loud = early || (!goalMet && t % 6 === 0)
    if (loud) await shot(`t${t}-${me}-draw`)

    // ---- draw ----
    let hand = await handOf(p)
    const down = await isDown(p)
    const takeAttr = await p.locator('button[data-take]').getAttribute('data-take')
    const top = takeAttr === '' || takeAttr === null ? null : Number(takeAttr)
    let take = false
    if (top !== null && !isSkip(top)) {
      if (isWild(top)) take = true
      else if (down) take = (laidN[me] ?? []).includes(dec(top).n)
      else take = hand.some((id) => id < 96 && dec(id).n === dec(top).n)
    }
    if (take) await p.locator('button[data-take]').click()
    else await p.getByRole('button', { name: /Draw from deck/ }).click()
    await p.locator('[role=tablist]').waitFor({ timeout: 8000 })
    await wait(early ? 900 : 250)
    if (early) await shot(`t${t}-${me}-drawn`)

    // ---- lay down Phase 1 ----
    hand = await handOf(p)
    const phase = await phaseOf(p)
    if (!down && phase === 'Phase 1') {
      const sets = twoSets(hand)
      if (sets) {
        await p.getByRole('tab', { name: 'Lay down' }).click()
        await wait(200)
        if (!laid) await shot(`laydown-${me}-empty`)
        const tapCard = (id) => p.locator(`[data-hand] button[data-card="${id}"]`).click()
        if (!laid) {
          // A wrong card first: the phone should say what's wrong.
          await tapCard(sets[0][0])
          await tapCard(sets[1][0])
          await wait(250)
          await shot(`laydown-${me}-wrong`)
          await p.locator(`button[data-slot-card="${sets[1][0]}"]`).click()
          await tapCard(sets[0][1])
          await tapCard(sets[0][2])
        } else {
          for (const id of sets[0]) await tapCard(id)
        }
        await wait(200)
        if (!laid) await shot(`laydown-${me}-half`)
        for (const id of sets[1]) await tapCard(id)
        await wait(250)
        if (!laid) await shot(`laydown-${me}-full`)
        await p.getByRole('button', { name: 'Lay it down' }).click()
        await p.locator('[data-down]').waitFor({ timeout: 8000 })
        laidN[me] = sets.map((g) => dec(g.find((id) => id < 96)).n)
        await wait(900)
        if (!laid) await shot(`laydown-${me}-done`)
        laid = true
      }
    }

    // ---- hit ----
    if (await isDown(p)) {
      await p.getByRole('tab', { name: 'Hit' }).click()
      await wait(200)
      for (let k = 0; k < 6; k++) {
        hand = await handOf(p)
        let placed = false
        for (const id of hand) {
          if (isSkip(id)) continue
          await p.locator(`[data-hand] button[data-card="${id}"]`).click()
          await wait(60)
          const spot = p.locator('button[data-spot]').first()
          if (await spot.count()) {
            if (!hitDone) await shot(`hit-${me}-pick`)
            const before = hand.length
            await spot.click()
            for (let w = 0; w < 40 && (await handOf(p)).length === before && (await p.locator('[role=tablist]').count()); w++) await wait(150)
            if (!hitDone) { await wait(900); await shot(`hit-${me}-done`) }
            hitDone = true
            placed = true
            break
          }
        }
        if (!placed || !(await p.locator('[role=tablist]').count())) break
      }
      if (!(await p.locator('[role=tablist]').count())) {
        // went out by hitting
        turns[me] += 1
        await wait(800)
        await shot(`t${t}-${me}-out`)
        roundOver = true
        break
      }
      if (hitDone && (await p.locator('[data-hand] button[aria-pressed="true"]').count())) {
        await p.locator('[data-hand] button[aria-pressed="true"]').first().click()
      }
    }

    // ---- discard ----
    await p.getByRole('tab', { name: 'Discard' }).click()
    await wait(150)
    hand = await handOf(p)
    const counts = {}
    for (const id of hand) if (id < 96) counts[dec(id).n] = (counts[dec(id).n] ?? 0) + 1
    const pick =
      hand.find(isSkip) ??
      [...hand].filter((id) => id < 96).sort((a, b) => counts[dec(a).n] - counts[dec(b).n] || dec(b).n - dec(a).n)[0] ??
      hand[0]
    await p.locator(`[data-hand] button[data-card="${pick}"]`).click()
    await wait(200)
    if (isSkip(pick) && (await p.locator('button[data-target]').count())) {
      const others = phones.filter((x) => x !== p)
      const victim = others[t % others.length].playerId
      await p.locator(`button[data-target="${victim}"]`).click()
      await wait(150)
      if (!skipShot) { await shot(`skip-${me}-target`); skipShot = true }
    } else if (early) {
      await shot(`t${t}-${me}-pick`)
    }
    await p.locator('button[data-confirm]').click()
    turns[me] += 1
    for (let w = 0; w < 40 && (await p.locator('[role=tablist]').count()); w++) await wait(150)
    await wait(900) // let every phone catch the broadcast before the shot
    if (hand.length === 1) { roundOver = true; await wait(600); await shot(`t${t}-${me}-out`); break }
    if (early) await shot(`t${t}-${me}-after`)

    const everyoneTwice = Object.values(turns).every((n) => n >= 2)
    if (!goalMet && everyoneTwice && laid && hitDone) { await shot(`t${t}-goal-met`); goalMet = true }
  }

  if (roundOver) {
    await wait(1500)
    await shot('round-summary')
    await wait(9000)
    await shot('round-2-dealt')
  }

  // Together mode: put the current player's phone to sleep and watch the table play for them.
  if (tv && roundOver) {
    const p = await currentPhone()
    if (p) {
      const name = p.playerId
      phones.splice(phones.indexOf(p), 1)
      await p.context().close()
      for (let i = 0; i < 90 && !(await tv.getByText(/Phone asleep/).count()); i++) await wait(1000)
      await shot(`asleep-${name}`)
      for (let i = 0; i < 70 && (await tv.getByText(/Phone asleep/).count()); i++) await wait(1000)
      await wait(1000)
      await shot(`asleep-${name}-played`)
    }
  }
  console.log(`Phases driver: turns ${JSON.stringify(turns)}, laid ${laid}, hit ${hitDone}, round over ${roundOver}`)
}
