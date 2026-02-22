# FAM GAME NIGHT

## Stack
React 19, TypeScript, Vite, Tailwind v4, Supabase, React Router (HashRouter), GitHub Pages

## Source
`~/Documents/Claude Projects/Code/fam-game-night/`

## Deployment
- **Host:** GitHub Pages via GitHub Actions
- **URL:** https://dixxxvhb.github.io/fam-game-night/
- **Trigger:** Push to `main` branch
- **Vite base path:** `/fam-game-night/` (required for GitHub Pages subdirectory)
- **Router:** HashRouter (avoids 404 on SPA refresh with GitHub Pages)

## Environment
- Supabase env vars must be set as GitHub Secrets: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Local `.env` has public keys for dev

## Deploy Checklist
1. `npm run build` — must pass clean (tsc + vite)
2. `git add [changed files]`
3. `git commit -m "descriptive message"`
4. `git push origin main`
5. Verify: `gh run list --limit 1` — should show success within ~1 min

## Gotchas
- Tailwind **v4** (not v3) — uses `@import` syntax
- `base: '/fam-game-night/'` in vite.config.ts is required for GitHub Pages
- Service worker registers at relative path `sw.js`
- No tests — rely on `npm run build` for verification
- Run `npm run build` after each major feature, not just before deploy
