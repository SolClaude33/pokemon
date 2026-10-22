import { HttpError, handler, requireAdmin } from "@/server/session";
import { markShipped } from "@/server/store";

export const POST = handler(async (req) => {
  await requireAdmin();
  const { id, tracking } = (await req.json()) as { id: string; tracking: string };
  if (!tracking?.trim()) throw new HttpError(400, "Add a tracking number");
  await markShipped(id, tracking.trim());
  return { ok: true };
});
