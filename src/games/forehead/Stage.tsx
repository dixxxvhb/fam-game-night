import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import type { RoomPlayer, StageProps } from '../../engine/types'
import { useTicker } from '../../engine/context'
import { sfx } from '../../ui/sfx'
import { cx } from '../../ui/kit'
import { music as parkMusic } from '../board/park/music'
import { useQuizMusic, quizMusic } from '../_quiz/music'
import { useGameFonts } from '../_quiz/fonts'
import { ON_FIRE_AT, recapOf, streakOf, type Call, type ForeheadState } from './logic'
import { ST_COUNT, ST_FIRE, ST_GO, ST_GOT, ST_PASS, ST_TICK, ST_TIME, trackFor } from './music'
import {
  BrickWall, CLUB, CheckGlyph, Confetti, CueCard, Curtain, FONTS, FrontRowHead, GuesserFigure, HushGlyph, MicStand, NeonSign,
  PACIFICO, PassGlyph, PassStamp, RingTimer, Spotlight, StageFloor, StreakMeter, TiltGlyph, Flame, tint,
} from './club'
import { moodFor, momentOf } from './show'
import { fitFont } from './fit'
import { useBox } from './useBox'
import './club.css'

/** Music for the phase, stingers for the moments. Falls back to the app's sfx when music is off. */
function useClubSound(s: ForeheadState, now: () => number) {
  const secsLeft = s.stage === 'set' || s.stage === 'play' ? Math.ceil(Math.max(0, s.endsAt - now()) / 1000) : 99
  useQuizMusic(trackFor(s.stage, secsLeft))
  const prev = useRef({ calls: s.calls.length, stage: s.stage, secs: secsLeft })
  useEffect(() => {
    const p = prev.current
    const band = parkMusic.isOn()
    if (s.stage === 'play' && s.calls.length > p.calls) {
      const got = s.calls.at(-1)?.got
      if (band) {
        quizMusic.stinger(got ? ST_GOT : ST_PASS)
        if (got && streakOf(s.calls) === ON_FIRE_AT) quizMusic.stinger(ST_FIRE)
      } else sfx.play(got ? 'good' : 'whoosh')
    }
    if (s.stage !== p.stage) {
      if (s.stage === 'play') band ? quizMusic.stinger(ST_GO) : sfx.play('start')
      if (s.stage === 'turnEnd') band ? quizMusic.stinger(ST_TIME) : sfx.play('reveal')
    }
    if (secsLeft !== p.secs && secsLeft > 0) {
      if (s.stage === 'set') band ? quizMusic.stinger(ST_COUNT) : sfx.play('tick')
      if (s.stage === 'play' && secsLeft <= 5) band ? quizMusic.stinger(ST_TICK) : sfx.play('tick')
    }
    prev.current = { calls: s.calls.length, stage: s.stage, secs: secsLeft }
  }, [s.calls, s.stage, secsLeft])
}

function whoOf(room: StageProps<ForeheadState>['room']) {
  return (id: string): RoomPlayer => room.players.find((p) => p.id === id) ?? { id, name: 'Someone', color: '#999999', guest: true, connected: false }
}

export function ForeheadStage(props: StageProps<ForeheadState>) {
  useGameFonts(FONTS)
  useTicker(100)
  useClubSound(props.state, props.now)
  return props.compact ? <CompactStage {...props} /> : <TvStage {...props} />
}

// ---------------- the TV ----------------

function TvStage({ state: s, room, now }: StageProps<ForeheadState>) {
  const who = whoOf(room)
  const g = who(s.guesser)
  const moment = momentOf(s, now)
  const got = s.calls.filter((c) => c.got).length
  const streak = streakOf(s.calls)
  const actors = room.gamePlayers.filter((id) => id !== s.guesser)
  const left = Math.max(0, s.endsAt - now())
  const mood = moodFor(s, moment)
  const turnLabel = `Turn ${Math.min(s.turn + 1, s.order.length)} of ${s.order.length}`

  return (
    <div
      className="relative h-full w-full overflow-hidden text-white"
      style={{ background: CLUB.night }}
      data-fh-stage={s.stage}
      data-fh-got={got}
      data-fh-word={s.stage === 'play' ? s.word : ''}
    >
      <BrickWall wash={s.stage === 'play' && left <= 10_000 ? CLUB.red : streak >= ON_FIRE_AT && s.stage === 'play' ? CLUB.orange : CLUB.pink} />
      <Spotlight x={0.15} width={0.27} color={tint(g.color, 0.7)} className={s.stage === 'done' ? 'opacity-0' : ''} />
      <StageFloor height={130} />
      <Curtain side="left" style={{ width: 70 }} />
      <Curtain side="right" style={{ width: 70 }} />

      <div className="relative grid h-full grid-cols-[290px_minmax(0,1fr)_250px] grid-rows-[auto_minmax(0,1fr)_132px] gap-x-6 px-[70px] pt-4">
        {/* left column: the sign, then the Guesser on stage */}
        <div className="row-span-3 flex min-h-0 flex-col items-center">
          <NeonSign size={0.82} className="mt-1" />
          <div className="flex-1" />
          {s.stage !== 'done' && (
            <div className="relative mb-[46px] flex flex-col items-center">
              <MicStand height={190} className="absolute bottom-[58px] -right-[46px]" />
              <div key={moment ? moment.at : 'idle'} className={cx(moment ? (moment.got ? 'fh-hop' : 'fh-wobble') : 'fh-sway')}>
                <GuesserFigure color={g.color} mood={mood} phone={s.stage === 'set' || s.stage === 'play'} size={300} />
              </div>
              <NamePlate player={g} score={s.scores[g.id] ?? 0} label={s.stage === 'turnEnd' ? 'Took a bow' : s.stage === 'ready' ? 'Up next' : 'Guessing'} />
            </div>
          )}
        </div>

        {/* top middle: what's happening */}
        <div className="flex items-center justify-center gap-8 pt-2">
          {s.stage === 'play' ? (
            <>
              <GotCounter got={got} />
              <StreakMeter streak={s.stage === 'play' ? streak : 0} onFireAt={ON_FIRE_AT} size={1.05} />
            </>
          ) : (
            <div className="font-mono text-lg font-bold uppercase tracking-[0.3em] text-white/70">{turnLabel}</div>
          )}
        </div>

        {/* right column: the clock and the turn so far */}
        <div className="row-span-2 flex min-h-0 flex-col items-center gap-4 pt-2">
          {(s.stage === 'play' || s.stage === 'set') && <RingTimer left={s.stage === 'play' ? left : 60_000} total={s.stage === 'play' ? s.stageTotal : 60_000} size={170} label="seconds" />}
          {s.stage === 'ready' && <RingTimer left={left} total={s.stageTotal} size={130} label="starts in" />}
          {s.stage === 'play' && <TurnLog calls={s.calls} />}
          {s.stage === 'play' && <div className="mt-auto font-mono text-sm font-bold uppercase tracking-[0.24em] text-white/50">{turnLabel}</div>}
        </div>

        {/* the middle of the stage */}
        <div className="relative min-h-0">
          {s.stage === 'ready' && <ReadyPoster s={s} g={g} secs={Math.ceil(left / 1000)} />}
          {s.stage === 'set' && <SetCard g={g} secs={Math.ceil(left / 1000)} />}
          {s.stage === 'play' && <PlayCard word={s.word} moment={moment} />}
          {s.stage === 'turnEnd' && <Recap s={s} g={g} />}
          {s.stage === 'done' && (
            <div className="grid h-full place-items-center">
              <div className="fh-neon-yellow text-center" style={{ ...PACIFICO, fontSize: 84 }}>Adding it up</div>
            </div>
          )}
        </div>

        {/* the front row: everyone acting, from behind */}
        <div className="col-span-2 col-start-2 flex items-end justify-center gap-10">
          {actors.map((id, i) => (
            <FrontRowSeat key={id} p={who(id)} score={s.scores[id] ?? 0} i={i} plus={moment?.got && s.stage === 'play' ? moment.at : null} />
          ))}
        </div>
      </div>

      {/* GOT IT: the whole room goes green */}
      {moment && moment.got && s.stage === 'play' && (
        <div key={moment.at} className="pointer-events-none absolute inset-0">
          <div className="fh-flash absolute inset-0" style={{ background: `radial-gradient(circle at 50% 45%, ${CLUB.green} 0%, ${CLUB.greenDeep} 70%)` }} />
          <Confetti count={44} />
          <div className="absolute inset-0 grid place-items-center">
            <div className="fh-slam font-display uppercase" style={{ fontSize: 150, color: '#fff', textShadow: `0 8px 0 ${CLUB.ink}, 0 0 30px ${CLUB.green}` }}>Got it</div>
          </div>
        </div>
      )}
    </div>
  )
}

function NamePlate({ player, score, label }: { player: RoomPlayer; score: number; label: string }) {
  return (
    <div className="relative -mt-2 grid min-w-[220px] justify-items-center rounded-2xl border-4 px-4 pb-2 pt-1" style={{ borderColor: CLUB.ink, background: '#1c0c17', boxShadow: `0 0 0 3px ${player.color}, 0 0 22px ${player.color}88` }}>
      <span className="font-mono text-xs font-bold uppercase tracking-[0.3em] text-white/60">{label}</span>
      <span className="max-w-[240px] truncate font-display text-3xl leading-tight" style={{ color: tint(player.color, 0.25) }}>{player.name}</span>
      <span className="font-mono text-sm font-bold text-white/70">{score} pts</span>
    </div>
  )
}

function GotCounter({ got }: { got: number }) {
  return (
    <div className="flex items-baseline gap-3">
      <span key={got} className="fh-punch font-display leading-none" style={{ fontSize: 72, color: '#eafff1', textShadow: `0 0 18px ${CLUB.green}, 0 5px 0 ${CLUB.ink}` }}>{got}</span>
      <span className="fh-neon-green" style={{ ...PACIFICO, fontSize: 36 }}>got</span>
    </div>
  )
}

function TurnLog({ calls }: { calls: Call[] }) {
  const recent = [...calls].reverse().slice(0, 7)
  return (
    <div className="grid w-full gap-2">
      {recent.map((c, i) => (
        <div key={`${c.at}-${c.word}`} className="flex items-center gap-2 rounded-xl px-3 py-1.5 animate-rise" style={{ background: c.got ? '#123a26' : '#2a1820', opacity: 1 - i * 0.1 }}>
          {c.got ? <CheckGlyph size={24} /> : <PassGlyph size={24} />}
          <span className={cx('truncate text-xl', c.got ? 'font-bold text-white' : 'text-white/50 line-through')}>{c.word}</span>
        </div>
      ))}
      {!calls.length && <div className="text-center font-mono text-sm uppercase tracking-[0.2em] text-white/40">Nothing yet</div>}
    </div>
  )
}

function FrontRowSeat({ p, score, i, plus }: { p: RoomPlayer; score: number; i: number; plus: number | null }) {
  return (
    <div className="relative flex flex-col items-center">
      {plus !== null && (
        <span key={plus} className="fh-plus absolute -top-10 font-display text-4xl" style={{ color: CLUB.green, textShadow: `0 3px 0 ${CLUB.ink}` }}>+1</span>
      )}
      <div className="mb-1 flex items-center gap-2 rounded-full border-[3px] px-3 py-0.5" style={{ borderColor: CLUB.ink, background: '#1c0c17', boxShadow: `0 0 0 2px ${p.color}` }}>
        <span className="max-w-[150px] truncate text-lg font-bold" style={{ color: tint(p.color, 0.3) }}>{p.name}</span>
        <span className="font-mono text-lg font-bold tabular text-white">{score}</span>
      </div>
      <div className="fh-bob" style={{ animationDelay: `${i * 0.18}s` }}>
        <FrontRowHead color={p.color} size={120} />
      </div>
    </div>
  )
}

/** The card for the actors, flipping in, and the last one leaving. */
function PlayCard({ word, moment }: { word: string; moment: Call | null }) {
  const [box, { w, h }] = useBox<HTMLDivElement>({ w: 620, h: 360 })
  const cw = Math.min(w * 0.96, 680)
  const ch = Math.min(h * 0.92, 380)
  const fs = fitFont(word, cw * 0.86, ch * 0.74, 150, 36)
  const card = (text: string, extra?: string) => (
    <CueCard className={cx('absolute grid place-items-center', extra)} style={{ width: cw, height: ch, left: (w - cw) / 2, top: (h - ch) / 2 }}>
      <div className="relative px-6 text-center font-display uppercase leading-[1.05]" style={{ fontSize: fs }}>{text}</div>
    </CueCard>
  )
  return (
    <div ref={box} className="relative h-full w-full">
      <div key={word} className="fh-flip absolute inset-0">{card(word)}</div>
      {moment && (
        <div key={moment.at} className={cx('absolute inset-0', moment.got ? 'fh-fly-up' : 'fh-toss')}>
          <CueCard className="absolute grid place-items-center" style={{ width: cw, height: ch, left: (w - cw) / 2, top: (h - ch) / 2 }}>
            <div className="relative px-6 text-center font-display uppercase leading-[1.05]" style={{ fontSize: fitFont(moment.word, cw * 0.86, ch * 0.74, 150, 36) }}>{moment.word}</div>
            {!moment.got && <div className="absolute inset-0 grid place-items-center"><PassStamp size={1.6} className="fh-stamp" /></div>}
          </CueCard>
        </div>
      )}
    </div>
  )
}

function SetCard({ g, secs }: { g: RoomPlayer; secs: number }) {
  return (
    <div className="grid h-full place-items-center">
      <CueCard back className="fh-flip" style={{ width: 520, height: 340 }}>
        <div className="relative grid justify-items-center gap-1 text-center">
          <span className="font-mono text-lg font-bold uppercase tracking-[0.3em] text-white">Phone up, {g.name}</span>
          <span key={secs} className="fh-punch font-display leading-none text-white" style={{ fontSize: 190, textShadow: `0 10px 0 ${CLUB.ink}` }}>{secs || 'Go'}</span>
        </div>
      </CueCard>
    </div>
  )
}

function ReadyPoster({ s, g, secs }: { s: ForeheadState; g: RoomPlayer; secs: number }) {
  return (
    <div className="grid h-full content-center justify-items-center gap-4 pb-4 text-center">
      <div className="grid justify-items-center leading-none">
        <span className="fh-neon-cyan -rotate-2" style={{ ...PACIFICO, fontSize: 44 }}>Now on stage</span>
        <span className="mt-2 max-w-[600px] truncate font-display uppercase" style={{ fontSize: 76, color: tint(g.color, 0.2), textShadow: `0 0 24px ${g.color}, 0 6px 0 ${CLUB.ink}` }}>{g.name}</span>
      </div>
      <div className="grid w-full max-w-[600px] gap-2.5">
        <Rule glyph={<TiltGlyph dir="down" size={52} />} text="Tilt down when you get it" />
        <Rule glyph={<TiltGlyph dir="up" size={52} />} text="Tilt up to pass" />
        <Rule glyph={<HushGlyph size={52} />} text="Everyone else acts. Say the word and you're the worst." />
      </div>
      <div className="font-mono text-lg text-white/60">
        {g.bot ? `${g.name} is a bot. Act anyway.` : `Waiting on ${g.name}. Starts anyway in ${secs}.`}
      </div>
      <span className="sr-only">{s.stage}</span>
    </div>
  )
}

function Rule({ glyph, text }: { glyph: ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border-[3px] px-4 py-2 text-left" style={{ borderColor: CLUB.ink, background: 'rgba(20,8,18,0.82)' }}>
      {glyph}
      <span className="text-2xl font-bold leading-tight">{text}</span>
    </div>
  )
}

function Recap({ s, g }: { s: ForeheadState; g: RoomPlayer }) {
  const r = recapOf(s.calls)
  const cards = s.calls.slice(0, 14)
  return (
    <div className="grid h-full content-center justify-items-center gap-4 text-center">
      <div className="flex items-baseline gap-4 leading-none">
        <span className="max-w-[440px] truncate font-display uppercase" style={{ fontSize: g.name.length > 7 ? 44 : 56, color: tint(g.color, 0.2), textShadow: `0 0 18px ${g.color}, 0 5px 0 ${CLUB.ink}` }}>{g.name}</span>
        <span className="fh-neon-yellow" style={{ ...PACIFICO, fontSize: 52 }}>got {r.got}</span>
      </div>
      <div className="flex max-w-[640px] flex-wrap justify-center gap-2.5">
        {cards.map((c, i) => (
          <div
            key={`${c.at}-${c.word}`}
            className="fh-deal relative rounded-xl border-[3px] px-3 py-1.5 font-display text-lg uppercase leading-tight"
            style={{
              '--tilt': `${(i % 3) - 1}deg`,
              animationDelay: `${0.25 + i * 0.09}s`,
              borderColor: CLUB.ink,
              background: c.got ? CLUB.card : '#5a4a54',
              color: c.got ? CLUB.ink : '#c9b8c2',
              boxShadow: c.got ? `0 4px 0 ${CLUB.ink}, 0 0 0 2px ${CLUB.green}` : `0 4px 0 ${CLUB.ink}`,
            } as CSSProperties}
          >
            <span className={c.got ? '' : 'line-through decoration-2'}>{c.word}</span>
          </div>
        ))}
        {!cards.length && <div className="text-2xl text-white/70">Not a single call. Bold strategy.</div>}
        {s.calls.length > cards.length && <div className="self-center font-mono text-lg text-white/60">and {s.calls.length - cards.length} more</div>}
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        {r.best >= 2 && (
          <Chip>
            {r.best >= ON_FIRE_AT && <Flame size={30} live={false} />}
            Best run {r.best}
          </Chip>
        )}
        {r.fastest && <Chip><CheckGlyph size={24} />{r.fastest.word} in {(r.fastest.ms / 1000).toFixed(1)}s</Chip>}
        <Chip>{r.got ? `Every actor +${r.got}` : r.passed ? 'Not one. The actors should reflect.' : 'Zero calls. A bold silence.'}</Chip>
      </div>
    </div>
  )
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="flex items-center gap-2 rounded-full border-[3px] px-4 py-1.5 text-xl font-bold" style={{ borderColor: CLUB.ink, background: '#1c0c17', boxShadow: `0 0 0 2px ${CLUB.yellow}55` }}>
      {children}
    </span>
  )
}

// ---------------- apart mode: the strip above each phone's controls ----------------

function CompactStage({ state: s, room, now }: StageProps<ForeheadState>) {
  const who = whoOf(room)
  // At turn end the phone below shows the recap, so the strip looks ahead to the next Guesser.
  const next = s.stage === 'turnEnd' ? s.order[s.turn + 1] : undefined
  const g = who(next ?? s.guesser)
  const moment = momentOf(s, now)
  const streak = streakOf(s.calls)
  const line =
    s.stage === 'ready' ? 'is up next'
    : s.stage === 'set' ? 'phone up'
    : s.stage === 'play' ? 'is guessing'
    : s.stage === 'turnEnd' ? (next ? 'is up next' : 'Last call')
    : 'Adding it up'
  return (
    <div className="relative -m-3 h-[112px] overflow-hidden text-white" style={{ background: CLUB.night }} data-fh-compact={s.stage}>
      <BrickWall scale={0.5} />
      {moment?.got && s.stage === 'play' && <div key={moment.at} className="fh-flash absolute inset-0" style={{ background: CLUB.green }} />}
      <div className="relative flex h-full items-center gap-3 px-3">
        <div className="relative -mb-10 shrink-0">
          <div key={moment ? moment.at : 'idle'} className={cx(moment ? (moment.got ? 'fh-hop' : 'fh-wobble') : '')}>
            <GuesserFigure color={g.color} mood={next ? 'think' : moodFor(s, moment)} phone={s.stage === 'set' || s.stage === 'play'} size={130} />
          </div>
        </div>
        <div className="grid min-w-0 flex-1 gap-1">
          <div className="flex min-w-0 items-baseline gap-2">
            {s.stage !== 'done' && (s.stage !== 'turnEnd' || next) && <span className="truncate font-display text-xl" style={{ color: tint(g.color, 0.25) }}>{g.name}</span>}
            <span className="fh-neon-cyan shrink-0 text-lg" style={PACIFICO}>{line}</span>
          </div>
          {s.stage === 'play' ? <StreakMeter streak={streak} size={0.55} onFireAt={ON_FIRE_AT} /> : <div className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-white/60">Forehead at the Club</div>}
        </div>
      </div>
    </div>
  )
}
