import { handler, requireUser } from "@/server/session";
import { checkoutPacks } from "@/server/store";

export const POST = handler(async (req) => {
  const address = await requireUser();
  const { setId, quantity } = (await req.json()) as { setId: string; quantity: number };
  return checkoutPacks(address, setId, Number(quantity));
});
