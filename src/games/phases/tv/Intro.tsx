import type { PhasesState } from '../logic'
import { CardFace } from '../Card'
import type { Who } from '../view'
import { LENGTH_NAME } from '../view'
import { BRASS_GRAD, LOUNGE, phaseShort } from '../lounge/look'
import { Disc } from '../lounge/bits'
import { MID, TABLE } from './layout'

/** Round 1 opens on the house rules: tonight's phase list, lower is better, Wilds and Skips. Auto-advances into the deal. */
export function Intro({ s, who }: { s: PhasesState; who: Who }) {
  const W = 700
  const many = s.list.length > 5
  return (
    <>
      <div className="ph-fade absolute" style={{ left: TABLE.x, top: TABLE.y, width: TABLE.w, height: TABLE.h, borderRadius: 96, background: 'rgba(6,3,2,0.55)', zIndex: 50 }} />
      <div
        className="ph-rise absolute"
        style={{
          left: MID.x - W / 2, top: 40, width: W, zIndex: 60, padding: 6, borderRadius: 20, background: BRASS_GRAD,
          boxShadow: '0 30px 60px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{ borderRadius: 15, padding: '22px 30px 24px', background: `linear-gradient(180deg, #2A1A12 0%, #170D08 100%)`, color: LOUNGE.cream }}>
          <div className="grid justify-items-center" style={{ gap: 4 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, letterSpacing: '0.34em', color: 'rgba(246,238,219,0.6)' }}>HOUSE RULES · {(LENGTH_NAME[s.length] ?? s.length).toUpperCase()}</span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 46, lineHeight: 1, color: LOUNGE.brass, textShadow: '0 3px 0 #000' }}>THE PHASE LOUNGE</span>
            <div className="flex" style={{ gap: 8, marginTop: 6 }}>
              {s.order.map((id) => { const p = who(id); return <Disc key={id} name={p.name} color={p.color} size={30} /> })}
            </div>
          </div>
          <div className="grid" style={{ marginTop: 16, gridTemplateColumns: many ? '1fr 1fr' : '1fr', columnGap: 26, rowGap: many ? 4 : 6 }}>
            {s.list.map((p, i) => (
              <div key={i} className="flex items-center" style={{ gap: 10, ...(many ? {} : { justifyContent: 'center' }) }}>
                <span className="grid shrink-0 place-items-center rounded-full" style={{ width: 28, height: 28, background: LOUNGE.oxbloodDark, boxShadow: `inset 0 0 0 2px ${LOUNGE.brass}`, fontFamily: 'var(--font-party)', fontSize: 16, color: LOUNGE.brass }}>{p + 1}</span>
                <span style={{ fontFamily: 'var(--font-party)', fontSize: 22, color: LOUNGE.cream }}>{phaseShort(p)}</span>
              </div>
            ))}
          </div>
          <div className="grid" style={{ marginTop: 18, gap: 10, gridTemplateColumns: '1fr 1fr 1fr' }}>
            <Rule art={<div className="flex" style={{ gap: 3 }}><CardFace id={6} w={30} /><CardFace id={30} w={30} /><CardFace id={78} w={30} /></div>} text="Lay down your phase, then empty your hand." />
            <Rule art={<span style={{ fontFamily: 'var(--font-display)', fontSize: 30, color: LOUNGE.brass, lineHeight: 1.4 }}>+25</span>} text="Cards left over are points. Lower wins." />
            <Rule art={<div className="flex" style={{ gap: 3 }}><CardFace id={96} w={30} /><CardFace id={104} w={30} /></div>} text="Wilds fill any gap. Skips steal a turn." />
          </div>
        </div>
      </div>
    </>
  )
}

function Rule({ art, text }: { art: React.ReactNode; text: string }) {
  return (
    <div className="grid justify-items-center text-center" style={{ gap: 6 }}>
      <div className="grid h-11 place-items-center">{art}</div>
      <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 17, lineHeight: 1.25, color: 'rgba(246,238,219,0.88)' }}>{text}</span>
    </div>
  )
}
