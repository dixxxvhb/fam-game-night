import { useEffect, useRef, useState, type FormEvent, type PointerEvent } from 'react'
import type { ControllerProps } from '../../engine/types'
import { useSendStream, useTicker } from '../../engine/context'
import { Btn, cx, Label } from '../../ui/kit'
import { Countdown } from '../../ui/Countdown'
import { ERASER, INKS, SketchCanvas, type LiveStroke } from './Canvas'
import { hintFor, type SketchState, type Stroke } from './logic'
import { Eraser, Undo2, Trash2 } from 'lucide-react'

const WIDTHS = [8, 20]

function DrawPad({ s, send }: { s: SketchState; send: ControllerProps<SketchState>['send'] }) {
  const sendStream = useSendStream()
  const [color, setColor] = useState(INKS[0])
  const [width, setWidth] = useState(WIDTHS[0])
  const [erasing, setErasing] = useState(false)
  const [live, setLive] = useState<LiveStroke | null>(null)
  const cur = useRef<LiveStroke | null>(null)
  const lastSent = useRef(0)
  const pad = useRef<HTMLDivElement>(null)
  // Strokes already sent but not yet echoed back in state stay visible meanwhile.
  // n = the index the stroke will take; once the state has that many strokes it has arrived.
  const [pending, setPending] = useState<(Stroke & { n: number })[]>([])
  const committed = s.strokes
  const unechoed = pending.filter((p) => p.n >= committed.length)

  function point(e: PointerEvent): [number, number] {
    const r = pad.current!.getBoundingClientRect()
    const x = Math.round(((e.clientX - r.left) / r.width) * 1000)
    const y = Math.round(((e.clientY - r.top) / r.height) * 1000)
    return [Math.max(0, Math.min(1000, x)), Math.max(0, Math.min(1000, y))]
  }

  function down(e: PointerEvent<HTMLDivElement>) {
    e.preventDefault()
    pad.current?.setPointerCapture(e.pointerId)
    const [x, y] = point(e)
    const st: LiveStroke = { n: committed.length + unechoed.length, c: erasing ? ERASER : color, w: erasing ? 44 : width, p: [x, y] }
    cur.current = st
    setLive({ ...st })
  }
  function move(e: PointerEvent<HTMLDivElement>) {
    const st = cur.current
    if (!st) return
    const [x, y] = point(e)
    const lx = st.p[st.p.length - 2]
    const ly = st.p[st.p.length - 1]
    if (Math.hypot(x - lx, y - ly) < 5 || st.p.length > 3000) return
    st.p.push(x, y)
    setLive({ ...st, p: [...st.p] })
    const t = performance.now()
    if (t - lastSent.current > 80) {
      lastSent.current = t
      sendStream('sketch:live', { ...st, p: [...st.p] })
    }
  }
  function up() {
    const st = cur.current
    if (!st) return
    cur.current = null
    const stroke: Stroke = { c: st.c, w: st.w, p: st.p }
    setPending((list) => [...list.filter((p) => p.n >= committed.length), { ...stroke, n: st.n }])
    send('stroke', { s: stroke })
    sendStream('sketch:live', { ...st, p: [...st.p] })
    setLive(null)
  }

  const shown = [...committed, ...unechoed.map(({ c, w, p }) => ({ c, w, p }))]
  return (
    <div className="grid gap-3">
      <div
        ref={pad}
        className="touch-none-all no-select relative"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onPointerLeave={(e) => { if (e.buttons === 0) up() }}
      >
        <SketchCanvas strokes={shown} local={live} listen={false} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {INKS.map((c) => (
          <button
            key={c}
            aria-label={`Color ${c}`}
            onClick={() => { setColor(c); setErasing(false) }}
            className={cx('h-9 w-9 rounded-full border-2', !erasing && color === c ? 'border-ink scale-110' : 'border-line')}
            style={{ background: c }}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        {WIDTHS.map((w) => (
          <Btn key={w} size="sm" variant={!erasing && width === w ? 'primary' : 'secondary'} onClick={() => { setWidth(w); setErasing(false) }} aria-label={w === WIDTHS[0] ? 'Thin pen' : 'Thick pen'}>
            <span className="rounded-full bg-current" style={{ width: w / 2 + 4, height: w / 2 + 4 }} />
          </Btn>
        ))}
        <Btn size="sm" variant={erasing ? 'primary' : 'secondary'} onClick={() => setErasing((v) => !v)} aria-label="Eraser"><Eraser size={18} /></Btn>
        <div className="flex-1" />
        <Btn size="sm" onClick={() => { setPending([]); send('undo') }} aria-label="Undo"><Undo2 size={18} /></Btn>
        <Btn size="sm" variant="danger" onClick={() => { setPending([]); send('clear') }} aria-label="Clear"><Trash2 size={18} /></Btn>
      </div>
    </div>
  )
}

function GuessBox({ s, me, send, now, compact }: { s: SketchState; me: string; send: ControllerProps<SketchState>['send']; now: () => number; compact: boolean }) {
  const [text, setText] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const solved = s.solved.find((x) => x.playerId === me)
  const mine = s.guesses.filter((g) => g.playerId === me && !g.correct).slice(-4).reverse()
  const frac = s.stageTotal ? 1 - Math.max(0, s.endsAt - now()) / s.stageTotal : 0

  useEffect(() => { if (!solved) input.current?.focus() }, [solved, s.turn])

  function submit(e: FormEvent) {
    e.preventDefault()
    const t = text.trim()
    if (!t) return
    send('guess', { text: t })
    setText('')
  }

  if (solved) {
    return (
      <div className="grid gap-2 rounded-2xl bg-good/15 p-5 text-center animate-pop">
        <div className="font-display text-3xl text-good">Got it</div>
        <div className="text-ink-2">+{solved.points} points. Now watch the others suffer.</div>
      </div>
    )
  }
  return (
    <div className="grid gap-3">
      {!compact && <div className="text-center font-mono text-2xl tracking-[0.2em]">{hintFor(s.word, frac)}</div>}
      <form onSubmit={submit} className="flex gap-2">
        <input
          ref={input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={40}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="send"
          placeholder="Your guess"
          aria-label="Your guess"
          className="min-h-14 min-w-0 flex-1 rounded-xl border-2 border-line bg-tile px-4 text-lg outline-none focus:border-hot"
        />
        <Btn variant="primary" size="lg" type="submit">Guess</Btn>
      </form>
      <div className="flex flex-wrap gap-2">
        {mine.map((g, i) => (
          <span key={`${g.at}-${i}`} className={cx('rounded-full px-3 py-1 text-sm', g.close ? 'bg-hot/20 text-hot-ink' : 'bg-tile text-ink-3 line-through')}>
            {g.text}{g.close ? ' is close' : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

export function SketchController({ state: s, room, me, now, send }: ControllerProps<SketchState>) {
  useTicker(250)
  const inGame = room.gamePlayers.includes(me)
  const isDrawer = s.drawer === me
  const drawer = room.players.find((p) => p.id === s.drawer)
  const compact = room.mode === 'apart'

  if (!inGame) return <div className="p-6 text-center text-ink-2">You're in the next game. Watch the screen.</div>

  if (s.stage === 'choose') {
    if (!isDrawer) {
      return (
        <div className="grid gap-4 p-5 text-center">
          <Countdown endsAt={s.endsAt} total={s.stageTotal} now={now} />
          <div className="text-xl">{drawer?.name} is picking a word.</div>
        </div>
      )
    }
    return (
      <div className="grid gap-4 p-5">
        <Countdown endsAt={s.endsAt} total={s.stageTotal} now={now} />
        <Label className="text-center">Pick what you'll draw</Label>
        {s.choices.map((w) => (
          <Btn key={w} size="xl" variant="secondary" className="capitalize" onClick={() => send('choose', { word: w })}>{w}</Btn>
        ))}
      </div>
    )
  }

  if (s.stage === 'draw') {
    return (
      <div className="grid gap-3 p-4">
        <Countdown endsAt={s.endsAt} total={s.stageTotal} now={now} />
        {isDrawer ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <Label>Draw this</Label>
                <div className="truncate font-display text-2xl capitalize text-hot">{s.word}</div>
              </div>
              <Btn size="sm" variant="ghost" onClick={() => send('pass')}>Give up</Btn>
            </div>
            <DrawPad key={s.turn} s={s} send={send} />
            <div className="text-center text-sm text-ink-3">
              {s.solved.length ? `${s.solved.length} got it` : 'No letters, no numbers, no pointing at things in the room.'}
            </div>
          </>
        ) : (
          <GuessBox s={s} me={me} send={send} now={now} compact={compact} />
        )}
      </div>
    )
  }

  if (s.stage === 'reveal' && s.last) {
    const got = s.last.solvers.includes(me)
    return (
      <div className="grid gap-2 p-6 text-center animate-pop">
        <Label>The word was</Label>
        <div className="font-display text-4xl capitalize text-hot">{s.last.word}</div>
        <div className="text-ink-2">{s.last.drawer === me ? `${s.last.solvers.length} got it` : got ? 'You got it.' : 'You did not get it.'}</div>
      </div>
    )
  }

  return <div className="p-6 text-center text-ink-2">Adding it up.</div>
}
