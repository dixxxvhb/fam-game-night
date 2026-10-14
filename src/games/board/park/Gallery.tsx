import { CAST, CritterArt, Mingo, type Mood } from './cast'

/** Dev sheet for the Party Park cast: every critter in every mood (#/park-cast). */
export default function ParkGallery() {
  const moods: Mood[] = ['idle', 'happy', 'sad', 'hop']
  return (
    <div className="min-h-full p-8" style={{ background: 'linear-gradient(#7FD6FF, #C9F0FF)' }}>
      <div className="flex items-end gap-6">
        <Mingo size={200} />
        <Mingo size={200} mood="happy" />
        <div className="font-party text-6xl text-[#1E1838]">Party Park cast</div>
      </div>
      <div className="mt-6 flex flex-wrap items-end gap-2">
        {CAST.map((c) => <CritterArt key={c.id} id={c.id} size={160} anim={false} />)}
      </div>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        {CAST.map((c) => <CritterArt key={c.id} id={c.id} size={160} mood="happy" anim={false} />)}
      </div>
      <div className="mt-2 flex flex-wrap items-end gap-4">
        {CAST.map((c) => <div key={c.id} className="rounded-full bg-white" style={{ boxShadow: `0 0 0 5px ${c.color}` }}><CritterArt id={c.id} crop="head" size={90} anim={false} /></div>)}
      </div>
      <div className="mt-6 grid grid-cols-4 gap-6">
        {CAST.map((c) => (
          <div key={c.id} className="rounded-3xl border-4 border-[#1E1838] bg-white p-4 shadow-[0_6px_0_#1E1838]">
            <div className="flex items-end gap-1">
              {moods.map((m) => <CritterArt key={m} id={c.id} mood={m} size={74} anim={false} />)}
            </div>
            <div className="mt-2 flex items-center gap-3">
              <CritterArt id={c.id} crop="head" size={56} anim={false} />
              <div>
                <div className="font-party text-2xl" style={{ color: '#1E1838' }}>{c.name}</div>
                <div className="text-sm text-[#4A4566]">{c.kind}. {c.bio}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
