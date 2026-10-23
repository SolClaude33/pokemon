<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Repository Guidelines

PokéCast (folder still named `holovision`; repo SolClaude33/pokemon): real-money Pokémon TCG pack opening on BNB Chain. Users pay in USDT (BEP-20), rip packs drawn provably fair on the server, keep cards in a vault, sell them back, trade them on the PokéMart, ship them home, level up for cashback and complete missions. UI copy is English.

## Structure
- `contracts/` — Hardhat 2 project with only `MockUSDT` (local chain/testnet): `scripts/deploy-local.ts`, `scripts/export-abi.mjs` (writes `src/lib/chain/artifacts.ts`). There is no payments contract.
- `src/server/` (server-only) — `db.ts` (Neon via `DATABASE_URL`, else PGlite in `.data/`; schema created on boot), `session.ts` (SIWE + JWT cookie, admins via `ADMIN_ADDRESSES`), `chain.ts` (verifies USDT transfers to the treasury and admin payouts, scans recent treasury transfers), `fair.ts` (HMAC seeds), `prices.ts` (TCGplayer prices in Postgres, daily refresh, pack = sealed market + 5%), `store.ts` (all business logic).
- `src/app/api/*` — thin route handlers over `store.ts`; `cron/prices` + `cron/sync` run from `vercel.json`.
- `src/app` pages: `/` carousel, `/packs/[id]`, `/dex`, `/market`, `/missions`, `/vault`, `/profile`, `/admin`, `/how-it-works`.
- `src/lib/` — shared config: `packs.ts` (lineup, pull rates, fees), `levels.ts`, `missions.ts`, `odds.ts`, `chain/config.ts` (treasury from `NEXT_PUBLIC_TREASURY_ADDRESS`), `pay.ts` (client checkout: USDT transfer → confirm, pending confirmations retried from localStorage), `site.ts` (`NEXT_PUBLIC_X_URL`, `NEXT_PUBLIC_CA` shown in the HUD by `SiteLinks.tsx`).
- Card data: `src/data/sets/*.json` from `scripts/build-catalog.mjs`; images in `public/assets/`.

## Commands
- App: `npm run dev` (preview "holovision", port 3311), `npm run build`, `npm run lint`, `npx tsc --noEmit`.
- Mock token: after changes `cd contracts && npx hardhat compile && node scripts/export-abi.mjs`.
- Local chain: `cd contracts && npx hardhat node`, then `npx hardhat run scripts/deploy-local.ts --network localhost` (writes addresses to `.env.local`), restart dev, `node scripts/e2e-local.mjs` (33 end-to-end checks).
- Catalog: `node scripts/build-catalog.mjs [--skip-images]`.

## Design tokens (keep)
Direction: late-night CRT channel ripping Pokémon packs, seen through Game Boy-era eyes (ref. arcmarumo.com). Phosphor HUD on blue-black glass; Pokémon yellow/blue/red as brand accents; holo foil for rarity light. Avoid purple SaaS gradients, generic rounded app cards, emoji.
- Colors in `globals.css :root`: `--screen #0b0d11`, `--phosphor #ece6d6`, `--dim`, `--faint`, `--line`, `--poke-yellow #ffcb05`, `--poke-blue #2a75bb`, `--poke-blue-deep #1b3f78`, `--poke-red/--signal #ee1515`, `--ok`, `--warn`, `--gb-paper`, `--holo`, rarity `--r-*`.
- Type: Lilita One (display; `.poke-title` = yellow fill + blue outline), Fragment Mono (body/HUD, `.hud` uppercase 11px), Press Start 2P (`.pixel` labels, `.gb-dialog` Game Boy text boxes).
- Buttons: `.btn-primary` Pokémon yellow with a 3px bottom bevel. Radii: screen 34px, UI 2–4px; motion `--ease-out` cubic-bezier(.16,1,.3,1), 160/420/900ms; honor reduced motion.
- Audio: background music is `public/assets/audio/bgm.mp3` (Nicol's track, loudness-normalized to ~-20 LUFS with ffmpeg; original in `assets-src/audio/`), looped gap-free via Web Audio and ducked during pack openings. `sfx.*` in `src/lib/audio.ts` are synthesized Game Boy-style effects (menu blips, Poké Ball wobble, catch click, shiny sparkle, item-get jingles by rarity). Starts on first user gesture; HUD toggles persist in localStorage `pc:audio`.
- 3D: React Three Fiber, `flat` (no tone mapping) so printed art keeps its colors; lights from drei Lightformers (no HDR downloads).

## Conventions & limits
- Money paths: prices come from `livePriceBook()` (uncached). Buyers send a USDT `transfer` to the treasury; `confirmPayment` checks sender, recipient, amount and block time, and `checkouts.tx_hash` is unique so one tx pays one checkout. Paying late for a sold listing or a closed shipment queues a refund. Outgoing USDT (buybacks, cashback, PokéMart seller payouts net of fee, refunds) is a payout queue paid by an admin wallet from `/admin`; the server verifies the transfer.
- Never put private keys in the repo; `.env.local` holds local-only test values. `NEXT_PUBLIC_*` vars are inlined at build time (redeploy after changing them).
- Pull rates are community estimates; fees, buyback rates, levels and mission rewards in `src/lib/{packs,levels,missions}.ts` are business settings.
- Card/pack art is Nintendo/TPC IP and "Poké" branding is theirs; real-money random packs may be regulated as gambling — owner's legal call.
- `@coinbase/cdp-sdk` is aliased to a stub in `next.config.ts` (unused Base connector dependency); PGlite is a server external.
