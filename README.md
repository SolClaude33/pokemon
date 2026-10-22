# PokéCast

Rip real Pokémon TCG booster packs with USDT on BNB Chain. See the odds before you open, then ship your cards home, sell them back instantly or trade them on the PokéMart. Trainer levels give cashback; missions give free packs.

## Run locally

```bash
npm install
cp .env.example .env.local      # fill SESSION_SECRET, SIGNER_PRIVATE_KEY, ADMIN_ADDRESSES (or use the local chain below)
npm run dev
```

Without `DATABASE_URL` the app uses an embedded Postgres (PGlite) in `.data/`.

### Full flow on a local chain

```bash
cd contracts && npm install && npx hardhat node                          # terminal 1
cd contracts && npx hardhat run scripts/deploy-local.ts --network localhost  # deploys MockUSDT + payments, writes .env.local
npm run dev                                                              # restart after the deploy
node scripts/e2e-local.mjs                                               # 24 end-to-end checks
```

## Go live on Vercel (BNB Chain mainnet)

1. **Database** — Vercel → Storage → create a Neon Postgres and connect it (adds `DATABASE_URL`). Tables are created on first request.
2. **Secrets** — set `SESSION_SECRET` (32+ random chars), `SIGNER_PRIVATE_KEY` (a fresh key that only signs checkouts; it holds no funds), `ADMIN_ADDRESSES` (your wallet), `CRON_SECRET`, `NEXT_PUBLIC_TREASURY_ADDRESS`, `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`, and ideally a private `NEXT_PUBLIC_BSC_RPC_URL`.
3. **Contract** — deploy, open `/admin` with your admin wallet (holding a little BNB) and press *Deploy payments contract*. Copy the address into `NEXT_PUBLIC_PAYMENTS_ADDRESS` and redeploy. Your wallet is the contract owner (it can pause, change treasury or rotate the signer).
4. **Prices** — `/admin` → *Refresh prices now* (then daily via Vercel Cron).
5. **Operate** — pay buybacks/cashback and ship orders from `/admin`.

Test first on BSC testnet: `NEXT_PUBLIC_CHAIN=bscTestnet`, deploy *test USDT* from `/admin`, then the payments contract.

Not affiliated with Nintendo, The Pokémon Company, Creatures or GAME FREAK.
