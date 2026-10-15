// node shots.mjs <outdir> <name>=<query> ...   (tv views 1280x720, phone/compact 390x844 @2x)
import { chromium } from 'playwright'
const [out, ...jobs] = process.argv.slice(2)
const base = 'http://localhost:5179/fam-game-night/src/games/trivia/_dev/preview.html?'
const b = await chromium.launch()
for (const job of jobs) {
  const [name, query] = job.split('=', 2).length === 2 ? [job.slice(0, job.indexOf('=')), job.slice(job.indexOf('=') + 1)] : [job, '']
  const tv = !/view=(phone|compact)/.test(query)
  const p = await b.newPage(tv ? { viewport: { width: 1280, height: 720 } } : { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  p.on('pageerror', (e) => console.log(name, 'ERR', e.message))
  p.on('console', (m) => { if (m.type() === 'error') console.log(name, 'CONSOLE', m.text()) })
  await p.goto(base + query)
  await p.waitForTimeout(Number(process.env.WAIT ?? 1800))
  await p.screenshot({ path: `${out}/${name}.png` })
  await p.close()
}
await b.close()
