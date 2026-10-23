import { recentTreasuryTransfers } from "@/server/chain";
import { HttpError, getSession, handler, isAdmin } from "@/server/session";
import { reconcile } from "@/server/store";

// Fulfils payments whose browser closed before confirming (matches recent USDT transfers to the treasury).
export const maxDuration = 120;

export const GET = handler(async (req) => {
  const cron = !!process.env.CRON_SECRET && req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
  if (!cron && !isAdmin(await getSession())) throw new HttpError(401, "Unauthorized");
  return reconcile(await recentTreasuryTransfers());
});
