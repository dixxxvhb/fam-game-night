import { useState } from 'react'
import { cx } from '../../../../ui/kit'
import { CritterArt, INK, Mingo } from '../cast'
import { Coin, PARK, PartyButton, Portrait } from '../ui'
import { DUEL_STAKE, MG_INTRO_MS, type MgRun } from '../../logic'
import { minigame } from '../../minigames/registry'
import { VIEWS } from '../../minigames/views'
import { fill, formatTag, type Who } from '../../view'
import { Chip, Panel, TimeBar, Title, buzz, colorOf, namesFor, ord, type ScreenProps } from './kit'

/** Minigame screens on the phone: the spin, the intro with READY, the pad frame, the result. */

const FORMAT_TONE: Record<string, string> = { ffa: PARK.coral, '1v2': PARK.blue, coop: PARK.good, duel: '#9B5CF6' }

function formatWord(run: MgRun): string {
  if (run.format === 'ffa') return 'FREE FOR ALL'
  if (run.format === 'coop') return 'CO-OP'
  if (run.format === 'duel') return 'DUEL'
  return formatTag(run).toUpperCase()
}

export function MgSpinScreen({ s, apart }: ScreenProps) {
  const duel = s.mg?.kind === 'duel'
  return (
    <div className="grid justify-items-center gap-4 pt-6 text-center">
      <Mingo size={apart ? 100 : 190} className="ppp-float" />
      <Title size={50} sub={apart ? 'Picking one now. Watch up top.' : 'Picking one now.'}>{duel ? 'DUEL TIME' : 'MINIGAME!'}</Title>
      <Panel className="ppp-pop font-party text-3xl">{apart ? 'Look up.' : 'Look at the TV.'}</Panel>
    </div>
  )
}

/** Critters on each side of the minigame. */
function Sides({ run, who, me }: { run: MgRun; who: Who; me: string }) {
  const face = (id: string) => (
    <div key={id} className="grid justify-items-center gap-1">
      <div className="rounded-full" style={{ boxShadow: id === me ? `0 0 0 4px ${colorOf(who, id)}` : undefined }}>
        <Portrait char={who(id).char} name={who(id).name} size={56} mood={run.ready.includes(id) ? 'happy' : 'idle'} />
      </div>
      <span className="font-party text-base leading-none">{id === me ? 'You' : who(id).name}</span>
    </div>
  )
  const vs = <span className="font-party text-3xl" style={{ color: PARK.coralDark }}>VS</span>
  if (run.format === '1v2' && run.solo) {
    return <div className="flex items-center justify-center gap-4">{face(run.solo)}{vs}<div className="flex gap-2">{run.players.filter((id) => id !== run.solo).map(face)}</div></div>
  }
  if (run.format === 'duel') return <div className="flex items-center justify-center gap-5">{face(run.players[0])}{vs}{face(run.players[1])}</div>
  if (run.format === 'coop') return <div className="flex items-center justify-center gap-3"><div className="flex gap-2">{run.players.map(face)}</div>{vs}<span className="font-party text-2xl">the House</span></div>
  return <div className="flex flex-wrap items-center justify-center gap-4">{run.players.map(face)}</div>
}

export function MgIntroScreen({ s, me, who, now, send, apart }: ScreenProps) {
  const run = s.mg!
  const m = minigame(run.id)
  const [sent, setSent] = useState(false)
  if (!m) return null
  const playing = run.players.includes(me)
  const ready = run.ready.includes(me) || sent
  const notReady = run.players.filter((id) => !run.ready.includes(id) && id !== me)
  const extra = run.format === 'coop' && m.coopGoal ? `Goal: ${m.coopGoal}. Everyone gets 6 coins if you make it.`
    : run.format === '1v2' && m.soloRule ? m.soloRule
      : run.format === 'duel' ? `Winner takes up to ${DUEL_STAKE} coins from the loser.` : null
  const role = !playing ? null
    : run.format === '1v2' ? (me === run.solo ? 'You are on your own.' : `You and ${namesFor(run.players.filter((id) => id !== me && id !== run.solo), who, me)} vs ${who(run.solo!).name}.`)
      : run.format === 'coop' ? 'Everyone on the same team.' : null
  return (
    <div className="flex flex-1 flex-col gap-3">
      <TimeBar endsAt={s.endsAt} total={MG_INTRO_MS} now={now} />
      <div className="grid justify-items-center gap-2 text-center">
        {!apart && <Chip tone={FORMAT_TONE[run.format]} fg="#FFFFFF"><span style={{ WebkitTextStroke: `1.5px ${INK}`, paintOrder: 'stroke fill' }}>{formatWord(run)}</span></Chip>}
        <Title size={apart ? 34 : 44}>{m.name}</Title>
      </div>
      <Panel className="grid grid-cols-1 gap-2 text-center">
        <div className="text-[20px] font-bold leading-snug">{m.rule}</div>
        {extra && <div className="text-[17px] leading-snug" style={{ color: PARK.ink2 }}>{extra}</div>}
        {role && <div className="font-party text-xl">{role}</div>}
      </Panel>
      {!apart && <Sides run={run} who={who} me={me} />}
      {playing ? (
        <div className="mt-auto grid gap-2">
          {ready && <div className="text-center text-[17px] font-bold">{notReady.length ? `Waiting on ${namesFor(notReady, who, me)}` : 'Here we go.'}</div>}
          <PartyButton big tone={ready ? 'white' : 'green'} className="w-full" disabled={ready} onClick={() => { buzz(40); setSent(true); send('ready') }} data-board="ready">
            {ready ? 'READY' : "I'M READY"}
          </PartyButton>
        </div>
      ) : (
        <Panel className="mt-auto text-center font-party text-2xl">{namesFor(run.players, who, me)} are dueling. You watch.</Panel>
      )}
    </div>
  )
}

/** The 3-2-1, then the minigame's own pad in a park frame. */
export function MgPlayScreen({ s, me, who, now, send, apart }: ScreenProps) {
  const run = s.mg!
  const m = minigame(run.id)
  const views = VIEWS[run.id]
  if (!m) return null
  const st = run.s as { startAt: number } | null
  const left = (st?.startAt ?? 0) - now()
  if (!run.players.includes(me)) {
    return (
      <div className="grid justify-items-center gap-4 pt-6 text-center">
        {!apart && <Mingo size={170} />}
        <Title size={40} sub={`${namesFor(run.players, who, me)}. ${apart ? 'Watch up top.' : 'Watch the TV.'}`}>{m.name}</Title>
      </div>
    )
  }
  if (left > 0) {
    const n = Math.ceil(left / 1000)
    return (
      <div className="grid justify-items-center gap-5 pt-6 text-center">
        <Title size={40} sub={m.rule}>{m.name}</Title>
        <div key={n} className="ppp-pop grid h-48 w-48 place-items-center rounded-full border-[6px]" style={{ background: n === 1 ? PARK.coral : PARK.sun, borderColor: INK, boxShadow: `0 8px 0 ${INK}` }}>
          <span className="font-party text-[8rem] leading-none text-white" style={{ WebkitTextStroke: `5px ${INK}`, paintOrder: 'stroke fill' }}>{n}</span>
        </div>
      </div>
    )
  }
  if (!views) return null
  const mgSend = (type: string, payload?: unknown) => send(`mg.${type}`, { n: run.no, p: payload })
  return (
    <div className="ppp-pad-frame">
      <views.Pad key={run.no} s={run.s} run={run} me={me} who={who} now={now} send={mgSend} />
    </div>
  )
}

export function MgResultScreen({ s, me, who, apart }: ScreenProps) {
  const run = s.mg!
  const r = run.result
  const m = minigame(run.id)
  if (!r || !m) return null
  const coins = run.awards?.[me] ?? 0
  const playing = run.players.includes(me)
  let head = 'Over'
  let won = false
  if (!playing) head = 'Duel over'
  else if (run.format === '1v2') {
    won = (r.winner === 'solo' && me === run.solo) || (r.winner === 'team' && me !== run.solo)
    head = r.winner === 'none' ? 'Dead heat' : won ? 'YOU WON!' : 'You lost'
  } else if (run.format === 'coop') { won = !!r.success; head = r.success ? 'BEAT THE HOUSE!' : 'The House won' }
  else { won = r.places[me] === 1; head = won ? 'YOU WON!' : `${ord(r.places[me])} place` }
  const char = who(me).char
  return (
    <div className="grid grid-cols-1 gap-3">
      <div className="grid justify-items-center gap-1 text-center">
        <div className="text-[15px] font-bold uppercase tracking-wide">{m.name}</div>
        {playing && char && !apart && <CritterArt id={char} size={140} mood={won ? 'happy' : coins < 0 ? 'sad' : 'idle'} />}
        <Title size={won ? 50 : 42} color={won ? PARK.star : '#FFFFFF'}>{head}</Title>
        {playing && (
          <div className="ppp-pop mt-1 flex items-center gap-2 font-party text-5xl" style={{ color: coins > 0 ? PARK.good : coins < 0 ? PARK.bad : '#FFFFFF', WebkitTextStroke: `3px ${INK}`, paintOrder: 'stroke fill' }}>
            {coins > 0 ? `+${coins}` : coins}<Coin size={44} />
          </div>
        )}
      </div>
      <Panel className="grid grid-cols-1 gap-2">
        <div className="text-[18px] font-bold leading-snug">{fill(r.headline, who)}</div>
        {playing && r.lines[me] && <div className="text-[17px]">You: {r.lines[me]}</div>}
      </Panel>
      <div className="grid grid-cols-1 gap-2">
        {[...run.players].filter((id) => id !== me).sort((a, b) => (r.places[a] ?? 9) - (r.places[b] ?? 9)).map((id) => {
          const a = run.awards?.[id] ?? 0
          return (
            <div key={id} className="flex items-center gap-3 rounded-[18px] border-4 bg-white px-3 py-1.5" style={{ borderColor: INK, boxShadow: `0 4px 0 ${INK}` }}>
              <Portrait char={who(id).char} name={who(id).name} size={40} mood={a > 0 ? 'happy' : 'idle'} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-party text-lg leading-tight">{who(id).name}</div>
                <div className="truncate text-[15px]" style={{ color: PARK.ink2 }}>{r.lines[id]}</div>
              </div>
              <span className={cx('flex items-center gap-1 font-party text-2xl')} style={{ color: a > 0 ? '#1E8A40' : a < 0 ? PARK.coralDark : INK }}>{a > 0 ? `+${a}` : a}<Coin size={22} /></span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

