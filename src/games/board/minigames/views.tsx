import type { ComponentType } from 'react'
import type { MgPadProps, MgViewProps } from './ui'
import type { Who } from '../view'
import { MashPad, MashStage } from './mash.view'
import { QuickDrawPad, QuickDrawStage } from './quickdraw.view'
import { ClockPad, ClockStage } from './clock.view'
import { MemoryPad, MemoryStage } from './memory.view'
import { OddPad, OddStage } from './oddone.view'
import { PotatoPad, PotatoStage } from './potato.view'
import { EightPad, EightStage } from './eight.view'
import { StroopPad, StroopStage } from './stroop.view'
import { MathPad, MathStage } from './math.view'
import { ClosestPad, ClosestReveal, ClosestStage } from './closest.view'
import { ReflexPad, ReflexStage } from './reflex.view'

export interface MgViews {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- each minigame has its own state type
  Stage: ComponentType<MgViewProps<any>>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- each minigame has its own state type
  Pad: ComponentType<MgPadProps<any>>
  /** Extra reveal on the results card. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- each minigame has its own state type
  Reveal?: ComponentType<{ s: any; who: Who }>
}

export const VIEWS: Record<string, MgViews> = {
  mash: { Stage: MashStage, Pad: MashPad },
  quickdraw: { Stage: QuickDrawStage, Pad: QuickDrawPad },
  clock: { Stage: ClockStage, Pad: ClockPad },
  memory: { Stage: MemoryStage, Pad: MemoryPad },
  oddone: { Stage: OddStage, Pad: OddPad },
  potato: { Stage: PotatoStage, Pad: PotatoPad },
  eight: { Stage: EightStage, Pad: EightPad },
  stroop: { Stage: StroopStage, Pad: StroopPad },
  math: { Stage: MathStage, Pad: MathPad },
  closest: { Stage: ClosestStage, Pad: ClosestPad, Reveal: ClosestReveal },
  reflex: { Stage: ReflexStage, Pad: ReflexPad },
}
