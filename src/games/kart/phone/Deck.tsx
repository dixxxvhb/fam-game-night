import { useLayoutEffect, useState, type ReactNode } from 'react'
import { cx } from '../../../ui/kit'
import { INK, type CritterId } from '../../board/park/cast'
import { Coin, PARK, SKY_BG } from '../../board/park/ui'
import type { useSteering } from '../useSteering'
import type { ItemKind } from '../sim'
import type { useControls } from './controls'
import { Chevron, hopLook, ItemFace, Pad, Pill, Wheel } from './parts'

type Controls = ReturnType<typeof useControls>
type Steering = ReturnType<typeof useSteering>

export interface DeckProps {
  controls: Controls
  steering: Steering
  gas: 'auto' | 'hold'
  land: boolean
  apart: boolean
  char: CritterId | null
  color: string
  /** Big top-left readout: the place, or the countdown. */
  big: ReactNode
  /** Smaller readouts on the right: lap, coins. */
  lap: ReactNode
  coins: number | null
  /** One line under the readouts (countdown hint, steering help). */
  line?: ReactNode
  /** Item slot (null = no item pad, e.g. time trial). */
  item: { item: ItemKind | null; rolling: boolean; uses: number; flash: boolean; fire: () => void } | null
  mt: 0 | 1 | 2 | 3
  /** Chase cam (apart). */
  cam?: ReactNode
  /** Over the cam (apart) or over the deck (together): countdown numbers, finish card. */
  overlay?: ReactNode
  /** Replace the controls entirely (finished, run over). */
  done?: ReactNode
  plate?: ReactNode
}

/** Top of the fixed overlay in apart portrait: just under the room header. */
function useHeaderBottom(on: boolean) {
  const [top, setTop] = useState(0)
  useLayoutEffect(() => {
    if (!on) return
    const m = () => setTop(Math.round(document.querySelector('header')?.getBoundingClientRect().bottom ?? 0))
    m()
    window.addEventListener('resize', m)
    return () => window.removeEventListener('resize', m)
  }, [on])
  return top
}

/** The steering mode switches: calibrate / buttons / tilt. */
function ModeRow({ steering, compact }: { steering: Steering; compact?: boolean }) {
  if (steering.mode === 'tilt') {
    return (
      <div className="flex justify-center gap-2">
        <Pill onClick={steering.calibrate} data-kart-calibrate>{compact ? 'Center' : 'Center wheel'}</Pill>
        <Pill onClick={steering.pickButtons} data-kart-buttons>{compact ? 'Buttons' : 'Use buttons'}</Pill>
      </div>
    )
  }
  if (steering.mode === 'buttons' && steering.tiltAvailable) {
    return <div className="flex justify-center"><Pill onClick={steering.pickTilt} data-kart-tilt>{compact ? 'Tilt' : 'Steer by tilting'}</Pill></div>
  }
  return null
}

/** iOS needs a tap before it shares the tilt sensor. Offered once, with an exit. */
function TiltAsk({ steering, compact }: { steering: Steering; compact?: boolean }) {
  if (steering.mode === 'checking') {
    return (
      <div className="pointer-events-auto grid justify-items-center gap-2 rounded-[22px] border-4 bg-white px-4 py-3 text-center" style={{ borderColor: INK, boxShadow: `0 5px 0 ${INK}` }}>
        <div className="font-party text-xl leading-tight">Looking for your tilt sensor</div>
        <Pill onClick={steering.pickButtons} data-kart-buttons>Use buttons</Pill>
      </div>
    )
  }
  if (steering.mode !== 'needs-tap') return null
  return (
    <div className="pointer-events-auto grid justify-items-center gap-2 rounded-[22px] border-4 bg-white px-4 py-3 text-center" style={{ borderColor: INK, boxShadow: `0 5px 0 ${INK}` }}>
      {!compact && <div className="font-party text-2xl leading-tight">Steer by tilting the phone</div>}
      <button
        type="button"
        data-kart-enable-tilt
        onClick={() => void steering.request()}
        className="no-select min-h-16 rounded-[20px] border-4 px-6 font-party text-2xl leading-none text-white active:translate-y-[4px]"
        style={{ borderColor: INK, background: PARK.coral, boxShadow: `0 6px 0 ${PARK.coralDark}, 0 6px 0 4px ${INK}` }}
      >
        Tap to turn on tilt
      </button>
      <Pill onClick={steering.pickButtons} data-kart-buttons>Use buttons</Pill>
    </div>
  )
}

/**
 * The driving deck, every layout: together portrait / landscape, apart portrait (cam band on
 * top) / landscape (cam full screen, pads over it). Race and time trial both use it.
 */
export function Deck(p: DeckProps) {
  const { controls, steering, gas, land, apart, char, color, mt } = p
  const buttons = steering.mode !== 'tilt'
  const hold = gas === 'hold'
  const down = (k: string) => controls.pressed.includes(k)
  const hop = hopLook(mt, down('D'))
  const headerBottom = useHeaderBottom(apart && !land)
  const cols = !p.item ? (hold ? 'grid-cols-[1.4fr_1fr]' : 'grid-cols-1') : hold ? 'grid-cols-[1fr_1.3fr_1fr]' : 'grid-cols-[1fr_1.4fr]'
  const asking = (steering.mode === 'needs-tap' || steering.mode === 'checking') && !p.overlay

  const half = (k: 'L' | 'R', size: number, className?: string) => (
    <Pad
      on={down(k)}
      tone={down(k) ? PARK.sun : '#F4F8FF'}
      edge={PARK.sunDark}
      aria-label={k === 'L' ? 'Steer left' : 'Steer right'}
      data-kart-steer={k}
      className={cx('h-full w-full', className)}
      {...controls.bind(k)}
    >
      <Chevron dir={k} size={size} />
    </Pad>
  )
  const hopPad = (className?: string, label = 'HOP', small = false) => (
    <Pad
      on={down('D')}
      tone={hop.tone}
      edge={hop.edge}
      glow={hop.glow}
      aria-label="Hop and drift"
      data-kart-hop
      data-mt={mt}
      className={cx('h-full w-full', mt > 0 && 'kp-glow', className)}
      {...controls.bind('D')}
    >
      <span style={{ fontSize: small ? 30 : 40 }}>{label}</span>
      {!small && <span className="text-[15px]">{mt > 0 ? hop.sub : 'HOLD TO DRIFT'}</span>}
    </Pad>
  )
  const gasPad = (className?: string, small = false) => (hold ? (
    <Pad on={down('G')} tone={down('G') ? '#7BE08F' : PARK.good} edge="#1E8A40" aria-label="Gas" data-kart-gas className={cx('h-full w-full', className)} {...controls.bind('G')}>
      <span className="text-white" style={{ fontSize: small ? 28 : 36, WebkitTextStroke: `2px ${INK}`, paintOrder: 'stroke fill' }}>GAS</span>
    </Pad>
  ) : null)
  const itemPad = (className?: string, size = 84) => (p.item ? (
    <Pad
      on={p.item.flash}
      tone={p.item.rolling ? '#FFE3F0' : p.item.item ? '#FFF6D6' : '#FFFFFF'}
      edge={p.item.item ? PARK.coralDark : '#C9C4DA'}
      aria-label={`Use item${p.item.item ? `: ${p.item.item}` : ''}`}
      data-kart-item={p.item.rolling ? 'rolling' : p.item.item ?? ''}
      className={cx('h-full w-full', className)}
      onPointerDown={(e) => { e.preventDefault(); p.item!.fire() }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <ItemFace item={p.item.item} rolling={p.item.rolling} uses={p.item.uses} size={size} />
    </Pad>
  ) : null)

  const coins = p.coins !== null && (
    <span className="inline-flex items-center gap-1 rounded-full border-[3px] bg-white py-0.5 pl-1 pr-2.5" style={{ borderColor: INK }}>
      <Coin size={26} />
      <span className="font-party text-[26px] leading-none tabular">{p.coins}</span>
    </span>
  )
  const lapChip = <span className="whitespace-nowrap rounded-full border-[3px] bg-white px-3 py-1 font-party text-[24px] leading-none tabular" style={{ borderColor: INK }}>{p.lap}</span>

  // ---------------- apart landscape: cam full screen, pads over it ----------------
  if (apart && land) {
    return (
      <div className="touch-none-all no-select fixed inset-0 z-40 overflow-hidden" style={{ background: SKY_BG, color: INK }} data-kart-deck="apart-land">
        <div className="absolute inset-0">{p.cam}</div>
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start gap-3 p-3" style={{ paddingLeft: 'max(env(safe-area-inset-left), 12px)', paddingRight: 'max(env(safe-area-inset-right), 12px)' }}>
          <div className="min-w-[80px]">{p.big}</div>
          <div className="flex flex-1 items-start justify-center gap-2 pt-1">{lapChip}<Wheel get={controls.steerNow} size={76} char={char} color={color} className="-mt-1" />{coins}</div>
          <div className="pointer-events-auto"><ModeRow steering={steering} compact /></div>
        </div>
        {p.overlay && <div className="pointer-events-none absolute inset-0 grid place-items-center p-6">{p.overlay}</div>}
        {asking && !p.done && <div className="absolute inset-0 grid place-items-center"><TiltAsk steering={steering} compact /></div>}
        {p.done ? (
          <div className="absolute inset-x-0 bottom-0 grid place-items-center p-4">{p.done}</div>
        ) : (
          <>
            <div className="absolute bottom-3 left-3 flex items-end gap-3" style={{ left: 'max(env(safe-area-inset-left), 12px)' }}>
              {buttons ? (
                <>
                  <div className="h-[150px] w-[118px]">{half('L', 54)}</div>
                  <div className="h-[150px] w-[118px]">{half('R', 54)}</div>
                </>
              ) : (
                <div className="h-[150px] w-[170px]">{hopPad()}</div>
              )}
            </div>
            <div className="absolute bottom-3 right-3 flex items-end gap-3" style={{ right: 'max(env(safe-area-inset-right), 12px)' }}>
              {p.item && <div className="h-[128px] w-[118px]">{itemPad(undefined, 64)}</div>}
              {hold && <div className="h-[150px] w-[104px]">{gasPad(undefined, true)}</div>}
              {buttons && <div className="h-[150px] w-[132px]">{hopPad(undefined, 'HOP', true)}</div>}
            </div>
          </>
        )}
      </div>
    )
  }

  // ---------------- apart portrait: cam band on top, deck below ----------------
  if (apart) {
    return (
      <div className="touch-none-all no-select fixed inset-x-0 bottom-0 z-40 flex flex-col" style={{ top: headerBottom, background: SKY_BG, color: INK }} data-kart-deck="apart-port">
        <div className="relative h-[300px] shrink-0 overflow-hidden border-b-4" style={{ borderColor: INK }}>
          <div className="absolute inset-0">{p.cam}</div>
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2.5">
            <div>{p.big}</div>
            <div className="grid justify-items-end gap-1.5">{lapChip}{coins}</div>
          </div>
          {p.overlay && <div className="pointer-events-none absolute inset-0 grid place-items-center p-4">{p.overlay}</div>}
        </div>
        {p.done ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4">{p.done}</div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 pb-4">
            {p.line && <div className="text-center text-[18px] font-bold leading-tight">{p.line}</div>}
            <div className="relative min-h-0 flex-1">
              {buttons ? (
                <div className="grid h-full grid-cols-2 gap-3">
                  {half('L', 60, 'justify-items-start pl-3')}
                  {half('R', 60, 'justify-items-end pr-3')}
                </div>
              ) : null}
              <div className="pointer-events-none absolute inset-0 grid place-items-center">
                <Wheel get={controls.steerNow} size={buttons ? 130 : 170} char={char} color={color} />
              </div>
              {asking && <div className="absolute inset-0 grid place-items-center"><TiltAsk steering={steering} /></div>}
            </div>
            <ModeRow steering={steering} />
            <div className={cx('grid h-[132px] shrink-0 gap-3', cols)}>
              {itemPad(undefined, 70)}
              {hopPad()}
              {gasPad()}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ---------------- together landscape ----------------
  if (land) {
    return (
      <div className="touch-none-all no-select relative flex h-full min-h-0 flex-col gap-2 p-3" style={{ background: SKY_BG, color: INK }} data-kart-deck="together-land">
        {p.done ? (
          <div className="flex flex-1 items-center justify-center gap-6">{p.done}</div>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-[1fr_1.3fr_1fr] gap-3">
            <div className="min-h-0">
              {buttons ? (
                <div className="grid h-full grid-cols-2 gap-2">{half('L', 50)}{half('R', 50)}</div>
              ) : hopPad()}
            </div>
            <div className="relative flex min-h-0 flex-col items-center gap-1">
              <div className="flex w-full items-start justify-between gap-1">
                <div>{p.big}</div>
                <div className="grid justify-items-end gap-1">{lapChip}{coins}</div>
              </div>
              <div className="relative grid min-h-0 flex-1 place-items-center">
                <Wheel get={controls.steerNow} size={124} char={char} color={color} />
              </div>
              {p.line && <div className="text-center text-[16px] font-bold leading-tight">{p.line}</div>}
              <ModeRow steering={steering} compact />
              {asking && <div className="absolute inset-0 z-10 grid place-items-center"><TiltAsk steering={steering} compact /></div>}
              {p.overlay && <div className="pointer-events-none absolute inset-0 grid place-items-center">{p.overlay}</div>}
            </div>
            <div className="grid min-h-0 gap-2" style={{ gridTemplateRows: buttons ? '1.2fr 1fr' : '1fr' }}>
              {buttons && hopPad()}
              <div className={cx('grid min-h-0 gap-2', hold ? 'grid-cols-2' : 'grid-cols-1')}>
                {itemPad(undefined, buttons ? 54 : 84)}
                {gasPad(undefined, true)}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ---------------- together portrait ----------------
  return (
    <div className="touch-none-all no-select relative flex h-full min-h-0 flex-col" style={{ background: SKY_BG, color: INK }} data-kart-deck="together-port">
      {p.plate}
      {p.done ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">{p.done}</div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 pb-4">
          <div className="relative flex min-h-[104px] items-center justify-between gap-2 px-1">
            <div>{p.big}</div>
            <div className="grid justify-items-end gap-1.5">{lapChip}{coins}</div>
            {p.overlay && <div className="pointer-events-none absolute inset-0 grid place-items-center">{p.overlay}</div>}
          </div>
          {p.line && <div className="-mt-1 text-center text-[18px] font-bold leading-tight">{p.line}</div>}
          <div className="relative min-h-[180px] flex-1">
            {buttons && (
              <div className="grid h-full grid-cols-2 gap-3">
                {half('L', 64, 'justify-items-start pl-3')}
                {half('R', 64, 'justify-items-end pr-3')}
              </div>
            )}
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <Wheel get={controls.steerNow} size={buttons ? 150 : 210} char={char} color={color} />
            </div>
            {asking && <div className="absolute inset-0 grid place-items-center"><TiltAsk steering={steering} /></div>}
          </div>
          <ModeRow steering={steering} />
          <div className={cx('grid h-[150px] shrink-0 gap-3', cols)}>
            {itemPad()}
            {hopPad()}
            {gasPad()}
          </div>
        </div>
      )}
    </div>
  )
}

