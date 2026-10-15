import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { Eraser, PaintBucket, Trash2, Undo2 } from 'lucide-react'
import { useSendStream } from '../../engine/context'
import { cx } from '../../ui/kit'
import { ERASER, INK_BOX, SketchCanvas, type LiveStroke } from '../sketch/Canvas'
import { inkUsed, MAX_STROKES, STROKE_COST, tidy, type Stroke } from './strokes'
import { Tape } from './studio'

const WIDTHS = [{ w: 6, name: 'Thin pen' }, { w: 14, name: 'Medium pen' }, { w: 30, name: 'Thick pen' }]
const ERASER_W = 44
type Tool = 'pen' | 'fill' | 'eraser'

function same(a: Stroke, b: Stroke) {
  const n = a.p.length
  return a.c === b.c && a.w === b.w && !!a.f === !!b.f && n === b.p.length && a.p[0] === b.p[0] && a.p[1] === b.p[1] && a.p[n - 2] === b.p[n - 2] && a.p[n - 1] === b.p[n - 1]
}

/**
 * A drawing pad that doesn't care which game it is in. The game's state owns the strokes:
 * the pad sends each finished stroke up (onStroke) and shows it right away until the host
 * echoes it back. Strokes are simplified on pointer up and trimmed to the ink budget (`cap`).
 * Tools: pen in three sizes, paint bucket (a one-point stroke with f = 1), eraser.
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
  const [color, setColor] = useState(INK_BOX[0].c)
  const [width, setWidth] = useState(WIDTHS[0].w)
  const [tool, setTool] = useState<Tool>('pen')
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
  const inkFrac = Math.max(0, Math.min(1, left / cap))

  function point(e: PointerEvent): [number, number] {
    const r = pad.current!.getBoundingClientRect()
    const x = Math.round(((e.clientX - r.left) / r.width) * 1000)
    const y = Math.round(((e.clientY - r.top) / r.height) * 1000)
    return [Math.max(0, Math.min(1000, x)), Math.max(0, Math.min(1000, y))]
  }

  function commit(stroke: Stroke, n: number) {
    setPending((prev) => [...prev.filter((x) => !strokes.some((c) => same(c, x))), stroke])
    onStroke(stroke)
    if (stream) sendStream(stream, { ...stroke, n })
  }

  function finish() {
    const st = cur.current
    if (!st) return
    cur.current = null
    setLive(null)
    const p = tidy(st.p).slice(0, Math.max(2, Math.floor(left) * 2))
    if (left < 1) return
    if (p.length < 2) return
    commit({ c: st.c, w: st.w, p }, st.n)
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
    const [x, y] = point(e)
    if (tool === 'fill') {
      commit({ c: color, w: 1, p: [x, y], f: 1 }, shown.length)
      return
    }
    pad.current?.setPointerCapture(e.pointerId)
    const st: LiveStroke = { n: shown.length, c: tool === 'eraser' ? ERASER : color, w: tool === 'eraser' ? ERASER_W : width, p: [x, y] }
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

  const toolBtn = 'grid h-11 w-11 shrink-0 place-items-center rounded-xl border-[3px] border-[#1F1B2E] transition-transform active:translate-y-[2px] disabled:opacity-40'
  const onTool = 'bg-[#1F1B2E] text-white shadow-none'
  const offTool = 'bg-white text-[#1F1B2E] shadow-[0_3px_0_#1F1B2E]'
  return (
    <div className="grid gap-2.5">
      <div className="relative">
        <Tape style={{ top: -10, left: -12, zIndex: 2 }} rot={-28} />
        <Tape style={{ top: -10, right: -12, zIndex: 2 }} rot={26} />
        <div
          ref={pad}
          className={cx('touch-none-all no-select relative rounded-[6px] bg-white p-0 ring-[3px] ring-[#1F1B2E] shadow-[5px_5px_0_#1F1B2E]', locked && 'opacity-80', tool === 'fill' && 'cursor-crosshair')}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={finish}
          onPointerCancel={finish}
          onPointerLeave={(e) => { if (e.buttons === 0) finish() }}
        >
          <SketchCanvas strokes={shown} local={live} listen={false} rounded={false} />
          {full && !locked && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-[#FFF8EA]/90 px-3 py-2 text-center text-sm font-bold text-[#E5484D]">
              Out of ink. Undo something to keep going.
            </div>
          )}
        </div>
      </div>
      {/* ink left */}
      <div className="flex items-center gap-2 px-0.5" aria-hidden>
        <span className="st-hand text-lg leading-none text-[#575168]">ink</span>
        <div className="h-2.5 flex-1 overflow-hidden rounded-full border-2 border-[#1F1B2E] bg-white">
          <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${inkFrac * 100}%`, background: inkFrac < 0.15 ? '#E5484D' : color === '#FFFFFF' ? '#1F1B2E' : color }} />
        </div>
      </div>
      <div className="grid grid-cols-7 gap-y-1" role="group" aria-label="Colors">
        {INK_BOX.map(({ c, name }) => {
          const on = tool !== 'eraser' && color === c
          return (
            <button
              key={c}
              aria-label={name}
              aria-pressed={on}
              disabled={locked}
              onClick={() => { setColor(c); if (tool === 'eraser') setTool('pen') }}
              className="grid h-11 place-items-center disabled:opacity-40"
            >
              <span
                className={cx('block rounded-full border-[3px] border-[#1F1B2E] transition-transform', on ? 'h-10 w-10 -translate-y-0.5 shadow-[0_3px_0_#1F1B2E]' : 'h-8 w-8')}
                style={{ background: c }}
              />
            </button>
          )
        })}
      </div>
      <div className="flex min-w-0 items-center gap-1">
        {WIDTHS.map(({ w, name }) => {
          const on = tool === 'pen' && width === w
          return (
            <button
              key={w}
              aria-label={name}
              aria-pressed={on}
              disabled={locked}
              onClick={() => { setWidth(w); setTool('pen') }}
              className={cx(toolBtn, on ? onTool : offTool)}
            >
              <span className="rounded-full" style={{ width: w / 2 + 4, height: w / 2 + 4, background: on ? '#fff' : color === '#FFFFFF' ? '#1F1B2E' : color, border: color === '#FFFFFF' && !on ? '2px solid #1F1B2E' : undefined }} />
            </button>
          )
        })}
        <button aria-label="Fill" aria-pressed={tool === 'fill'} disabled={locked} onClick={() => setTool(tool === 'fill' ? 'pen' : 'fill')} className={cx(toolBtn, tool === 'fill' ? onTool : offTool)}>
          <PaintBucket size={20} />
        </button>
        <button aria-label="Eraser" aria-pressed={tool === 'eraser'} disabled={locked} onClick={() => setTool(tool === 'eraser' ? 'pen' : 'eraser')} className={cx(toolBtn, tool === 'eraser' ? onTool : offTool)}>
          <Eraser size={20} />
        </button>
        <div className="flex-1" />
        <button aria-label="Undo" disabled={locked || !shown.length} onClick={undo} className={cx(toolBtn, offTool)}>
          <Undo2 size={20} />
        </button>
        <button
          aria-label={confirmClear ? 'Tap again to clear' : 'Clear'}
          disabled={locked || !shown.length}
          onClick={clear}
          className={cx(confirmClear ? 'grid h-11 shrink-0 place-items-center rounded-xl border-[3px] border-[#E5484D] bg-[#FFE1E3] px-2 text-sm font-bold text-[#E5484D]' : cx(toolBtn, offTool, 'text-[#E5484D]'))}
        >
          {confirmClear ? 'Clear all?' : <Trash2 size={20} />}
        </button>
      </div>
      {tool === 'fill' && <div className="st-hand -mt-1 text-center text-lg leading-none text-[#575168]"><PaintBucket size={14} className="mr-1 inline" />Tap inside a shape to fill it</div>}
    </div>
  )
}
