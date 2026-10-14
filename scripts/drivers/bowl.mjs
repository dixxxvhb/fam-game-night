// QA driver for Bowl. Whoever is up swipes a throw on their phone's lane (no motion sensor
// in Playwright, so this is the swipe fallback): sometimes they slide the ball over or drag
// the aim arrow first, and the swipe speed and sideways drift vary. Plays to the end.
// Screens: aim, mid-roll, pin action and result for every ball of frame 1 and the first
// ball of every later frame, the scoreboard whenever a frame turns over, then results.
//   BOWL_QUICK=1 stops after frame 1 (for iterating on looks).
export default async function ({ tv, phones, shot, wait }) {
  const log = (...a) => console.log('[bowl]', ...a)
  const failures = []
  const quick = process.env.BOWL_QUICK === '1'
  const watcher = tv ?? phones[0]

  const resultsUp = async () => {
    for (const p of phones) if (await p.getByRole('button', { name: 'Next game' }).count()) return true
    return false
  }
  const padOn = async (p) => (await p.locator('[data-bowl-pad]').count()) > 0
  async function whoIsUp(ms) {
    const t0 = Date.now()
    while (Date.now() - t0 < ms) {
      for (const p of phones) if (await padOn(p)) return p
      if (await resultsUp()) return 'done'
      await wait(250)
    }
    return null
  }
  async function frameInfo(p) {
    const t = await p.locator('text=/Frame \\d+ of \\d+ · Ball \\d/').first().innerText().catch(() => '')
    const m = t.match(/Frame (\d+) of (\d+) · Ball (\d)/)
    return m ? { frame: Number(m[1]), of: Number(m[2]), ball: Number(m[3]) } : null
  }
  async function laneFrame() {
    return watcher.evaluate(() => {
      const c = document.querySelector('canvas[data-lane]')
      if (!c) return null
      return { f: c.dataset.frame, hit: Number(c.dataset.hit ?? -1), n: Number(c.dataset.n ?? 0) }
    })
  }

  // Throw styles, cycled with some jitter: [ball slide px, arrow drag px, swipe ms, drift px]
  const STYLES = [
    [38, -6, 150, -40],
    [0, 0, 230, 0],
    [-30, 10, 120, 55],
    [45, -12, 180, -70],
    [10, -3, 380, -15],
    [55, 0, 100, -30],
    [0, 4, 140, 0],
    [-50, 14, 200, 35],
  ]

  async function swipe(p, style, k) {
    const pad = p.locator('[data-bowl-pad]').first()
    const box = await pad.boundingBox()
    const ds = await pad.evaluate((el) => ({ ...el.dataset }))
    let bx = box.x + Number(ds.ballX)
    const by = box.y + Number(ds.ballY)
    const [slide, arrow, ms, drift] = style.map((v, i) => (i === 2 ? v * (0.85 + Math.random() * 0.3) : v + (Math.random() - 0.5) * Math.abs(v) * 0.4))
    if (Math.abs(slide) > 4) {
      await p.mouse.move(bx, by)
      await p.mouse.down()
      for (let i = 1; i <= 6; i++) { await p.mouse.move(bx + (slide * i) / 6, by + 1); await wait(16) }
      await p.mouse.up()
      await wait(200)
      bx += slide
    }
    if (Math.abs(arrow) > 2) {
      const ds2 = await pad.evaluate((el) => ({ ...el.dataset }))
      const hx = box.x + Number(ds2.handleX)
      const hy = box.y + Number(ds2.handleY)
      await p.mouse.move(hx, hy)
      await p.mouse.down()
      for (let i = 1; i <= 5; i++) { await p.mouse.move(hx + (arrow * i) / 5, hy); await wait(16) }
      await p.mouse.up()
      await wait(200)
    }
    if (k === 0) await shot('aim-setup')
    const ds3 = await pad.evaluate((el) => ({ ...el.dataset }))
    const sx = box.x + Number(ds3.ballX)
    const sy = box.y + Number(ds3.ballY)
    const up = 300
    const steps = ms < 170 ? 6 : 10
    await p.mouse.move(sx, sy)
    await p.mouse.down()
    for (let i = 1; i <= steps; i++) {
      const f = i / steps
      await p.mouse.move(sx + drift * f * f, sy - up * f)
      await wait(ms / steps)
    }
    await p.mouse.up()
    return { slide: Math.round(slide), arrow: Math.round(arrow), ms: Math.round(ms), drift: Math.round(drift) }
  }

  // The motion swing, faked: Playwright has no sensors, so feed the page devicemotion events
  // while holding the swing button. Peak push = speed, wrist turn (gamma) late in the swing = curve.
  async function motionThrow(p, strength, twist) {
    await p.evaluate(() => {
      for (let i = 0; i < 3; i++) window.dispatchEvent(new DeviceMotionEvent('devicemotion', { acceleration: { x: 0, y: 0, z: 0.2 }, rotationRate: { alpha: 0, beta: 0, gamma: 0 }, interval: 16 }))
    })
    const btn = p.getByRole('button', { name: 'Hold, swing, let go' })
    await btn.waitFor({ timeout: 3000 })
    if (!motionShot) { motionShot = true; await shot('motion-ready') }
    const b = await btn.boundingBox()
    await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
    await p.mouse.down()
    await p.evaluate(async ({ strength, twist }) => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      for (let i = 0; i < 36; i++) {
        const t = i / 35
        const a = Math.sin(Math.PI * t) * strength
        window.dispatchEvent(new DeviceMotionEvent('devicemotion', {
          acceleration: { x: 0, y: a, z: a * 0.3 },
          rotationRate: { alpha: 0, beta: Math.sin(Math.PI * t) * 380, gamma: t > 0.5 ? twist : 0 },
          interval: 16,
        }))
        await sleep(16)
      }
    }, { strength, twist })
    await p.mouse.up()
    return { motion: true, strength, twist }
  }

  let motionShot = false
  let throws = 0
  let lastFrame = 0
  const botShots = new Set()
  let botWaits = 0
  for (let k = 0; k < 120; k++) {
    // Solo: the bots can take a minute or more between our turns.
    const p = await whoIsUp(phones.length === 1 ? 180000 : 45000)
    if (p === 'done') break
    if (!p) { failures.push('nobody got the pad in time'); break }
    const info = await frameInfo(p)
    if (info && info.frame !== lastFrame) {
      if (lastFrame > 0) await shot(`frame${lastFrame}-board`)
      if (quick && lastFrame >= 1) break
      lastFrame = info.frame
    }
    const full = !info || info.frame === 1 || info.ball === 1
    const label = info ? `f${info.frame}b${info.ball}-${p.playerId}` : `t${throws}`
    if (full) await shot(`${label}-aim`)
    const style = STYLES[(throws + k) % STYLES.length]
    const useMotion = p === phones[0] && info && info.ball === 1 && (info.frame === 2 || info.frame === 4)
    const how = useMotion ? await motionThrow(p, 14 + Math.random() * 12, -(80 + Math.random() * 120)) : await swipe(p, style, throws)
    throws += 1
    log(label, JSON.stringify(how))
    // Wait for the replay to start, then grab mid-roll and the pins flying.
    let lf = null
    for (let i = 0; i < 30; i++) { lf = await laneFrame(); if (lf && lf.f !== 'aim') break; await wait(100) }
    if (!lf || lf.f === 'aim') {
      // The swipe didn't take (too short / slow). Try again next loop.
      failures.push(`${label}: swipe did not throw`)
      continue
    }
    if (full) {
      for (let i = 0; i < 80; i++) { lf = await laneFrame(); if (Number(lf?.f) >= Math.max(10, (lf?.hit ?? 30) * 0.55)) break; await wait(50) }
      await shot(`${label}-mid`)
      if ((lf?.hit ?? -1) >= 0) {
        for (let i = 0; i < 80; i++) { lf = await laneFrame(); if (Number(lf?.f) >= lf.hit + 5) break; await wait(50) }
        await shot(`${label}-pins`)
      }
    }
    let res = null
    for (let i = 0; i < 160 && !res; i++) {
      res = await watcher.locator('[data-result]').first().getAttribute('data-result').catch(() => null)
      if (!res) await wait(100)
    }
    const word = res ? (await watcher.locator('[data-result]').first().innerText().catch(() => '')).trim() : null
    log(`  -> ${res} ${word}`)
    if (!res) failures.push(`${label}: no result shown`)
    if (full) await shot(`${label}-result`)
    // Let the result clear before looking for the next bowler.
    for (let i = 0; i < 40; i++) { if (!(await watcher.locator('[data-result]').count())) break; await wait(100) }
    // Solo: bots bowl on their own between our turns. Catch one of them mid-roll each frame.
    if (phones.length === 1 && info && !botShots.has(info.frame)) {
      for (let i = 0; i < 120; i++) {
        if (await padOn(p) || (await resultsUp())) break
        const l = await laneFrame()
        if (l && l.f !== 'aim' && Number(l.f) >= 25) { botShots.add(info.frame); await shot(`f${info.frame}-bot-roll`); botWaits += 1; break }
        await wait(100)
      }
    }
  }
  if (!quick) {
    for (let i = 0; i < 60 && !(await resultsUp()); i++) await wait(1000)
    if (!(await resultsUp())) failures.push('never reached results')
    await shot(`frame${lastFrame}-board`)
    await wait(800)
    await shot('results')
    const text = (await watcher.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 300)
    log('results:', text)
    if (await resultsUp()) {
      await phones[0].getByRole('button', { name: 'Next game' }).click()
      await wait(800)
      await phones[0].getByRole('button', { name: 'End the night' }).click()
      await wait(1200)
      await shot('summary')
    }
  }
  log(`throws by people: ${throws}, bot rolls caught: ${botWaits}`)
  if (failures.length) {
    log('FAILURES:')
    for (const f of failures) log(' -', f)
    process.exitCode = 1
  } else log('all checks passed')
}
