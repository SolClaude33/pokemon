import "server-only";
import { createPublicClient, decodeEventLog, erc20Abi, formatUnits, getAddress, http, parseUnits, type Address, type Hash } from "viem";
import { RPC_URL, TREASURY_ADDRESS, USDT_ADDRESS, USDT_DECIMALS, chain } from "@/lib/chain/config";
import { HttpError } from "./session";

export const publicClient = createPublicClient({ chain, transport: http(process.env.BSC_RPC_URL_SERVER || RPC_URL) });

export const toUnits = (usdt: number) => parseUnits(usdt.toFixed(6), USDT_DECIMALS);
export const fromUnits = (v: bigint) => Number(formatUnits(v, USDT_DECIMALS));

/** The treasury every payment goes to; checkouts are refused until it is configured. */
export function treasury(): Address {
  if (!USDT_ADDRESS || !TREASURY_ADDRESS) throw new HttpError(503, "Payments aren't live yet (NEXT_PUBLIC_TREASURY_ADDRESS)");
  return TREASURY_ADDRESS;
}

/** Sums the USDT `Transfer` logs of a mined transaction going from → to. */
async function usdtSent(txHash: Hash, from: Address | null, to: Address) {
  const receipt = await publicClient.getTransactionReceipt({ hash: txHash }).catch(() => null);
  if (!receipt) throw new HttpError(404, "Transaction not found yet — try again in a few seconds");
  if (receipt.status !== "success") throw new HttpError(400, "That transaction failed on-chain");
  let sent = 0n;
  for (const log of receipt.logs) {
    if (getAddress(log.address) !== getAddress(USDT_ADDRESS)) continue;
    try {
      const ev = decodeEventLog({ abi: erc20Abi, data: log.data, topics: log.topics });
      if (ev.eventName !== "Transfer" || getAddress(ev.args.to) !== getAddress(to)) continue;
      if (from && getAddress(ev.args.from) !== getAddress(from)) continue;
      sent += ev.args.value;
    } catch {}
  }
  return { sent, blockNumber: receipt.blockNumber };
}

/**
 * Checks that `txHash` moved at least `amount` USDT from the payer to the treasury
 * in a block mined after the checkout was created (so old transfers can't be reused).
 */
export async function verifyPayment(txHash: Hash, payer: Address, amount: number, notBefore: Date) {
  const { sent, blockNumber } = await usdtSent(txHash, payer, treasury());
  if (sent < toUnits(amount))
    throw new HttpError(400, `That transaction sent ${fromUnits(sent)} USDT from your wallet to the treasury, expected ${amount}`);
  const block = await publicClient.getBlock({ blockNumber });
  // a few minutes of slack for clock drift between the database and the chain
  if (Number(block.timestamp) * 1000 < notBefore.getTime() - 5 * 60_000)
    throw new HttpError(400, "That transaction is older than this checkout");
}

export type TreasuryTransfer = { txHash: Hash; from: Address; value: bigint; minedAt: Date };

/**
 * USDT transfers into the treasury over the last `blocks` blocks, for the reconciliation
 * cron. Scanned in chunks because public BSC RPCs cap eth_getLogs ranges.
 */
export async function recentTreasuryTransfers(blocks = 20_000n, chunk = 2_000n): Promise<TreasuryTransfer[]> {
  const to = treasury();
  const latest = await publicClient.getBlockNumber();
  const out: TreasuryTransfer[] = [];
  for (let end = latest; end > latest - blocks && end > 0n; end -= chunk) {
    const start = end > chunk ? end - chunk + 1n : 0n;
    const logs = await publicClient
      .getContractEvents({ address: USDT_ADDRESS, abi: erc20Abi, eventName: "Transfer", args: { to }, fromBlock: start, toBlock: end })
      .catch((e) => {
        console.error("treasury scan failed", start, end, e instanceof Error ? e.message : e);
        return [];
      });
    for (const l of logs) {
      const block = await publicClient.getBlock({ blockNumber: l.blockNumber });
      out.push({ txHash: l.transactionHash, from: getAddress(l.args.from!), value: l.args.value!, minedAt: new Date(Number(block.timestamp) * 1000) });
    }
  }
  return out;
}

/** Checks that an admin payout tx moved at least `amount` USDT to `to`. */
export async function verifyUsdtTransfer(txHash: Hash, to: Address, amount: number) {
  const { sent } = await usdtSent(txHash, null, to).catch(() => {
    throw new HttpError(400, "Payout transaction not found or failed");
  });
  if (sent < toUnits(amount)) throw new HttpError(400, `That transaction sent ${fromUnits(sent)} USDT, expected ${amount}`);
}
