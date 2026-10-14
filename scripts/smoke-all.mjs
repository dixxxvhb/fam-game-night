#!/usr/bin/env node
// Smoke test every game: one phone hosts solo (two bots), starts each game on the shelf,
// lets it run a few seconds, screenshots it, checks for page errors, ends it.
//   node scripts/smoke-all.mjs [--base https://dixxxvhb.github.io/fam-game-night/] [--secs 8]
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith('--') ? [...a, [v.slice(2), all[i + 1]]] : a), []))
const base = args.base ?? 'http://localhost:5179/fam-game-night/'
const secs = Number(args.secs ?? 8)
const out = resolve('shots/smoke')
mkdirSync(out, { recursive: true })

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
await ctx.addInitScript(() => { try { localStorage.setItem('gn-nosave', '1') } catch {} })
const page = await ctx.newPage()
const errors = []
let current = 'lobby'
page.on('pageerror', (e) => errors.push(`${current}: ${e.message}`))

await page.goto(`${base}#/solo`)
await page.getByText('Dixxx', { exact: true }).click()
await page.waitForSelector("text=You're in.", { timeout: 20000 })
await page.waitForTimeout(1500)

const cards = page.locator('button[aria-expanded]')
const names = []
for (let i = 0; i < (await cards.count()); i++) names.push((await cards.nth(i).locator('span').first().innerText()).trim())
console.log('shelf:', names.join(', '))

const report = []
for (const name of names) {
  current = name
  const card = page.locator('button[aria-expanded]', { hasText: name }).first()
  await card.click()
  const start = page.getByRole('button', { name: /^Start / })
  if (!(await start.count()) || (await start.isDisabled())) {
    report.push([name, 'cannot start solo'])
    await card.click()
    continue
  }
  const before = errors.length
  await start.click()
  await page.waitForTimeout(secs * 1000)
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  await page.screenshot({ path: join(out, `${slug}.png`) })
  const text = (await page.locator('main').innerText()).slice(0, 80).split('\n').join(' | ')
  report.push([name, errors.length > before ? `ERROR ${errors.slice(before).join(' / ')}` : `ok: ${text}`])
  // End it from the phone
  const end = page.getByLabel('End this game')
  if (await end.count()) {
    await end.click()
    await page.getByRole('button', { name: 'End it' }).click()
  }
  await page.waitForSelector('text=Pick a game', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(800)
}

await browser.close()
for (const [n, r] of report) console.log(`${n.padEnd(20)} ${r}`)
const bad = report.filter(([, r]) => r.startsWith('ERROR'))
if (bad.length) process.exitCode = 1
