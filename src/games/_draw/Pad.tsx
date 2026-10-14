import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { Eraser, Trash2, Undo2 } from 'lucide-react'
import { useSendStream } from '../../engine/context'
import { cx } from '../../ui/kit'
import { ERASER, INKS, SketchCanvas, type LiveStroke } from '../sketch/Canvas'
import { inkUsed, MAX_STROKES, STROKE_COST, tidy, type Stroke } from './strokes'

const WIDTHS = [8, 20]
const ERASER_W = 44
const INK_NAMES = ['Black', 'Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Purple', 'Brown']

function same(a: Stroke, b: Stroke) {
  const n = a.p.length
  return a.c === b.c && a.w === b.w && n === b.p.length && a.p[0] === b.p[0] && a.p[1] === b.p[1] && a.p[n - 2] === b.p[n - 2] && a.p[n - 1] === b.p[n - 1]
}

/**
 * A drawing pad that doesn't care which game it is in. The game's state owns the strokes:
 * the pad sends each finished stroke up (onStroke) and shows it right away until the host
 * echoes it back. Strokes are simplified on pointer up and trimmed to the ink budget (`cap`).
 * `locked` (time up, or done) ends the stroke in progress and ignores new ones.
 * `stream` (optional) streams the stroke in progress on that kind, about 10 a second.
 */
export function DrawPad({
  strokes,
  onStroke,
  onUndo,
  onClear,
  locked = false,
  cap = 2500,
  stream,
}: {
  strokes: Stroke[]
  onStroke: (s: Stroke) => void
  onUndo: () => void
  onClear: () => void
  locked?: boolean
  cap?: number
  stream?: string
}) {
  const sendStream = useSendStream()
  const [color, setColor] = useState(INKS[0])
  const [width, setWidth] = useState(WIDTHS[0])
  const [erasing, setErasing] = useState(false)
  const [live, setLive] = useState<LiveStroke | null>(null)
  const [pending, setPending] = useState<Stroke[]>([])
  const [confirmClear, setConfirmClear] = useState(false)
  const cur = useRef<LiveStroke | null>(null)
  const lastSent = useRef(0)
  const pad = useRef<HTMLDivElement>(null)
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sent but not echoed yet: keep showing them.
  const waiting = pending.filter((p) => !strokes.some((c) => same(c, p)))
  const shown = waiting.length ? [...strokes, ...waiting] : strokes
  const left = Math.max(0, cap - inkUsed(shown) - STROKE_COST)
  const full = left < 1 || shown.length >= MAX_STROKES

  function point(e: PointerEvent): [number, number] {
    const r = pad.current!.getBoundingClientRect()
    const x = Math.round(((e.clientX - r.left) / r.width) * 1000)
    const y = Math.round(((e.clientY - r.top) / r.height) * 1000)
    return [Math.max(0, Math.min(1000, x)), Math.max(0, Math.min(1000, y))]
  }

  function finish() {
    const st = cur.current
    if (!st) return
    cur.current = null
    setLive(null)
    const p = tidy(st.p).slice(0, Math.max(2, Math.floor(left) * 2))
    if (left < 1) return
    if (p.length < 2) return
    const stroke: Stroke = { c: st.c, w: st.w, p }
    setPending((prev) => [...prev.filter((x) => !strokes.some((c) => same(c, x))), stroke])
    onStroke(stroke)
    if (stream) sendStream(stream, { ...stroke, n: st.n })
  }

  // Time ran out mid-stroke: keep what was drawn.
  useEffect(() => {
    if (locked) finish()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked])

  useEffect(() => () => { if (clearTimer.current) clearTimeout(clearTimer.current) }, [])

  function down(e: PointerEvent<HTMLDivElement>) {
    e.preventDefault()
    if (locked || full) return
    pad.current?.setPointerCapture(e.pointerId)
    const [x, y] = point(e)
    const st: LiveStroke = { n: shown.length, c: erasing ? ERASER : color, w: erasing ? ERASER_W : width, p: [x, y] }
    cur.current = st
    setLive({ ...st })
  }
  function move(e: PointerEvent<HTMLDivElement>) {
    const st = cur.current
    if (!st) return
    if (locked) { finish(); return }
    const [x, y] = point(e)
    const lx = st.p[st.p.length - 2]
    const ly = st.p[st.p.length - 1]
    if (Math.hypot(x - lx, y - ly) < 5 || st.p.length / 2 >= left + 200 || st.p.length > 3000) return
    st.p.push(x, y)
    setLive({ ...st, p: [...st.p] })
    const t = performance.now()
    if (stream && t - lastSent.current > 100) {
      lastSent.current = t
      sendStream(stream, { ...st, p: [...st.p] })
    }
  }

  function undo() {
    setPending([])
    onUndo()
  }
  function clear() {
    if (!confirmClear) {
      setConfirmClear(true)
      if (clearTimer.current) clearTimeout(clearTimer.current)
      clearTimer.current = setTimeout(() => setConfirmClear(false), 2500)
      return
    }
    setConfirmClear(false)
    setPending([])
    onClear()
  }

  const tool = 'grid h-12 w-12 place-items-center rounded-xl border-2 transition-transform active:scale-[0.96] disabled:opacity-40'
  return (
    <div className="grid gap-2">
      <div
        ref={pad}
        className={cx('touch-none-all no-select relative', locked && 'opacity-80')}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerCancel={finish}
        onPointerLeave={(e) => { if (e.buttons === 0) finish() }}
      >
        <SketchCanvas strokes={shown} local={live} listen={false} />
        {full && !locked && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 rounded-b-2xl bg-paper/85 px-3 py-2 text-center text-sm font-bold text-hot-ink">
            Out of ink. Undo something to keep going.
          </div>
        )}
      </div>
      <div className="grid grid-cols-8" role="group" aria-label="Colors">
        {INKS.map((c, i) => {
          const on = !erasing && color === c
          return (
            <button
              key={c}
              aria-label={INK_NAMES[i] ?? c}
              aria-pressed={on}
              disabled={locked}
              onClick={() => { setColor(c); setErasing(false) }}
              className="grid h-11 place-items-center disabled:opacity-40"
            >
              <span
                className={cx('block h-8 w-8 rounded-full border-2 transition-transform', on ? 'scale-110 border-ink' : 'border-line')}
                style={{ background: c }}
              />
            </button>
          )
        })}
      </div>
      <div className="flex items-center gap-2">
        {WIDTHS.map((w, i) => {
          const on = !erasing && width === w
          return (
            <button
              key={w}
              aria-label={i === 0 ? 'Thin pen' : 'Thick pen'}
              aria-pressed={on}
              disabled={locked}
              onClick={() => { setWidth(w); setErasing(false) }}
              className={cx(tool, on ? 'border-hot bg-hot text-paper' : 'border-line bg-tile text-ink')}
            >
              <span className="rounded-full bg-current" style={{ width: w / 2 + 4, height: w / 2 + 4 }} />
            </button>
          )
        })}
        <button
          aria-label="Eraser"
          aria-pressed={erasing}
          disabled={locked}
          onClick={() => setErasing((v) => !v)}
          className={cx(tool, erasing ? 'border-hot bg-hot text-paper' : 'border-line bg-tile text-ink')}
        >
          <Eraser size={20} />
        </button>
        <div className="flex-1" />
        <button aria-label="Undo" disabled={locked || !shown.length} onClick={undo} className={cx(tool, 'border-line bg-tile text-ink')}>
          <Undo2 size={20} />
        </button>
        <button
          aria-label={confirmClear ? 'Tap again to clear' : 'Clear'}
          disabled={locked || !shown.length}
          onClick={clear}
          className={cx(confirmClear ? 'grid h-12 place-items-center rounded-xl border-2 border-bad bg-bad/15 px-3 text-sm font-bold text-bad' : cx(tool, 'border-bad/50 text-bad'))}
        >
          {confirmClear ? 'Clear all?' : <Trash2 size={20} />}
        </button>
      </div>
    </div>
  )
}
