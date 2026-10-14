/**
 * Turnpike's soundtrack. It lives on Party Park's synth engine (one AudioContext for the app,
 * one music switch, `gn-music-off`); this module is the Kart-side door to it.
 *
 *   useKartMusic(track, { finalLap })   track = a TrackId race theme, 'title', 'results', 'podium', or null
 *   kartMusic.stinger(id)               'tp-countdown' (start it when the countdown stage starts:
 *                                       beeps at 1.5 / 2.5 / 3.5 s, GO at 4.5 s = COUNTDOWN_MS),
 *                                       'tp-lap', 'tp-finalLap', 'tp-finish', 'tp-win', 'tp-lose',
 *                                       'tp-itemGet', 'tp-itemHit', 'tp-boost', 'tp-coin',
 *                                       'tp-rocket', 'tp-storm', 'tp-hurricane'
 *
 * Small frequent stingers (coin, boost, item get/hit) are rate-limited and barely duck the music.
 */
import type { TrackId } from './contract'
import type { KartThemeId } from '../board/park/music'

export { useKartMusic, kartMusic, kartMusicId, KART_THEME_IDS, KART_TRACK_IDS, KART_STINGER_IDS } from '../board/park/music'
export type { KartTrack, KartMusicId, KartStingerId, KartThemeId } from '../board/park/music'

// The engine's theme ids must stay the contract's track ids, both ways.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never
export const THEMES_MATCH_TRACKS: Same<TrackId, KartThemeId> = true
