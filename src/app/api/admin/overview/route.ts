import { CHAIN_KEY, TREASURY_ADDRESS, USDT_ADDRESS } from "@/lib/chain/config";
import { handler, requireAdmin } from "@/server/session";
import { adminOverview } from "@/server/store";

export const GET = handler(async () => {
  await requireAdmin();
  return {
    ...(await adminOverview()),
    config: {
      chain: CHAIN_KEY,
      usdt: USDT_ADDRESS || null,
      treasury: TREASURY_ADDRESS || null,
      database: process.env.DATABASE_URL ? "neon" : "pglite (local)",
    },
  };
});
