import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import type { ControllerProps, RoomPlayer } from '../../engine/types'
import { useTicker } from '../../engine/context'
import { cx } from '../../ui/kit'
import { DrawPad } from '../_draw/Pad'
import { clock, Confetti, Face, Page, Pencil, ST, Stamp, StudioBtn, tilt, Title } from '../_draw/studio'
import { HintTiles } from './Stage'
import { INK_CAP, TIER_BONUS, tierOf, type SketchState } from './logic'

type Send = ControllerProps<SketchState>['send']
type Who = (id: string) => RoomPlayer | undefined

const TIER_NAME = ['', 'Easy', 'Medium', 'Hard']
const TIER_COLOR = ['', '#9FE3C1', '#FFE36E', '#FFB3D1']

function WordCard({ word, i, onPick }: { word: string; i: number; onPick: () => void }) {
  const t = tierOf(word)
  return (
    <button
      onClick={onPick}
      data-qa="choice"
      className="st-drop relative grid min-h-24 w-full gap-1 rounded-xl border-[3px] border-[#1F1B2E] px-4 py-3 text-left shadow-[5px_5px_0_#1F1B2E] transition-transform active:translate-y-1"
      style={{
        animationDelay: `${i * 110}ms`,
        ['--st-rot' as string]: `${tilt(word, 2.2)}deg`,
        backgroundColor: '#FFFFFF',
        backgroundImage: 'linear-gradient(180deg, transparent 0 30px, #F4A3A3 30px 32px, transparent 32px), repeating-linear-gradient(180deg, transparent 0 31px, #DCE6F7 31px 32px)',
      }}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="st-hand text-xl leading-none text-[#575168]">{TIER_NAME[t]}</span>
        <span className="st-marker rounded-md border-2 border-[#1F1B2E] px-2 text-sm leading-tight" style={{ background: TIER_COLOR[t] }}>x{TIER_BONUS[t]} points</span>
      </span>
      <span className="st-marker text-3xl capitalize leading-tight text-[#1F1B2E]">{word}</span>
    </button>
  )
}

function GuessBox({ s, me, send, now, showHint }: { s: SketchState; me: string; send: Send; now: number; showHint: boolean }) {
  const [text, setText] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const solved = s.solved.find((x) => x.playerId === me)
  const mine = s.guesses.filter((g) => g.playerId === me && !g.correct)
  const lastMine = mine.at(-1)
  const { frac, seconds } = clock(s.endsAt, s.stageTotal, now)

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
      <div className="relative grid gap-4">
        <Pencil frac={frac} seconds={seconds} />
        <div className="st-card relative grid justify-items-center gap-2 overflow-hidden bg-[#DFF7E8] p-6 text-center">
          <Confetti n={22} spread={220} />
          <Stamp color={ST.green} className="text-5xl">Got it</Stamp>
          <div className="st-marker st-pop text-4xl text-[#2FA65A]" style={{ animationDelay: '300ms' }}>+{solved.points}</div>
          <div className="st-hand text-2xl leading-tight text-[#575168]">Now watch the others suffer.</div>
        </div>
      </div>
    )
  }
  return (
    <div className="grid gap-4">
      <Pencil frac={frac} seconds={seconds} />
      {showHint && <HintTiles word={s.word} frac={1 - frac} size={36} />}
      <form onSubmit={submit} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <input
          key={lastMine ? lastMine.at : 'none'}
          ref={input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={40}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="send"
          placeholder="What is it?"
          aria-label="Your guess"
          className={cx('st-input st-hand text-3xl', lastMine && now - lastMine.at < 600 && 'st-shake', lastMine?.close && now - lastMine.at < 2500 && 'border-[#FF6B3D]')}
        />
        <StudioBtn type="submit" color={ST.yellow}>Guess</StudioBtn>
      </form>
      {lastMine?.close && now - lastMine.at < 4000 && (
        <div key={lastMine.at} className="st-pop st-marker text-center text-2xl text-[#FF6B3D]">So close. Keep going.</div>
      )}
      <div className="flex flex-wrap gap-2">
        {mine.slice(-6).reverse().map((g, i) => (
          <span
            key={`${g.at}-${i}`}
            className={cx('st-hand rounded-md border-2 border-[#1F1B2E] px-2.5 py-0.5 text-2xl leading-tight', g.close ? 'bg-[#FFC48A]' : 'bg-white text-[#8B8698] line-through decoration-[#E5484D] decoration-2')}
            style={{ transform: `rotate(${tilt(g.at, 3)}deg)` }}
          >
            {g.text}
          </span>
        ))}
      </div>
    </div>
  )
}

function Solvers({ s, who }: { s: SketchState; who: Who }) {
  if (!s.solved.length) return <div className="st-hand text-center text-2xl leading-tight text-[#575168]">No letters, no numbers, no pointing at things in the room.</div>
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {s.solved.map((x) => (
        <span key={x.playerId} className="st-pop inline-flex items-center gap-1.5 rounded-full border-2 border-[#1F1B2E] bg-[#9FE3C1] py-0.5 pl-0.5 pr-2.5">
          <Face p={who(x.playerId)} size={24} />
          <span className="st-marker text-sm">got it</span>
        </span>
      ))}
    </div>
  )
}

export function SketchController({ state: s, room, me, now, send }: ControllerProps<SketchState>) {
  useTicker(200)
  const inGame = room.gamePlayers.includes(me)
  const isDrawer = s.drawer === me
  const who: Who = (id) => room.players.find((p) => p.id === id)
  const drawer = who(s.drawer)
  const apart = room.mode === 'apart'
  const t = now()

  let body: ReactNode
  if (!inGame) {
    body = <div className="st-hand p-6 text-center text-3xl">You're in the next game. Watch the screen.</div>
  } else if (s.stage === 'choose') {
    const { frac, seconds } = clock(s.endsAt, s.stageTotal, t)
    body = isDrawer ? (
      <div className="grid gap-4 p-5">
        <Pencil frac={frac} seconds={seconds} />
        <Title className="justify-self-center text-4xl">Pick one to draw</Title>
        <div className="grid gap-4 pt-2">
          {s.choices.map((w, i) => <WordCard key={w} word={w} i={i} onPick={() => send('choose', { word: w })} />)}
        </div>
        <div className="st-hand text-center text-xl text-[#575168]">Harder words pay you and the guessers more.</div>
      </div>
    ) : (
      <div className="grid justify-items-center gap-5 p-6 text-center">
        <Pencil frac={frac} seconds={seconds} className="w-full" />
        <Face p={drawer} size={84} className="st-float" />
        <div className="st-marker text-3xl">{drawer?.name} is picking a word</div>
        <div className="st-hand text-2xl text-[#575168]">Get your guessing thumbs ready.</div>
      </div>
    )
  } else if (s.stage === 'draw') {
    if (isDrawer) {
      const { frac, seconds } = clock(s.endsAt, s.stageTotal, t)
      body = (
        <div className="grid gap-3 p-4">
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0">
              <div className="st-hand text-xl leading-none text-[#575168]">draw this</div>
              <div data-qa="word" className="st-marker truncate text-4xl capitalize leading-tight text-[#E5484D]">{s.word}</div>
            </div>
            <button onClick={() => send('pass')} className="st-marker shrink-0 rounded-lg border-2 border-[#1F1B2E] bg-white px-3 py-1.5 text-base">Give up</button>
          </div>
          <Pencil frac={frac} seconds={seconds} />
          <DrawPad
            key={s.turn}
            strokes={s.strokes}
            cap={INK_CAP}
            stream="sketch:live"
            onStroke={(st) => send('stroke', { s: st })}
            onUndo={() => send('undo')}
            onClear={() => send('clear')}
          />
          <Solvers s={s} who={who} />
        </div>
      )
    } else {
      body = <div className="p-4"><GuessBox s={s} me={me} send={send} now={t} showHint={!apart} /></div>
    }
  } else if (s.stage === 'reveal' && s.last) {
    const got = s.last.solvers.includes(me)
    const pts = s.last.points[me]
    const mineDrawing = s.last.drawer === me
    body = (
      <div className="relative grid justify-items-center gap-3 overflow-hidden p-6 text-center">
        {(got || (mineDrawing && s.last.solvers.length > 0)) && <Confetti n={20} spread={200} />}
        <div className="st-hand text-3xl text-[#575168]">it was</div>
        <Stamp className="text-5xl capitalize" color={ST.red} style={{ maxWidth: '100%', overflowWrap: 'anywhere' }}>{s.last.word}</Stamp>
        <div className="st-marker st-pop text-2xl" style={{ animationDelay: '450ms' }}>
          {mineDrawing
            ? s.last.solvers.length ? `${s.last.solvers.length} got your drawing` : 'Nobody got your drawing'
            : got ? 'You got it' : 'You missed it'}
        </div>
        {pts ? <div className="st-marker st-pop text-4xl text-[#2FA65A]" style={{ animationDelay: '650ms' }}>+{pts}</div> : null}
      </div>
    )
  } else if (s.stage === 'gallery') {
    body = (
      <div className="grid justify-items-center gap-3 p-6 text-center">
        <Title className="text-4xl">That's the sketchbook</Title>
        <div className="st-hand text-2xl text-[#575168]">{apart ? 'Every drawing from tonight, up top.' : 'Every drawing from tonight is on the TV.'}</div>
        <StudioBtn color="#FFFFFF" onClick={() => send('next')}>See the scores</StudioBtn>
      </div>
    )
  } else {
    body = <div className="st-hand p-6 text-center text-3xl">Adding it up.</div>
  }
  return <Page plain className="pb-6 text-[#1F1B2E]">{body}</Page>
}
