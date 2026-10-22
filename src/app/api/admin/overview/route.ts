import { CHAIN_KEY, PAYMENTS_ADDRESS, USDT_ADDRESS } from "@/lib/chain/config";
import { signerAddress } from "@/server/chain";
import { handler, requireAdmin } from "@/server/session";
import { adminOverview } from "@/server/store";

export const GET = handler(async () => {
  await requireAdmin();
  return {
    ...(await adminOverview()),
    config: {
      chain: CHAIN_KEY,
      usdt: USDT_ADDRESS || null,
      payments: PAYMENTS_ADDRESS || null,
      signer: signerAddress(),
      treasury: process.env.NEXT_PUBLIC_TREASURY_ADDRESS || null,
      database: process.env.DATABASE_URL ? "neon" : "pglite (local)",
    },
  };
});
