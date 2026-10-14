// Quick screenshot: node scripts/_shot.mjs <url> <out.png> [width] [height] [waitMs] [clickSelector...]
import { chromium } from 'playwright'
const [url, out, w = '1400', h = '1000', waitMs = '1500'] = process.argv.slice(2)
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: +w, height: +h } })
p.on('pageerror', (e) => console.log('ERR', e.message))
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()) })
await p.goto(url); await p.waitForTimeout(+waitMs); await p.screenshot({ path: out, fullPage: true }); await b.close()
