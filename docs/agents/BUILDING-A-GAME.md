# Building a game for Game Night

You are building ONE game for a party platform that Dixon (Dixxx), John (Johnnyboy, 17) and Tori (Torii, 22) play together: the TV (any browser) is the console, phones are controllers, or everyone plays apart and every phone shows the whole thing. Read `CLAUDE.md` at the repo root first, then `src/engine/types.ts` (the contract), then the reference game `src/games/sketch/` end to end. Copy its shape.

## What you may touch
- Your folder `src/games/<id>/` (any files), your QA driver `scripts/drivers/<id>.mjs`, and exactly two lines in `src/games/registry.ts` (your import + adding your game to `GAMES`).
- Nothing else. If you believe the platform needs a change (engine, net, pages, shared UI, styles), do NOT make it. Work around it inside your folder and list the change you wanted in your final report.
- Never run `npm install`. Everything you need is installed (React 19, Tailwind v4, lucide-react, matter-js, qrcode, vitest, playwright). Ask in your report if something is missing.

## Shape of a game folder
- `logic.ts`: pure functions `setup / reduce / tick / outcome` and the state type. No React, no DOM, no Math.random / Date.now (use `ctx.random`, `ctx.now`). State is plain JSON. Never mutate the input state; return a new object (return the SAME object when nothing changed, so the host doesn't rebroadcast).
- `logic.test.ts`: vitest. Play at least one full game through `reduce`/`tick` to an `outcome`, plus every rule that is easy to get wrong. Reject bad input (wrong player, wrong phase, junk payloads) by returning the same state.
- `Stage.tsx`: the TV view (1280x720 target, readable from a couch: big type, high contrast). Also renders `compact` (apart mode, on a phone above the Controller): keep it small, essential only.
- `Controller.tsx`: the phone (390x844). One clear action at a time, thumb-sized targets (min 44px), no hover-only affordances. Handle: not in this game (joined late), waiting for others, your turn, game over.
- `index.ts`: the `GameDef` export (id, name, tagline, `instead` line, min/max players, modes, minutes, options).
- Any data (word lists, prompt packs, question banks) as `.ts` files in your folder.

## Design rules
- Three players is the design center. Make it great at 3, fine at 2 to 6 where it can be.
- Timers: put an absolute `endsAt` (host clock) in state; render countdowns with the `now()` prop and `<Countdown>` from `src/ui/Countdown.tsx`. Advance phases in `tick` when `ctx.now >= endsAt`, and also advance early when everyone has acted.
- Look: use the tokens and UI kit already there (`src/index.css`, `src/ui/kit.tsx`: Btn, Avatar, PlayerChip, Label, Panel). Dark ground (`bg-paper`), tiles (`bg-tile`), ink text (`text-ink`, `text-ink-2`, `text-ink-3`), one accent (`hot`), player colors from `room.players[i].color`. `font-display` (Bungee) for big display words and numbers only; never for paragraphs. No emojis anywhere. No gradients or glows for decoration. Motion: one thing moves at a time (`animate-pop`, `animate-rise` exist).
- Copy: short, plain, a little funny in the tag, never corporate. No em dashes.
- John is 17: content stays PG-13 (crude and silly is fine; nothing sexual, no slurs, nothing about drugs).
- Streams (`useSendStream` / `useStream` from `src/engine/context.tsx`) are for high-rate data you don't need to keep (live strokes, a physics jar snapshot). Max ~12 messages/sec per phone. Anything the game needs to remember goes through `send(type, payload)` into state.
- Content (prompts, questions, words): in `setup`, order your pool with `freshFirst(pool, idOf, ctx.used, ctx.random)` from `src/lib/shuffle.ts` so the group doesn't see repeats across nights, and return the ids you used in `outcome().used`.
- `outcome()` returns placements for every player in the game (ties share a place), a one-line `summary`, and up to 6 `highlights` for the Hall of Fame where it makes sense (best answer, wildest moment). Keep highlight content under ~40 KB.

## Bots (required)
Every game needs a `bot(state, botId, ctx)` policy on its GameDef so people can play solo and test alone (see the doc comment in `src/engine/types.ts` and the Sketch bot at the end of `src/games/sketch/logic.ts`). The host calls it about 5 times a second for each bot; return `{ type, payload }` to act as that bot's phone would, or null to wait. Rules: act at human speed (random chance per call, or wait on timestamps in state), never act when it isn't the bot's turn or the phase doesn't allow it, make the bot decent but beatable (use ctx.random), and keep it cheap (no heavy search every tick). Real-time games where the action happens on the phone (physics jars, racing, arenas) can simulate a simpler bot on the host side or in the host Stage; say what you did. Test it: a vitest that runs a full game with one human doing the minimum and two bots, driven only by `tick` + `bot`, must reach an outcome. QA: `--mode solo` (one phone hosting with two bots) must play a full game.

## Verify before you report
1. `npx tsc -b` clean, `npx vitest run` green (all tests, not just yours).
2. Start your own dev server on YOUR port only: `npx vite --port <your port> --strictPort` (run it in the background, kill it when done). Never use another port and never touch another lane's server.
3. Rendered QA with a driver: `node scripts/qa-room.mjs --base http://localhost:<port>/fam-game-night/ --game <id> --name "<Shelf name>" --driver scripts/drivers/<id>.mjs --out shots/<id>` and also once with `--mode apart`. The driver plays a full game the way people would (see `scripts/drivers/sketch.mjs`). Open the screenshots (TV and every phone) and fix what looks wrong: overflow, clipped text, tiny targets, unreadable TV text, anything that would confuse someone holding a phone at 11pm. Run it again after fixing. QA runs never save to the real season.
4. Commit in your worktree with explicit paths (never `git add -A`, never push, never touch other branches). End your commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Report back
What you built (rules as implemented, in plain words), what you verified (test count, QA runs, which screenshots you looked at), what you'd improve next, and any platform change you wanted but didn't make.
