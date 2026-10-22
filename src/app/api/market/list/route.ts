import { handler, requireUser } from "@/server/session";
import { listItem } from "@/server/store";

export const POST = handler(async (req) => {
  const address = await requireUser();
  const { itemId, price } = (await req.json()) as { itemId: string; price: number };
  return listItem(address, itemId, Number(price));
});
