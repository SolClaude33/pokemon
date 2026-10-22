import { handler, requireUser } from "@/server/session";
import { checkoutShipment, type ShipTo } from "@/server/store";

export const POST = handler(async (req) => {
  const address = await requireUser();
  const { itemIds, to } = (await req.json()) as { itemIds: string[]; to: ShipTo };
  return checkoutShipment(address, itemIds ?? [], to);
});
