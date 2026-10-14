// QA driver for Board Night. Start it with --opts Short so the game is 6 turns.
// Every phone runs its own loop and plays through the phone UI the way a person would:
// roll (sometimes using an item first), pick forks, buy Stars, shop, pick duel and steal
// targets, tap Ready, and play every minigame with real taps (mash, wait for NOW, stop the
// clock near 10, repeat the Memory colors it watched, find the odd tile, pass the bomb,
// tap the Eight Count on the lit counts, read the Stroop ink, solve the sums, guess a number,
// hit the lit tiles). A watcher loop screenshots the TV and every phone at each turn,
// notable board moments, and every minigame intro, play and result, then bonus stars and
// the final, then the results screen.
export default async function ({ tv, phones, shot, wait }) {
  const log = (...a) => console.log('[board]', ...a)
  const T0 = Date.now()
  const LIMIT = 30 * 60_000
  const failures = []
  let over = false
  const seenMg = new Set()
  const counts = { rolls: 0, items: 0, forks: 0, stars: 0, shops: 0, picks: 0, ready: 0, mash: 0, qd: 0, early: 0, stops: 0, mem: 0, odd: 0, pass: 0, eight: 0, stroop: 0, math: 0, guess: 0, reflex: 0 }

  const rand = (a, b) => a + Math.random() * (b - a)
  const vis = async (p, sel) => { try { const l = p.locator(sel).first(); return (await l.count()) > 0 && (await l.isVisible()) } catch { return false } }
  const click = async (p, sel) => { try { await p.locator(sel).first().click({ timeout: 1500 }); return true } catch { return false } }
  const tapEl = async (p, sel) => {
    try {
      const b = await p.locator(sel).first().boundingBox()
      if (!b) return false
      await p.touchscreen.tap(b.x + b.width * rand(0.3, 0.7), b.y + b.height * rand(0.3, 0.7))
      return true
    } catch { return false }
  }
  const info = async (p) => {
    try {
      return await p.evaluate(() => {
        const el = document.querySelector('[data-board-stage]')
        if (!el) return null
        return { stage: el.getAttribute('data-board-stage'), turn: Number(el.getAttribute('data-turn')), cur: el.getAttribute('data-cur'), mg: el.getAttribute('data-mg'), no: Number(el.getAttribute('data-mg-no')), bonus: Number(el.getAttribute('data-bonus')) }
      })
    } catch { return null }
  }
  const resultsUp = async () => {
    for (const p of phones) if (await vis(p, 'button:has-text("Next game")')) return true
    return false
  }

  // ---------------- minigame players ----------------

  async function playMash(p) {
    const until = Date.now() + 9500
    while (Date.now() < until && !over) {
      const txt = await p.locator('[data-mash]').first().innerText().catch(() => '')
      if (!txt) break
      if (/Done/.test(txt)) break
      if (/TAP/.test(txt)) { await tapEl(p, '[data-mash]'); counts.mash += 1; await wait(rand(40, 90)) } else await wait(100)
    }
  }

  async function playQuickDraw(p, i) {
    let tapped = new Set()
    const until = Date.now() + 30000
    while (Date.now() < until && !over) {
      const st = await info(p)
      if (!st || st.stage !== 'mgPlay') break
      const sub = await p.locator('text=/Round \\d of 3/').first().innerText().catch(() => '')
      const round = (sub.match(/Round (\d)/) ?? [])[1] ?? '?'
      const state = await p.locator('[data-qd]').first().getAttribute('data-qd').catch(() => null)
      if (!state) { await wait(100); continue }
      if (!tapped.has(round)) {
        // Phone 3 jumps the gun in round 2 now and then.
        if (state === 'wait' && i === 2 && round === '2' && Math.random() < 0.02) { await tapEl(p, '[data-qd]'); tapped.add(round); counts.early += 1 }
        else if (state === 'now') { await wait(rand(120, 320)); await tapEl(p, '[data-qd]'); tapped.add(round); counts.qd += 1 }
      }
      await wait(40)
    }
  }

  async function playClock(p) {
    const seenAt = Date.now()
    const target = seenAt + rand(9300, 10600)
    while (Date.now() < target && !over) await wait(50)
    if (await vis(p, '[data-stop]:not([disabled])')) { await tapEl(p, '[data-stop]'); counts.stops += 1 }
    while (!over) { const st = await info(p); if (!st || st.stage !== 'mgPlay') break; await wait(300) }
  }

  async function playMemory(p, i) {
    const watched = {}
    const until = Date.now() + 60000
    while (Date.now() < until && !over) {
      const st = await info(p)
      if (!st || st.stage !== 'mgPlay') break
      const ph = await p.evaluate(() => {
        const el = document.querySelector('[data-mem-phase]')
        if (!el) return null
        const lit = el.querySelector('[data-pad][data-lit="1"]')
        return { phase: el.getAttribute('data-mem-phase'), r: Number(el.getAttribute('data-mem-round')), lit: lit ? Number(lit.getAttribute('data-pad')) : null, can: !el.querySelector('[data-pad]')?.hasAttribute('disabled') }
      }).catch(() => null)
      if (!ph) { await wait(60); continue }
      const w = (watched[ph.r] ??= { seq: [], last: null, done: false })
      if (ph.phase === 'show') {
        if (ph.lit !== null && w.last === null) w.seq.push(ph.lit)
        w.last = ph.lit
        await wait(35)
        continue
      }
      if (ph.phase === 'input' && ph.can && !w.done) {
        w.done = true
        const seq = [...w.seq]
        // Phone 2 fumbles from the third round on.
        if (i === 1 && ph.r >= 2 && seq.length) seq[seq.length - 1] = (seq[seq.length - 1] + 1) % 4
        for (const v of seq) { await tapEl(p, `[data-pad="${v}"]`); await wait(rand(180, 300)) }
        counts.mem += 1
      }
      await wait(80)
    }
  }

  async function playOdd(p) {
    const until = Date.now() + 32000
    while (Date.now() < until && !over) {
      const st = await info(p)
      if (!st || st.stage !== 'mgPlay') break
      const pick = await p.evaluate(() => {
        const tiles = [...document.querySelectorAll('[data-tile][data-color]')]
        if (!tiles.length) return null
        const by = new Map()
        for (const t of tiles) by.set(t.getAttribute('data-color'), [...(by.get(t.getAttribute('data-color')) ?? []), t.getAttribute('data-tile')])
        const odd = [...by.values()].find((list) => list.length === 1)
        return odd ? odd[0] : null
      }).catch(() => null)
      if (pick !== null) { await wait(rand(400, 900)); await tapEl(p, `[data-tile="${pick}"]`); counts.odd += 1; await wait(350) } else await wait(150)
    }
  }

  async function playPotato(p) {
    const until = Date.now() + 45000
    while (Date.now() < until && !over) {
      const st = await info(p)
      if (!st || st.stage !== 'mgPlay') break
      if (await vis(p, '[data-potato="mine"]')) { await wait(rand(250, 1100)); await tapEl(p, '[data-potato]'); counts.pass += 1; await wait(300) } else await wait(80)
    }
  }

  async function playEight(p) {
    let lastKey = ''
    const until = Date.now() + 40000
    while (Date.now() < until && !over) {
      const st = await info(p)
      if (!st || st.stage !== 'mgPlay') break
      const b = await p.evaluate(() => {
        const el = document.querySelector('[data-eight]')
        return el ? { phase: el.getAttribute('data-eight'), count: el.getAttribute('data-count'), hit: el.getAttribute('data-hit'), sub: document.body.innerText.match(/Eight (\d) of/)?.[1] ?? '' } : null
      }).catch(() => null)
      if (b && b.phase === 'count' && b.hit === '1') {
        const key = `${b.sub}-${b.count}`
        if (key !== lastKey) { lastKey = key; await tapEl(p, '[data-eight]'); counts.eight += 1 }
      }
      await wait(20)
    }
  }

  async function playStroop(p) {
    const until = Date.now() + 18000
    while (Date.now() < until && !over) {
      const st = await info(p)
      if (!st || st.stage !== 'mgPlay') break
      const ink = await p.locator('[data-stroop]').first().getAttribute('data-ink', { timeout: 200 }).catch(() => null)
      if (ink !== null) { await tapEl(p, `[data-ink-btn="${ink}"]`); counts.stroop += 1; await wait(rand(250, 500)) } else await wait(100)
    }
  }

  async function playMath(p) {
    const until = Date.now() + 32000
    let last = ''
    while (Date.now() < until && !over) {
      const st = await info(p)
      if (!st || st.stage !== 'mgPlay') break
      const sum = await p.locator('[data-sum]').first().getAttribute('data-sum', { timeout: 200 }).catch(() => null)
      if (sum && sum !== last) {
        last = sum
        // eslint-disable-next-line no-new-func
        const v = Function(`return ${sum.replace('x', '*')}`)()
        await wait(rand(700, 1400))
        await tapEl(p, `[data-answer="${v}"]`)
        counts.math += 1
      }
      await wait(120)
    }
  }

  async function playClosest(p) {
    await wait(rand(1500, 4000))
    const guess = String(Math.floor(rand(10, 95)))
    for (const d of guess) { await click(p, `[data-keypad] button[aria-label="${d}"]`); await wait(120) }
    await click(p, '[data-keypad] button[aria-label="Lock it in"]')
    counts.guess += 1
    while (!over) { const st = await info(p); if (!st || st.stage !== 'mgPlay') break; await wait(300) }
  }

  async function playReflex(p) {
    const until = Date.now() + 18000
    while (Date.now() < until && !over) {
      const st = await info(p)
      if (!st || st.stage !== 'mgPlay') break
      if (await vis(p, '[data-tile][data-lit="1"]')) { await tapEl(p, '[data-tile][data-lit="1"]'); counts.reflex += 1; await wait(rand(150, 300)) } else await wait(80)
    }
  }

  const PLAY = { mash: playMash, quickdraw: playQuickDraw, clock: playClock, memory: playMemory, oddone: playOdd, potato: playPotato, eight: playEight, stroop: playStroop, math: playMath, closest: playClosest, reflex: playReflex }

  // ---------------- each phone ----------------

  async function phoneLoop(p, i) {
    const played = new Set()
    while (!over && Date.now() - T0 < LIMIT) {
      const st = await info(p)
      if (!st) { await wait(300); continue }
      if (st.stage === 'mgPlay') {
        const key = `${st.no}`
        if (!played.has(key)) {
          // Wait out the 3-2-1.
          const pad = st.mg === 'mash' ? '[data-mash]' : st.mg === 'quickdraw' ? '[data-qd]' : st.mg === 'clock' ? '[data-stop]' : st.mg === 'memory' ? '[data-mem-phase]' : st.mg === 'oddone' ? '[data-tile]' : st.mg === 'potato' ? '[data-potato]' : st.mg === 'eight' ? '[data-eight]' : st.mg === 'stroop' ? '[data-ink-btn]' : st.mg === 'math' ? '[data-sum]' : st.mg === 'closest' ? '[data-keypad]' : '[data-tile]'
          let ok = false
          for (let k = 0; k < 60 && !ok; k++) { ok = await vis(p, pad); if (!ok) { const again = await info(p); if (!again || again.stage !== 'mgPlay') break; await wait(100) } }
          if (ok) { played.add(key); await PLAY[st.mg]?.(p, i) }
          else await wait(200)
        } else await wait(200)
        continue
      }
      if (await vis(p, '[data-board="ready"]:not([disabled])')) { await wait(rand(300, 1500)); await click(p, '[data-board="ready"]'); counts.ready += 1; continue }
      if (await vis(p, '[data-board="roll"]')) {
        await wait(rand(400, 1400))
        if (await vis(p, '[data-board="item"]') && Math.random() < 0.6) {
          await click(p, '[data-board="item"]')
          counts.items += 1
          await wait(400)
          if (await vis(p, '[data-board^="target-"]')) await click(p, '[data-board^="target-"]')
          else if (await vis(p, '[data-board^="value-"]')) await click(p, `[data-board="value-${1 + Math.floor(Math.random() * 6)}"]`)
          await wait(700)
          continue
        }
        if (await click(p, '[data-board="roll"]')) counts.rolls += 1
        continue
      }
      if (await vis(p, '[data-board^="fork-"]')) { await wait(rand(500, 1500)); await click(p, `[data-board="fork-${Math.random() < 0.5 ? 0 : 1}"]`); counts.forks += 1; continue }
      if (await vis(p, '[data-board="star-yes"]')) { await wait(rand(500, 1200)); if (!(await click(p, '[data-board="star-yes"]:not([disabled])'))) await click(p, '[data-board="star-no"]'); counts.stars += 1; continue }
      if (await vis(p, '[data-board="shop-none"]')) {
        await wait(rand(800, 1800))
        const buy = Math.random() < 0.5 && (await click(p, '[data-board^="shop-"]:not([data-board="shop-none"]):not([disabled])'))
        if (!buy) await click(p, '[data-board="shop-none"]')
        counts.shops += 1
        continue
      }
      if (await vis(p, '[data-board^="duel-"]')) { await wait(rand(500, 1500)); await click(p, '[data-board^="duel-"]'); counts.picks += 1; continue }
      if (await vis(p, '[data-board^="target-"]')) { await wait(rand(500, 1500)); await click(p, '[data-board^="target-"]'); counts.picks += 1; continue }
      await wait(250)
    }
  }

  // ---------------- watcher: screenshots ----------------

  async function watcher() {
    let last = ''
    let lastTurn = 0
    const notable = {}
    while (!over && Date.now() - T0 < LIMIT) {
      if (await resultsUp()) { over = true; break }
      const st = await info(phones[0])
      if (!st) { await wait(300); continue }
      const key = `${st.stage}-${st.turn}-${st.no}-${st.bonus}-${st.cur}`
      if (key !== last) {
        last = key
        const tag = `t${st.turn}`
        if (st.stage === 'turnStart' && st.turn !== lastTurn) { lastTurn = st.turn; await wait(600); await shot(`${tag}-start`) }
        else if (st.stage === 'moving' && (notable[`move-${st.turn}`] ?? 0) < 1) { notable[`move-${st.turn}`] = 1; await wait(500); await shot(`${tag}-moving`) }
        else if (st.stage === 'roll' && (st.turn === 1 || (notable[`roll-${st.turn}`] ?? 0) < 1)) { notable[`roll-${st.turn}`] = (notable[`roll-${st.turn}`] ?? 0) + 1; await wait(400); await shot(`${tag}-roll-${st.cur}`) }
        else if (['fork', 'star', 'shop', 'event', 'eventPick', 'duelPick', 'lastFive', 'intro'].includes(st.stage) && (notable[st.stage] ?? 0) < 2) { notable[st.stage] = (notable[st.stage] ?? 0) + 1; await wait(700); await shot(`${tag}-${st.stage}`) }
        else if (st.stage === 'land' && (notable[`land-${st.turn}`] ?? 0) < 1) { notable[`land-${st.turn}`] = 1; await wait(500); await shot(`${tag}-land`) }
        else if (st.stage === 'mgIntro') { seenMg.add(st.mg); await wait(900); await shot(`mg${st.no}-${st.mg}-intro`) }
        else if (st.stage === 'mgPlay') {
          await wait(4300)
          const again = await info(phones[0])
          if (again && again.stage === 'mgPlay') await shot(`mg${st.no}-${st.mg}-play`)
          await wait(st.mg === 'mash' ? 1500 : 6000)
          const later = await info(phones[0])
          if (later && later.stage === 'mgPlay' && later.no === st.no) await shot(`mg${st.no}-${st.mg}-play2`)
        }
        else if (st.stage === 'mgResult') { await wait(900); await shot(`mg${st.no}-${st.mg}-result`) }
        else if (st.stage === 'bonus') { await wait(600); await shot(`bonus-${st.bonus}`) }
        else if (st.stage === 'final') { await wait(1200); await shot('final') }
      }
      await wait(200)
    }
    over = true
  }

  await Promise.all([watcher(), ...phones.map((p, i) => phoneLoop(p, i))])

  if (!(await resultsUp())) failures.push('never reached results')
  await wait(1500)
  await shot('results')
  const where = tv ?? phones[0]
  log('results:', (await where.locator('main').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300))
  log('minigames played:', [...seenMg].join(', '))
  log('inputs:', JSON.stringify(counts))
  log(`took ${Math.round((Date.now() - T0) / 1000)} s`)

  if (await phones[0].getByRole('button', { name: 'Next game' }).count()) {
    await phones[0].getByRole('button', { name: 'Next game' }).click()
    await wait(800)
    await phones[0].getByRole('button', { name: 'End the night' }).click().catch(() => {})
    await wait(1200)
    await shot('summary')
  }
  if (failures.length) {
    log('FAILURES:')
    for (const f of failures) log(' -', f)
    process.exitCode = 1
  } else log('all checks passed')
}
