import type { AggroState } from '../logic'
import { HALF, PLANE } from './BoardArt'
import { cameraAt } from './moment'
import { Plane } from './Plane'
import { WOOD } from './palette'

/** Camera lean (deg on X) and lens distance for the TV board. */
export const TILT = 40
const PERSPECTIVE = 1900
const THICK = 34

/**
 * The TV board: the wooden board lying on the table, leaned back under the lamp. The camera
 * nudges toward a moving marble and settles back; `shake` (px) jolts it on an Aggro.
 */
export function Table({ s, colors, t, scale, shake = 0, turnSeat }: { s: AggroState; colors: string[]; t: number; scale: number; shake?: number; turnSeat: number }) {
  const cam = cameraAt(s, t)
  const zoom = scale * (1 + 0.14 * cam.w)
  const cx = cam.x * 60 * 0.42 * cam.w
  const cy = cam.y * 60 * 0.42 * cam.w
  const sx = shake ? Math.sin(t / 23) * shake : 0
  const sy = shake ? Math.cos(t / 31) * shake * 0.6 : 0
  return (
    <div style={{ position: 'absolute', inset: 0, perspective: PERSPECTIVE, perspectiveOrigin: '50% 30%', pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 0,
          height: 0,
          transformStyle: 'preserve-3d',
          transform: `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) scale(${zoom.toFixed(4)}) rotateX(${TILT}deg) translate(${(-cx).toFixed(1)}px, ${(-cy).toFixed(1)}px)`,
        }}
      >
        <div style={{ position: 'absolute', left: -HALF, top: -HALF, width: PLANE, height: PLANE, transformStyle: 'preserve-3d' }}>
          {/* Shadow the board throws on the table. */}
          <div
            style={{
              position: 'absolute',
              left: -60,
              top: -20,
              width: PLANE + 120,
              height: PLANE + 140,
              borderRadius: 120,
              background: 'radial-gradient(ellipse at 50% 55%, rgba(0,0,0,0.6) 0 55%, rgba(0,0,0,0) 72%)',
              transform: `translateZ(${-THICK - 1}px)`,
            }}
          />
          {/* The board's thickness: front and side edges. */}
          <div style={{ position: 'absolute', left: 30, top: PLANE, width: PLANE - 60, height: THICK, transformOrigin: '50% 0', transform: 'rotateX(-90deg)', background: `linear-gradient(${WOOD.edge}, ${WOOD.edgeDark})` }} />
          <div style={{ position: 'absolute', left: -THICK, top: 30, width: THICK, height: PLANE - 60, transformOrigin: '100% 50%', transform: 'rotateY(-90deg)', background: `linear-gradient(90deg, ${WOOD.edgeDark}, ${WOOD.edge})` }} />
          <div style={{ position: 'absolute', left: PLANE, top: 30, width: THICK, height: PLANE - 60, transformOrigin: '0 50%', transform: 'rotateY(90deg)', background: `linear-gradient(90deg, ${WOOD.edge}, ${WOOD.edgeDark})` }} />
          <Plane s={s} colors={colors} t={t} tilt={TILT} turnSeat={turnSeat} />
        </div>
      </div>
    </div>
  )
}
