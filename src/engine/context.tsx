import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useReducer, useRef, type ReactNode } from 'react'
import type { RoomLink, StreamMsg } from '../net/link'

/**
 * What a game's Stage / Controller can reach beyond its props:
 * live streams (high-rate, not saved in state) and a re-render ticker for countdowns.
 */
interface GameEnv {
  link: RoomLink | null
  me: string | null
}

const Ctx = createContext<GameEnv>({ link: null, me: null })

export function GameEnvProvider({ link, me, children }: GameEnv & { children: ReactNode }) {
  return <Ctx.Provider value={{ link, me }}>{children}</Ctx.Provider>
}

/** Listen to a live stream, e.g. useStream('sketch:live', (m) => ...). The handler may change freely. */
export function useStream(kind: string, handler: (m: StreamMsg) => void) {
  const { link } = useContext(Ctx)
  const ref = useRef(handler)
  useLayoutEffect(() => { ref.current = handler })
  useEffect(() => {
    if (!link) return
    return link.onStream(kind, (m) => ref.current(m))
  }, [link, kind])
}

/** Send on a live stream. Reaches every device, this one included. Keep it under ~15 msgs/sec. */
export function useSendStream() {
  const { link, me } = useContext(Ctx)
  return useCallback((kind: string, data: unknown) => {
    link?.sendStream(kind, me ?? 'screen', data)
  }, [link, me])
}

/** Re-render every `ms` (for countdowns and clocks). */
export function useTicker(ms = 100) {
  const [, bump] = useReducer((x: number) => x + 1, 0)
  useEffect(() => {
    const t = setInterval(bump, ms)
    return () => clearInterval(t)
  }, [ms])
}
