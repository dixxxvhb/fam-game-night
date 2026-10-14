import { useEffect, useState } from 'react'
import { sfx } from '../../../ui/sfx'
import {
  KART_STINGER_IDS, KART_THEME_IDS, KART_TRACK_IDS, STINGER_IDS, TRACK_IDS,
  kartMusic, music, renderOffline, trackInfo, type KartThemeId, type TrackId,
} from './music'
import { PartyButton, SKY_BG, Sticker } from './ui'

const THEME_NAMES: Record<KartThemeId, string> = {
  oval: 'Gate Loop', eight: 'Flyover', swamp: 'Gator Swamp', night: 'I-4 at Night',
  pier: 'Pier Pressure', coaster: 'Coaster Hill', keys: 'Seven Mile Bridge', launch: 'Launch Pad',
}

/** Dev page for the Party Park + Turnpike soundtrack (#/park-music): play each track and stinger. */
export default function MusicBox() {
  const [track, setTrack] = useState<string | null>(null)
  const [finalLap, setFinalLap] = useState(false)
  useEffect(() => { sfx.enable(true); return () => { music.play(null) } }, [])
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>
    w.__renderPark = renderOffline
    w.__trackInfo = trackInfo
    w.__kartIds = { tracks: KART_TRACK_IDS, stingers: KART_STINGER_IDS, themes: KART_THEME_IDS }
  }, [])
  const playKart = (t: string, fl: boolean) => { setTrack(`tp-${t}`); kartMusic.play(t as KartThemeId, { finalLap: fl }) }
  return (
    <div className="grid min-h-full content-start gap-6 p-8" style={{ background: SKY_BG }}>
      <div className="font-party text-6xl text-[#1E1838]">Party Park soundtrack</div>
      <Sticker className="grid gap-4 p-6">
        <div className="font-party text-3xl">Tracks</div>
        <div className="flex flex-wrap gap-4">
          {TRACK_IDS.map((id) => (
            <PartyButton key={id} tone={track === id ? 'coral' : 'white'} onClick={() => { setTrack(id); music.play(id as TrackId) }}>{id}</PartyButton>
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
      <div className="font-party text-6xl text-[#1E1838]">Turnpike soundtrack</div>
      <Sticker className="grid gap-4 p-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="font-party text-3xl">Race themes</div>
          <PartyButton
            tone={finalLap ? 'coral' : 'white'}
            data-final-lap={finalLap ? '1' : '0'}
            onClick={() => {
              const next = !finalLap
              setFinalLap(next)
              const th = track?.replace(/^tp-/, '')
              if (th && th in THEME_NAMES) kartMusic.play(th as KartThemeId, { finalLap: next })
            }}
          >
            Final lap: {finalLap ? 'on' : 'off'}
          </PartyButton>
        </div>
        <div className="flex flex-wrap gap-4">
          {KART_THEME_IDS.map((id) => (
            <PartyButton key={id} tone={track === `tp-${id}` ? 'coral' : 'white'} onClick={() => playKart(id, finalLap)}>
              {THEME_NAMES[id]} <span className="opacity-60">tp-{id} {trackInfo(`tp-${id}`).bpm}{finalLap ? `>${trackInfo(`tp-${id}-final`).bpm}` : ''}</span>
            </PartyButton>
          ))}
        </div>
        <div className="font-party text-3xl">Screens</div>
        <div className="flex flex-wrap gap-4">
          {(['title', 'results', 'podium'] as const).map((id) => (
            <PartyButton key={id} tone={track === `tp-${id}` ? 'coral' : 'white'} onClick={() => { setTrack(`tp-${id}`); kartMusic.play(id) }}>tp-{id}</PartyButton>
          ))}
          <PartyButton tone="blue" onClick={() => { setTrack(null); kartMusic.play(null) }}>Stop</PartyButton>
        </div>
      </Sticker>
      <Sticker className="grid gap-4 p-6">
        <div className="font-party text-3xl">Turnpike stingers</div>
        <div className="flex flex-wrap gap-4">
          {KART_STINGER_IDS.map((id) => <PartyButton key={id} tone="sun" onClick={() => kartMusic.stinger(id)}>{id}</PartyButton>)}
        </div>
      </Sticker>
    </div>
  )
}
