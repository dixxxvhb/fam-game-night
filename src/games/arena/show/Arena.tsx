import type { ReactNode } from 'react'
import { cx } from '../../../ui/kit'
import { CritterArt, INK } from '../../board/park/cast'
import { PARK, Portrait } from '../../board/park/ui'
import { decided, freshPowers, leader, VS_MS, type ArenaState } from '../logic'
import { SHRINK_AT_STEPS, STEP_HZ, type Sim } from '../sim'
import { themeAt, type ArenaTheme } from '../themes'
import { themeOf } from '../logic'
import { ArenaCanvas } from '../ArenaCanvas'
import type { ArenaFeed } from '../useArenaSim'
import type { FxEvent } from '../art/render'
import { FeedRow, Ink, looksOf, plural, PowerRow, WinStars, type WhoFn } from './bits'

const FEED_FRESH_MS = 3500

export interface ArenaViewProps {
  s: ArenaState
  who: WhoFn
  now: number
  feed: ArenaFeed
  compact: boolean
  me: string | null
  onFx?: (e: FxEvent) => void
}

/** Seconds until the park starts closing (0 once it has), from the arena on this screen. */
export function closesIn(sim: Sim | null): number {
  if (!sim) return 90
  return Math.max(0, Math.ceil((SHRINK_AT_STEPS - sim.t) / STEP_HZ))
}

/** The park just started closing (for the banner). */
export function justClosing(sim: Sim | null): boolean {
  return !!sim && sim.t >= SHRINK_AT_STEPS && sim.t < SHRINK_AT_STEPS + STEP_HZ * 2.6 && !sim.result
}

/** intro / play / over: the arena with everything around and on top of it. */
export function ArenaView(props: ArenaViewProps) {
  const { s, compact } = props
  const theme = themeAt(themeOf(s))
  return compact ? <Compact {...props} theme={theme} /> : <Tv {...props} theme={theme} />
}

// ---------------- TV ----------------

function Tv({ s, who, now, feed, onFx, theme }: ArenaViewProps & { theme: ArenaTheme }) {
  const sim = feed.sim()
  const secs = closesIn(sim)
  const closing = secs === 0 && s.stage !== 'intro'
  const kills = s.out.map((victim) => ({ victim, by: s.outBy[victim] ?? null }))
  const fresh = s.lastKill && now - s.lastKill.at < FEED_FRESH_MS ? s.lastKill.victim : null
  const multi = s.streak && s.streak.n >= 2 && now - s.streak.at < FEED_FRESH_MS ? s.streak : null
  return (
    <div className="absolute inset-0 grid grid-cols-[250px_minmax(0,1fr)_290px] gap-5 px-5 py-4" style={{ background: theme.backdrop }}>
      <aside className="flex min-h-0 flex-col gap-4">
        <div className="grid justify-items-start gap-1">
          <Ink size={30} color={theme.accent}>ROUND</Ink>
          <div className="flex items-end gap-2">
            <Ink size={96}>{s.round}</Ink>
            <span className="mb-2 font-party text-[22px] leading-none" style={{ color: INK }}>best of {s.bestOf}</span>
          </div>
        </div>
        <div className={cx('grid gap-0.5 rounded-[20px] border-4 px-4 py-2.5', closing && 'kb-pulse')} style={{ borderColor: INK, background: closing ? '#FFC83A' : '#FFFFFF', boxShadow: `0 6px 0 ${INK}`, color: INK }}>
          <span className="font-party text-[20px] leading-none">{closing ? 'The park is' : 'Park closes in'}</span>
          {closing
            ? <span className="font-party text-[52px] leading-none" style={{ color: PARK.coralDark }}>CLOSING</span>
            : <span className={cx('font-party text-[56px] leading-none tabular', secs <= 10 && s.stage === 'play' && 'kb-pulse')} style={{ color: secs <= 10 && s.stage === 'play' ? PARK.coralDark : INK }}>{Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}</span>}
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden">
          {kills.length > 0 && <span className="font-party text-[22px] leading-none" style={{ color: INK }}>Kill feed</span>}
          {[...kills].reverse().slice(0, 5).map((k) => (
            <FeedRow key={k.victim} by={k.by} victim={k.victim} who={who} size={42} fresh={k.victim === fresh} />
          ))}
          {multi && (
            <div key={multi.at} className="kb-pop self-start rounded-full border-4 px-4 py-1 font-party text-[24px] leading-none" style={{ borderColor: INK, background: '#FF5D4E', color: '#FFFFFF', boxShadow: `0 4px 0 ${INK}` }}>
              {multi.n} with one cherry bomb
            </div>
          )}
        </div>
      </aside>

      <div className="relative min-h-0 min-w-0">
        <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2">
          <div className="-rotate-2 whitespace-nowrap rounded-full border-4 px-6 py-1 font-party text-[26px] leading-none" style={{ borderColor: INK, background: theme.accent, color: theme.on, boxShadow: `0 5px 0 ${INK}` }}>
            {theme.name}
          </div>
        </div>
        <ArenaCanvas feed={feed} theme={theme.id} who={looksOf(s, who)} onFx={onFx} className="relative grid h-full w-full place-items-center pt-5" />
        <Overlays s={s} who={who} now={now} theme={theme} compact={false} closing={justClosing(sim)} />
      </div>

      <aside className="flex min-h-0 flex-col gap-3">
        <Ink size={26} color={theme.accent}>{`FIRST TO ${s.target}`}</Ink>
        {s.order.map((id) => <Plate key={id} s={s} id={id} who={who} />)}
      </aside>
    </div>
  )
}

function Plate({ s, id, who }: { s: ArenaState; id: string; who: WhoFn }) {
  const w = who(id)
  const out = s.out.includes(id) && (s.stage === 'play' || s.stage === 'over')
  const won = s.stage === 'over' && s.rounds.at(-1)?.winner === id
  const pw = s.powers[id] ?? freshPowers()
  return (
    <div className="relative rounded-[22px] border-4 px-3 pb-2.5 pt-2" style={{ borderColor: INK, background: out ? '#E7E4F0' : '#FFFFFF', boxShadow: `0 6px 0 ${INK}`, color: INK }}>
      <div className="flex items-center gap-2.5">
        <Portrait char={w.char} name={w.name} size={56} mood={out ? 'sad' : won ? 'happy' : 'idle'} dim={out} />
        <div className="grid min-w-0 flex-1 gap-1">
          <span className="truncate font-party text-[26px] leading-none">{w.name}</span>
          <WinStars won={s.wins[id] ?? 0} of={s.target} size={24} />
        </div>
        <span className="self-start font-party text-[18px] leading-none tabular" style={{ color: PARK.ink2 }}>{plural(s.kills[id] ?? 0, 'kill')}</span>
      </div>
      <div className={cx('mt-2', out && 'opacity-40')}><PowerRow p={pw} size={30} /></div>
      {out && (
        <span key={`out${s.round}`} className="kb-stamp absolute right-2 top-9 rounded-xl border-4 px-3 py-0.5 font-party text-[30px] leading-none" style={{ borderColor: PARK.coralDark, color: PARK.coralDark, background: '#FFFFFFdd' }}>
          OUT
        </span>
      )}
    </div>
  )
}

// ---------------- phones (apart) ----------------

function Compact({ s, who, now, feed, onFx, theme, me }: ArenaViewProps & { theme: ArenaTheme }) {
  const sim = feed.sim()
  const secs = closesIn(sim)
  const closing = secs === 0 && s.stage !== 'intro'
  const k = s.lastKill && now - s.lastKill.at < FEED_FRESH_MS ? s.lastKill : null
  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-2">
        <span className="rounded-full border-[3px] px-2.5 py-1 font-party text-[17px] leading-none" style={{ borderColor: INK, background: theme.accent, color: theme.on }}>
          R{s.round} {theme.name}
        </span>
        <span className="flex-1" />
        {s.order.map((id) => {
          const w = who(id)
          const out = s.out.includes(id) && (s.stage === 'play' || s.stage === 'over')
          return (
            <span key={id} className="relative">
              <Portrait char={w.char} name={w.name} size={id === me ? 34 : 30} mood={out ? 'sad' : 'idle'} dim={out} />
              {(s.wins[id] ?? 0) > 0 && (
                <span className="absolute -bottom-1 -right-1 grid h-[18px] min-w-[18px] place-items-center rounded-full border-2 px-0.5 font-party text-[12px] leading-none" style={{ borderColor: INK, background: PARK.star, color: INK }}>{s.wins[id]}</span>
              )}
            </span>
          )
        })}
        <span className={cx('ml-1 rounded-full border-[3px] px-2 py-1 font-party text-[17px] leading-none tabular', closing && 'kb-pulse')} style={{ borderColor: INK, background: closing || secs <= 10 ? '#FFC83A' : '#FFFFFF', color: INK }}>
          {closing ? 'CLOSING' : `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`}
        </span>
      </div>
      <div className="relative overflow-hidden rounded-[18px] border-4" style={{ borderColor: INK, background: theme.backdrop, boxShadow: `0 4px 0 ${INK}` }}>
        <div className="aspect-[146/126] w-full">
          <ArenaCanvas feed={feed} theme={theme.id} who={looksOf(s, who)} onFx={onFx} />
        </div>
        <Overlays s={s} who={who} now={now} theme={theme} compact closing={justClosing(sim)} />
        {k && s.stage === 'play' && (
          <div key={k.at} className="pointer-events-none absolute inset-x-2 bottom-2">
            <FeedRow by={k.by} victim={k.victim} who={who} size={28} fresh />
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------- the cards on top ----------------

function Overlays({ s, who, now, theme, compact, closing }: { s: ArenaState; who: WhoFn; now: number; theme: ArenaTheme; compact: boolean; closing: boolean }) {
  const t = now
  let layer: ReactNode = null
  if (s.stage === 'intro') {
    if (t - s.stageAt < VS_MS) layer = <VsCard s={s} who={who} theme={theme} compact={compact} />
    else {
      const n = Math.max(1, Math.ceil((s.startsAt - t) / 1000))
      layer = (
        <div className="absolute inset-0 grid place-items-center" style={{ background: 'rgba(30,24,56,0.22)' }}>
          <div key={n} className="kb-count"><Ink size={compact ? 120 : 240} color={n === 1 ? PARK.coral : n === 2 ? PARK.sun : '#FFFFFF'}>{n}</Ink></div>
        </div>
      )
    }
  } else if (s.stage === 'play' && t - s.stageAt < 1000) {
    layer = (
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="kb-go"><Ink size={compact ? 110 : 220} color={PARK.good}>GO!</Ink></div>
      </div>
    )
  } else if (s.stage === 'play' && closing) {
    layer = (
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="pp-banner">
          <div className={cx('-skew-x-6 border-y-[6px]', compact ? 'px-5 py-1.5' : 'px-14 py-3')} style={{ background: '#FFC83A', borderColor: INK, boxShadow: `0 8px 0 ${INK}` }}>
            <div className="skew-x-6"><Ink size={compact ? 34 : 72}>THE PARK IS CLOSING</Ink></div>
          </div>
        </div>
      </div>
    )
  } else if (s.stage === 'over') {
    layer = <RoundOver s={s} who={who} compact={compact} />
  }
  return layer
}

function VsCard({ s, who, theme, compact }: { s: ArenaState; who: WhoFn; theme: ArenaTheme; compact: boolean }) {
  const n = s.order.length
  const size = compact ? (n > 4 ? 46 : n > 3 ? 56 : n > 2 ? 70 : 90) : n > 4 ? 84 : n > 3 ? 104 : n > 2 ? 132 : 170
  return (
    <div className="absolute inset-0 grid content-center justify-items-center gap-3 overflow-hidden" style={{ background: `${theme.accent}EE` }}>
      <div className="pointer-events-none absolute left-1/2 top-1/2" style={{ width: 0, height: 0 }}>
        <div className="kb-rays absolute" style={{ left: -900, top: -900, width: 1800, height: 1800, borderRadius: '50%', background: 'repeating-conic-gradient(rgba(255,255,255,0.22) 0deg 10deg, rgba(255,255,255,0) 10deg 24deg)' }} />
      </div>
      <div className="kb-pop relative grid justify-items-center gap-1">
        <Ink size={compact ? 28 : 54}>{`ROUND ${s.round}`}</Ink>
        <Ink size={compact ? 20 : 34} color="#FFDA3D">{theme.name.toUpperCase()}</Ink>
      </div>
      <div className="relative flex items-end justify-center" style={{ gap: compact ? 4 : 12 }}>
        {s.order.map((id, i) => {
          const w = who(id)
          const side = i < n / 2 ? 'kb-in-l' : 'kb-in-r'
          return (
            <div key={id} className="flex items-end" style={{ gap: compact ? 4 : 12 }}>
              {i > 0 && (
                <div className="kb-vs self-center" style={{ animationDelay: `${200 + i * 120}ms` }}>
                  <Ink size={compact ? 24 : n > 3 ? 40 : 54} color={PARK.coin}>VS</Ink>
                </div>
              )}
              <div className={cx(side, 'grid justify-items-center')} style={{ animationDelay: `${i * 110}ms` }}>
                <div className="kb-bob" style={{ animationDelay: `${-i * 0.3}s` }}>
                  <CritterArt id={w.char ?? 'chomp'} size={size} mood="hop" anim={false} flip={i >= n / 2} />
                </div>
                <div className={cx('-mt-1 rounded-full border-[3px] bg-white font-party leading-none', compact ? 'px-2 py-0.5 text-[15px]' : 'px-4 py-1 text-[28px]')} style={{ borderColor: INK, color: INK, boxShadow: `0 4px 0 ${INK}` }}>
                  {w.name}
                </div>
                {s.round > 1 && <div className="mt-1"><WinStars won={s.wins[id] ?? 0} of={s.target} size={compact ? 14 : 26} /></div>}
              </div>
            </div>
          )
        })}
      </div>
      {!compact && <div className="kb-in-up relative rounded-full border-4 bg-white px-6 py-2 font-party text-[28px] leading-none" style={{ borderColor: INK, color: INK, boxShadow: `0 5px 0 ${INK}`, animationDelay: '500ms' }}>{theme.line}</div>}
    </div>
  )
}

function RoundOver({ s, who, compact }: { s: ArenaState; who: WhoFn; compact: boolean }) {
  const last = s.rounds.at(-1)
  if (!last) return null
  const final = decided(s)
  const champ = final ? leader(s) : null
  const winner = last.winner
  const big = compact ? 120 : 230
  const small = compact ? 54 : 104
  const title = final && champ
    ? `${who(champ).name.toUpperCase()} WINS IT`
    : winner ? `${who(winner).name.toUpperCase()} TAKES IT` : 'NOBODY MADE IT'
  const sub = final ? 'Podium in a second. Mingo is finding the stickers.'
    : winner ? (s.kills[winner] ? `Round ${s.round}. ${plural(s.wins[winner] ?? 0, 'round')} now.` : `Round ${s.round}. Won by hiding. Still counts.`)
      : "Doesn't count. Again."
  return (
    <div className="absolute inset-0 grid content-center justify-items-center gap-2 overflow-hidden" style={{ background: 'rgba(255,255,255,0.78)' }}>
      <div className="kb-pop whitespace-nowrap"><Ink size={compact ? (title.length > 16 ? 24 : 30) : title.length > 18 ? 44 : 54} color={winner ? PARK.coin : PARK.coral}>{title}</Ink></div>
      <div className="flex items-end justify-center" style={{ gap: compact ? 6 : 18 }}>
        {winner && (
          <div className="grid justify-items-center">
            <div className="kb-cheer"><CritterArt id={who(winner).char ?? 'chomp'} size={big} mood="happy" anim={false} /></div>
          </div>
        )}
        {s.order.filter((id) => id !== winner).map((id) => (
          <div key={id} className="grid justify-items-center opacity-90">
            <CritterArt id={who(id).char ?? 'chomp'} size={small} mood="sad" />
          </div>
        ))}
      </div>
      <div className={cx('rounded-full border-4 bg-white font-party leading-tight', compact ? 'px-3 py-1 text-[15px]' : 'px-6 py-2 text-[28px]')} style={{ borderColor: INK, color: INK, boxShadow: `0 4px 0 ${INK}` }}>{sub}</div>
      <div className="flex gap-3">
        {s.order.map((id) => (
          <span key={id} className="inline-flex items-center gap-1.5 rounded-full border-[3px] bg-white py-0.5 pl-0.5 pr-2" style={{ borderColor: INK }}>
            <Portrait char={who(id).char} name={who(id).name} size={compact ? 22 : 36} />
            <WinStars won={s.wins[id] ?? 0} of={s.target} size={compact ? 13 : 24} />
          </span>
        ))}
      </div>
    </div>
  )
}
