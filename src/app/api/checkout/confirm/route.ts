import { handler, requireUser } from "@/server/session";
import { confirmPayment } from "@/server/store";

export const POST = handler(async (req) => {
  const address = await requireUser();
  const { checkoutId, txHash } = (await req.json()) as { checkoutId: string; txHash: `0x${string}` };
  return { results: [await confirmPayment(address, checkoutId, txHash)] };
});
