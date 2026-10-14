import { lazy, Suspense, type ComponentProps } from 'react'

/**
 * The camera (and the garage sprites behind it) rasterize art the moment they load, which needs
 * a DOM. The registry is imported by node tests, so the phone pulls the camera in lazily.
 */
const SingleViewImpl = lazy(() => import('../view/TrackView').then((m) => ({ default: m.SingleView })))
const TrackViewImpl = lazy(() => import('../view/TrackView'))

type SingleProps = ComponentProps<typeof SingleViewImpl>
type TrackProps = ComponentProps<typeof TrackViewImpl>

export function SingleView(props: SingleProps) {
  return <Suspense fallback={null}><SingleViewImpl {...props} /></Suspense>
}

export function TrackView(props: TrackProps) {
  return <Suspense fallback={null}><TrackViewImpl {...props} /></Suspense>
}

/** Warm the kart / prop / thing sprites (apart phones), without importing them up front. */
export function preloadGarageLazy(...args: Parameters<typeof import('../garage/sprites').preloadGarage>) {
  return import('../garage/sprites').then((m) => m.preloadGarage(...args))
}
