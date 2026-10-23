# PokéCast

Rip real Pokémon TCG booster packs with USDT on BNB Chain. See the odds before you open, then ship your cards home, sell them back instantly or trade them on the PokéMart. Trainer levels give cashback; missions give free packs.

## Run locally

```bash
npm install
cp .env.example .env.local      # fill SESSION_SECRET, ADMIN_ADDRESSES, NEXT_PUBLIC_TREASURY_ADDRESS (or use the local chain below)
npm run dev
```

Without `DATABASE_URL` the app uses an embedded Postgres (PGlite) in `.data/`.

### Full flow on a local chain

```bash
cd contracts && npm install && npx hardhat node                          # terminal 1
cd contracts && npx hardhat run scripts/deploy-local.ts --network localhost  # deploys MockUSDT, writes .env.local
npm run dev                                                              # restart after the deploy
node scripts/e2e-local.mjs                                               # 33 end-to-end checks
```

## How payments work

Every payment (packs, PokéMart purchases, shipping) is a plain USDT transfer from the buyer's wallet to the treasury wallet. The server checks the transfer on BNB Chain (sender, treasury, amount, mined after the checkout, one transaction per checkout) before it opens packs or moves cards. Money going out — buybacks, cashback, PokéMart seller payouts (price minus the 2.5% fee) and refunds — is a payout queue the admin pays from `/admin`.

## Go live on Vercel (BNB Chain mainnet)

1. **Database** — Vercel → Storage → create a Neon Postgres and connect it (adds `DATABASE_URL`). Tables are created on first request.
2. **Variables** — `NEXT_PUBLIC_TREASURY_ADDRESS` (wallet that receives every payment), `SESSION_SECRET` (32+ random chars), `ADMIN_ADDRESSES` (your wallet), `CRON_SECRET`, `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`, ideally a private `NEXT_PUBLIC_BSC_RPC_URL`, plus the optional `NEXT_PUBLIC_X_URL` (X button) and `NEXT_PUBLIC_CA` ("CA:" chip). `NEXT_PUBLIC_*` values are baked in at build time: redeploy after changing them.
3. **Prices** — `/admin` → *Refresh prices now* (then daily via Vercel Cron).
4. **Operate** — pay buybacks, cashback, seller payouts and refunds, and ship orders from `/admin`.

Test first on BSC testnet: `NEXT_PUBLIC_CHAIN=bscTestnet`, deploy *test USDT* from `/admin` and set `NEXT_PUBLIC_USDT_ADDRESS`.

Not affiliated with Nintendo, The Pokémon Company, Creatures or GAME FREAK.
