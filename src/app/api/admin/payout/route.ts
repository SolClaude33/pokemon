import { getAddress, type Hash } from "viem";
import { verifyUsdtTransfer } from "@/server/chain";
import { one } from "@/server/db";
import { HttpError, handler, requireAdmin } from "@/server/session";
import { markPayout } from "@/server/store";

// Marks a payout as paid (after checking the USDT transfer on-chain) or rejected.
export const POST = handler(async (req) => {
  await requireAdmin();
  const { id, status, txHash, note } = (await req.json()) as { id: number; status: "paid" | "rejected"; txHash?: Hash; note?: string };
  if (status === "paid") {
    if (!txHash) throw new HttpError(400, "Paste the USDT transfer transaction hash");
    const p = await one<{ address: string; amount: string }>("select address, amount from payouts where id = $1", [id]);
    if (!p) throw new HttpError(404, "Payout not found");
    await verifyUsdtTransfer(txHash, getAddress(p.address), Number(p.amount));
  }
  return markPayout(Number(id), status, txHash, note);
});
