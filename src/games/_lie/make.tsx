import type { ControllerProps, StageProps } from '../../engine/types'
import type { LieState } from './logic'
import { LieStageView } from './Stage'
import { LieControllerView } from './Controller'
import type { LieView } from './view'

/** Bind the shared TV and phone views to one game's wording. */
export function createLieViews(view: LieView) {
  function Stage(props: StageProps<LieState>) {
    return <LieStageView {...props} view={view} />
  }
  function Controller(props: ControllerProps<LieState>) {
    return <LieControllerView {...props} view={view} />
  }
  return { Stage, Controller }
}
