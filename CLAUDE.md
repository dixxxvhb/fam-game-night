# Game Night

Last verified: 2026-10-14

Dixon, Johnnyboy (John) and Torii's game night. The TV (or any browser) is the console, phones are the controllers, and it also plays fully apart (every phone shows the whole game). It keeps score across every game, every night, all season. Concept page: https://claude.ai/artifact/S47w2hDXWUNg1jadJkZmRD

**Never put Malik anywhere in this app** (names, seeds, copy, history). Season 1 starts at zero; the 2024-26 history stays in `scripts/historical-data.json` only. Personal project: no DWD branding.

## Stack
React 19 + TS + Vite 7 + Tailwind v4 + react-router (HashRouter) on GitHub Pages (`base: '/fam-game-night/'`). Realtime + saving via Supabase, **inside figgg's project** (`swjqlfcqvcrnydpyjyog`) in its own `gamenight` schema, reached only through `public.gn_*` security-definer functions (`supabase/gamenight.sql`). Never add game-night tables to figgg's `public` schema (figgg's export/wipe enumerates it).

## Commands
- `npm run dev` (launch.json name `fam-game-night`, port 5179) · `npm run build` (tsc + vite) · `npm test` (vitest)
- Rendered QA, whole room (1 TV + 3 phones, headless, never saves to the real season):
  `node scripts/qa-room.mjs --base http://localhost:5179/fam-game-night/ --game <id> --name "<Shelf name>" [--mode apart] [--driver scripts/drivers/<id>.mjs] [--out shots/<id>]`
  Screens land in `shots/` (gitignored). Read them before calling UI done.
- Testing in tabs by hand: open `#/host/ABCD`, then `#/join/ABCD?as=johnnyboy` (and `dixxx`, `torii`) in other tabs.

## Architecture (read before touching anything)
- `src/engine/types.ts`: **the game contract** (GameDef: setup/reduce/tick/outcome + Stage + Controller). One HOST device runs all logic; everyone else renders the broadcast state and sends actions.
- `src/engine/host.ts`: HostEngine (room phases lobby → playing → results → summary, points, saving). `src/engine/useRoom.ts`: the hook every page uses. `src/net/link.ts`: one Supabase Realtime channel per room (`gn:<CODE>`: state / act / hello / stream + presence).
- `src/engine/context.tsx`: `useStream` / `useSendStream` for high-rate live data (Sketch strokes), `useTicker` for countdowns.
- `src/engine/points.ts`: points scale (3 players: 10/7/4), `placeByScore`, standings.
- `src/games/<id>/`: one folder per game (logic.ts pure + tests, Stage.tsx, Controller.tsx, index.ts). Register in `src/games/registry.ts`.
- `src/pages/`: Home, Host (TV), Join/Apart, Play (phone), Season/NightDetail, Hall. `src/room/shared.tsx`: shelf, podium, standings, who-are-you.
- `src/data/api.ts`: saving queue (localStorage, retried, idempotent). `localStorage.gn-nosave=1` turns saving off (QA sets it).

## Game rules of the road
- Logic is pure and deterministic: use `ctx.random` / `ctx.now`, never Math.random / Date.now in setup/reduce/tick/outcome. State is plain JSON. Never mutate input state.
- Clocks: store absolute `endsAt` (host time) in state; render with the `now()` prop.
- Every player's private info lives in the same state; Controllers render only their own part (trust-based).
- Three players is the design center: voting games need a fix for three (the House, vote on everything but your own).
- Phone controls: big, few, thumb-sized (min 44px), no hover, no tiny text. TV: readable from a couch (big type).
- Look: dark riso world. Tokens in `src/index.css` (`bg-paper`, `bg-tile`, `text-ink/-2/-3`, `border-line`, `hot` accent, player colors). Bungee (`font-display`) for display only, Atkinson body, Plex Mono for codes/labels. UI kit in `src/ui/kit.tsx`. No emojis anywhere.

## Deploy
Push to `main` → GitHub Actions → Pages (secrets `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` = figgg's URL + publishable key). Verify with `gh run list --limit 1`.
