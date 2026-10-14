/**
 * Party Park music: synthesized loops and stingers (no audio files), played only where
 * the game is shown (sfx.audible()). One track at a time, crossfaded.
 *
 * API (stable; the Stage calls it):
 *   useParkMusic(track)   keep `track` playing while mounted (null = silence)
 *   music.stinger(id)     one-shot jingle over the track (the track ducks under it)
 *
 * Stub until the music engine lands.
 */
import { useEffect } from 'react'

export type TrackId = 'title' | 'board' | 'tense' | 'spin' | 'minigame' | 'results' | 'finale'
export type StingerId = 'turn' | 'star' | 'lastFive' | 'win' | 'lose' | 'go' | 'coins' | 'event'

export const music = {
  play(track: TrackId | null) { void track },
  stinger(id: StingerId) { void id },
}

export function useParkMusic(track: TrackId | null) {
  useEffect(() => { music.play(track) }, [track])
  useEffect(() => () => music.play(null), [])
}
