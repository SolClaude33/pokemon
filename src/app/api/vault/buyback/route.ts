import { handler, requireUser } from "@/server/session";
import { requestBuyback } from "@/server/store";

export const POST = handler(async (req) => {
  const address = await requireUser();
  const { itemIds } = (await req.json()) as { itemIds: string[] };
  return requestBuyback(address, itemIds ?? []);
});
