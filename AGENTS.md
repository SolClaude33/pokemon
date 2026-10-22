<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Repository Guidelines

PokéCast (folder/repo still named `holovision`): buy and rip real Pokémon TCG booster packs with USDC on BNB Chain, see the odds first, then sell cards back, trade them on the PokéMart or ship them home. UI copy is English.

## Structure
- `src/app` — routes: `/` channel carousel, `/packs/[id]` odds + buy + opening, `/dex` card catalog, `/market` PokéMart, `/vault`, `/how-it-works`. `layout.tsx` wraps everything in the CRT `TvShell`.
- `src/components` — `TvShell` (CRT frame + HUD), `PackArc` (carousel; CSS arc first paint/fallback, `three/ArcCanvas` when WebGL is ready), `PackHero` + `three/PackViewer` (draggable 3D pack), `three/Pack3D` + `packAssets` (pillow geometry, crimp alpha, generated pack back), `PackStation`/`PackOpening` (buy → tear → reveal → sell), `DexView`, `MarketView`, `CardModal`, `TcgCard`, `Logo` (CRT + Poké Ball mark, arched wordmark).
- `src/lib` — `packs.ts` (lineup, pull rates, buyback/shipping economics — placeholders to confirm), `odds.ts` (slot model, EV, demo draw), `vault.ts` (localStorage demo vault + PokéMart listings), `wallet.ts` (wagmi/RainbowKit on BSC, USDC `0x8AC7…580d`, 18 decimals).
- `src/data/sets/*.json` — generated card pools (rarity + TCGplayer market price).
- Assets: served from `public/assets/{cards,packs,sets}` (`/assets/...`); originals + API cache in `assets-src/` (gitignored).

## Commands
- `npm run dev` (preview config "holovision" uses port 3311), `npm run build`, `npm run lint`, `npx tsc --noEmit`.
- `node scripts/build-catalog.mjs [--skip-images]` — refreshes card data from pokemontcg.io (flaky: retries + caches pages), backfills missing prices from TCGplayer search, downloads pack art (TCGplayer CDN) and converts to webp with ffmpeg.

## Design tokens (keep)
Direction: late-night CRT channel ripping Pokémon packs, seen through Game Boy-era eyes (ref. arcmarumo.com). Phosphor HUD on blue-black glass; Pokémon yellow/blue/red as brand accents; holo foil for rarity light. Avoid purple SaaS gradients, generic rounded app cards, emoji.
- Colors in `globals.css :root`: `--screen #0b0d11`, `--phosphor #ece6d6`, `--dim`, `--faint`, `--line`, `--poke-yellow #ffcb05`, `--poke-blue #2a75bb`, `--poke-blue-deep #1b3f78`, `--poke-red/--signal #ee1515`, `--ok`, `--warn`, `--gb-paper`, `--holo`, rarity `--r-*`.
- Type: Lilita One (display; `.poke-title` = yellow fill + blue outline), Fragment Mono (body/HUD, `.hud` uppercase 11px), Press Start 2P (`.pixel` labels, `.gb-dialog` Game Boy text boxes).
- Buttons: `.btn-primary` Pokémon yellow with a 3px bottom bevel. Radii: screen 34px, UI 2–4px; motion `--ease-out` cubic-bezier(.16,1,.3,1), 160/420/900ms; honor reduced motion.
- Audio: background music is `public/assets/audio/bgm.mp3` (Nicol's track, loudness-normalized to ~-20 LUFS with ffmpeg; original in `assets-src/audio/`), looped gap-free via Web Audio and ducked during pack openings. `sfx.*` in `src/lib/audio.ts` are synthesized Game Boy-style effects (menu blips, Poké Ball wobble, catch click, shiny sparkle, item-get jingles by rarity). Starts on first user gesture; HUD toggles persist in localStorage `pc:audio`.
- 3D: React Three Fiber, `flat` (no tone mapping) so printed art keeps its colors; lights from drei Lightformers (no HDR downloads).

## Conventions & limits
- Purchases, draws, the vault and the PokéMart are DEMO (client-side localStorage, no USDC moves; seeded listings are examples). Card values = TCGplayer market price shown as USDC. Production needs a contract/escrow and server-side or VRF draws against real inventory.
- Pull rates are community estimates; card/pack art is Nintendo/TPC IP — keep sources cited on pack pages.
- Never commit `.env*`; optional `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`, `NEXT_PUBLIC_BSC_RPC_URL`.
- `@coinbase/cdp-sdk` is aliased to a stub in `next.config.ts` (unused Base connector dependency).
