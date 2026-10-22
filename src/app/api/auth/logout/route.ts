import { endSession, handler } from "@/server/session";

export const POST = handler(async () => {
  await endSession();
  return { ok: true };
});
