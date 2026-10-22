import { handler, requireUser } from "@/server/session";
import { confirmTx } from "@/server/store";

export const POST = handler(async (req) => {
  const address = await requireUser();
  const { txHash } = (await req.json()) as { txHash: `0x${string}` };
  return { results: await confirmTx(address, txHash) };
});
