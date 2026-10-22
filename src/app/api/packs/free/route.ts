import { handler, requireUser } from "@/server/session";
import { openVoucher } from "@/server/store";

export const POST = handler(async (req) => {
  const address = await requireUser();
  const { voucherId } = (await req.json()) as { voucherId: number };
  return openVoucher(address, Number(voucherId));
});
