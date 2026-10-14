import { useEffect, useState } from 'react'
import { sfx } from '../../../ui/sfx'
import { STINGER_IDS, TRACK_IDS, music, renderOffline, type TrackId } from './music'
import { PartyButton, SKY_BG, Sticker } from './ui'

/** Dev page for the Party Park soundtrack (#/park-music): play each track and stinger. */
export default function MusicBox() {
  const [track, setTrack] = useState<TrackId | null>(null)
  useEffect(() => { sfx.enable(true); return () => { music.play(null) } }, [])
  useEffect(() => {
    ;(window as unknown as { __renderPark: typeof renderOffline }).__renderPark = renderOffline
  }, [])
  return (
    <div className="grid min-h-full content-start gap-6 p-8" style={{ background: SKY_BG }}>
      <div className="font-party text-6xl text-[#1E1838]">Party Park soundtrack</div>
      <Sticker className="grid gap-4 p-6">
        <div className="font-party text-3xl">Tracks</div>
        <div className="flex flex-wrap gap-4">
          {TRACK_IDS.map((id) => (
            <PartyButton key={id} tone={track === id ? 'coral' : 'white'} onClick={() => { setTrack(id); music.play(id) }}>{id}</PartyButton>
          ))}
          <PartyButton tone="blue" onClick={() => { setTrack(null); music.play(null) }}>Stop</PartyButton>
        </div>
      </Sticker>
      <Sticker className="grid gap-4 p-6">
        <div className="font-party text-3xl">Stingers</div>
        <div className="flex flex-wrap gap-4">
          {STINGER_IDS.map((id) => <PartyButton key={id} tone="sun" onClick={() => music.stinger(id)}>{id}</PartyButton>)}
        </div>
      </Sticker>
    </div>
  )
}
