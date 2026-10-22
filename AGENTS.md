<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Repository Guidelines

Holovision: buy and rip real Pokémon TCG booster packs with USDC on BNB Chain, see the odds first, then sell cards back or ship them home. UI copy is English.

## Structure
- `src/app` — routes: `/` channel carousel, `/packs/[id]` odds + buy + opening, `/vault`, `/how-it-works`. `layout.tsx` wraps everything in the CRT `TvShell`.
- `src/components` — `TvShell` (CRT frame + HUD), `PackArc` (arc carousel), `PackStation`/`PackOpening` (buy → tear → reveal → sell), `TcgCard`, `Logo` (SVG mark, no Pokémon marks).
- `src/lib` — `packs.ts` (lineup, pull rates, buyback/shipping economics — placeholders to confirm), `odds.ts` (slot model, EV, demo draw), `vault.ts` (localStorage demo vault), `wallet.ts` (wagmi/RainbowKit on BSC, USDC `0x8AC7…580d`, 18 decimals).
- `src/data/sets/*.json` — generated card pools (rarity + TCGplayer market price).
- Assets: served from `public/assets/{cards,packs,sets}` (`/assets/...`); originals + API cache in `assets-src/` (gitignored).

## Commands
- `npm run dev` (preview config "holovision" uses port 3311), `npm run build`, `npm run lint`, `npx tsc --noEmit`.
- `node scripts/build-catalog.mjs [--skip-images]` — refreshes card data from pokemontcg.io (flaky: retries + caches pages), backfills missing prices from TCGplayer search, downloads pack art (TCGplayer CDN) and converts to webp with ffmpeg.

## Design tokens (keep)
Direction: late-night CRT shopping channel (ref. arcmarumo.com). Phosphor type on blue-black glass; only saturated color is holo foil + rarity light. Avoid purple SaaS gradients, rounded app cards, emoji.
- Colors in `globals.css :root`: `--screen #0b0d11`, `--phosphor #ece6d6`, `--dim`, `--faint`, `--line`, `--signal #ff4433`, `--ok`, `--warn`, `--holo` gradient, rarity `--r-*`.
- Type: Bodoni Moda italic (display), Fragment Mono (body/HUD, `.hud` uppercase 11px), Silkscreen (`.pixel` labels).
- Radii: screen 34px, UI 2px; motion `--ease-out` cubic-bezier(.16,1,.3,1), 160/420/900ms; honor reduced motion.

## Conventions & limits
- Purchases, draws and the vault are DEMO (client-side, no USDC moves). Production needs a contract/escrow and server-side or VRF draws against real inventory.
- Pull rates are community estimates; card/pack art is Nintendo/TPC IP — keep sources cited on pack pages.
- Never commit `.env*`; optional `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`, `NEXT_PUBLIC_BSC_RPC_URL`.
- `@coinbase/cdp-sdk` is aliased to a stub in `next.config.ts` (unused Base connector dependency).
