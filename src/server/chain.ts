import "server-only";
import {
  createPublicClient,
  decodeEventLog,
  erc20Abi,
  formatUnits,
  getAddress,
  http,
  parseUnits,
  stringToHex,
  hexToString,
  type Address,
  type Hash,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { paymentsAbi } from "@/lib/chain/artifacts";
import { PAYMENTS_ADDRESS, RPC_URL, USDT_ADDRESS, USDT_DECIMALS, chain } from "@/lib/chain/config";
import { HttpError } from "./session";

export const publicClient = createPublicClient({ chain, transport: http(process.env.BSC_RPC_URL_SERVER || RPC_URL) });

export const toUnits = (usdt: number) => parseUnits(usdt.toFixed(6), USDT_DECIMALS);
export const fromUnits = (v: bigint) => Number(formatUnits(v, USDT_DECIMALS));

/** short strings (set ids, listing ids) packed into the contract's bytes32 `ref` */
export const toRef = (s: string) => stringToHex(s, { size: 32 });
export const fromRef = (h: Hex) => hexToString(h, { size: 32 });

export const newPaymentId = (): Hex => `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex")}`;

function signer() {
  const key = process.env.SIGNER_PRIVATE_KEY as Hex | undefined;
  if (!key) throw new HttpError(503, "Payments are not configured yet (SIGNER_PRIVATE_KEY)");
  return privateKeyToAccount(key);
}

export const signerAddress = () => {
  try {
    return signer().address;
  } catch {
    return null;
  }
};

export function assertPaymentsReady() {
  if (!PAYMENTS_ADDRESS || !USDT_ADDRESS) throw new HttpError(503, "Payments contract is not deployed yet");
}

export type Payment = {
  id: Hex;
  payer: Address;
  kind: number;
  ref: Hex;
  quantity: number;
  amount: bigint;
  payee: Address;
  fee: bigint;
  deadline: bigint;
};

const PAYMENT_TYPES = {
  Payment: [
    { name: "id", type: "bytes32" },
    { name: "payer", type: "address" },
    { name: "kind", type: "uint8" },
    { name: "ref", type: "bytes32" },
    { name: "quantity", type: "uint32" },
    { name: "amount", type: "uint256" },
    { name: "payee", type: "address" },
    { name: "fee", type: "uint256" },
    { name: "deadline", type: "uint64" },
  ],
} as const;

/** EIP-712 signature the PokeCastPayments contract accepts for this checkout. */
export async function signPayment(p: Payment) {
  assertPaymentsReady();
  return signer().signTypedData({
    domain: { name: "PokeCast", version: "1", chainId: chain.id, verifyingContract: PAYMENTS_ADDRESS },
    types: PAYMENT_TYPES,
    primaryType: "Payment",
    message: p,
  });
}

/** JSON-safe form of a payment for the browser (bigints as strings). */
export const serializePayment = (p: Payment) => ({
  ...p,
  amount: p.amount.toString(),
  fee: p.fee.toString(),
  deadline: p.deadline.toString(),
});

export type PaidEvent = {
  id: Hex;
  payer: Address;
  kind: number;
  ref: Hex;
  quantity: number;
  amount: bigint;
  payee: Address;
  fee: bigint;
  txHash: Hash;
};

/** Reads the confirmed `Paid` events of a transaction (only from our contract). */
export async function paidEventsOf(txHash: Hash): Promise<PaidEvent[]> {
  assertPaymentsReady();
  const receipt = await publicClient.getTransactionReceipt({ hash: txHash }).catch(() => null);
  if (!receipt) throw new HttpError(404, "Transaction not found yet — try again in a few seconds");
  if (receipt.status !== "success") throw new HttpError(400, "That transaction failed on-chain");
  const out: PaidEvent[] = [];
  for (const log of receipt.logs) {
    if (getAddress(log.address) !== getAddress(PAYMENTS_ADDRESS)) continue;
    try {
      const ev = decodeEventLog({ abi: paymentsAbi, data: log.data, topics: log.topics });
      if (ev.eventName !== "Paid") continue;
      const a = ev.args as unknown as Omit<PaidEvent, "txHash">;
      out.push({ ...a, payer: getAddress(a.payer), payee: getAddress(a.payee), txHash });
    } catch {}
  }
  return out;
}

/** Recent `Paid` events, for the reconciliation cron. */
export async function recentPaidEvents(blocks = 5000n): Promise<PaidEvent[]> {
  assertPaymentsReady();
  const latest = await publicClient.getBlockNumber();
  const logs = await publicClient.getContractEvents({
    address: PAYMENTS_ADDRESS,
    abi: paymentsAbi,
    eventName: "Paid",
    fromBlock: latest > blocks ? latest - blocks : 0n,
    toBlock: latest,
  });
  return logs.map((l) => {
    const a = l.args as unknown as Omit<PaidEvent, "txHash">;
    return { ...a, payer: getAddress(a.payer), payee: getAddress(a.payee), txHash: l.transactionHash };
  });
}

/** Checks that an admin payout tx moved at least `amount` USDT to `to`. */
export async function verifyUsdtTransfer(txHash: Hash, to: Address, amount: number) {
  const receipt = await publicClient.getTransactionReceipt({ hash: txHash }).catch(() => null);
  if (!receipt || receipt.status !== "success") throw new HttpError(400, "Payout transaction not found or failed");
  let sent = 0n;
  for (const log of receipt.logs) {
    if (getAddress(log.address) !== getAddress(USDT_ADDRESS)) continue;
    try {
      const ev = decodeEventLog({ abi: erc20Abi, data: log.data, topics: log.topics });
      if (ev.eventName === "Transfer" && getAddress(ev.args.to) === getAddress(to)) sent += ev.args.value;
    } catch {}
  }
  if (sent < toUnits(amount)) throw new HttpError(400, `That transaction sent ${fromUnits(sent)} USDT, expected ${amount}`);
}
