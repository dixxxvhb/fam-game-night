// Render Party Park tracks offline in a headless browser and write WAVs: node scripts/_render-music.mjs <base> <outDir>
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'
const [base, out] = process.argv.slice(2)
const b = await chromium.launch(); const p = await b.newPage()
p.on('pageerror', (e) => console.log('ERR', e.message))
await p.goto(`${base}#/park-music`); await p.waitForFunction(() => window.__renderPark)
const items = [['title', 22], ['board', 36], ['tense', 30], ['spin', 8], ['minigame', 14], ['results', 9], ['finale', 23], ['turn', 1.5], ['star', 2.5], ['lastFive', 3], ['win', 2.5], ['lose', 3], ['go', 2], ['coins', 1], ['event', 2]]
function wav(samples) {
  const n = samples.length, buf = Buffer.alloc(44 + n * 2)
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8); buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(44100, 24); buf.writeUInt32LE(88200, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34)
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40)
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767))), 44 + i * 2)
  return buf
}
for (const [id, sec] of items) {
  const arr = await p.evaluate(async ([id, sec]) => Array.from(await window.__renderPark(id, sec)), [id, sec])
  let peak = 0, sum = 0
  for (const v of arr) { peak = Math.max(peak, Math.abs(v)); sum += v * v }
  console.log(id.padEnd(9), 'peak', peak.toFixed(3), 'rms', Math.sqrt(sum / arr.length).toFixed(3))
  writeFileSync(`${out}/${id}.wav`, wav(arr))
}
await b.close()
