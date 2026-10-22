import { revalidateTag } from "next/cache";
import { refreshPrices } from "@/server/prices";
import { HttpError, getSession, handler, isAdmin } from "@/server/session";

// Daily price refresh (Vercel Cron sends Authorization: Bearer $CRON_SECRET); admins can run it too.
export const maxDuration = 300;

export const GET = handler(async (req) => {
  const cron = !!process.env.CRON_SECRET && req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
  if (!cron && !isAdmin(await getSession())) throw new HttpError(401, "Unauthorized");
  const result = await refreshPrices();
  revalidateTag("prices", "max");
  return result;
});
