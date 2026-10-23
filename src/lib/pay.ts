"use client";

import { useEffect, useState } from "react";
import { erc20Abi, getAddress, isAddress, zeroAddress, type Address, type Hex } from "viem";
import { useAccount, useConfig } from "wagmi";
import { waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { TREASURY_ADDRESS, USDT_ADDRESS, chain } from "./chain/config";
import { api } from "./session";

/** Checkout as returned by the PokéCast API: send exactly `amountWei` USDT to `to`. */
export type Checkout = { checkoutId: string; to: Address; amount: number; amountWei: string };

export type PayStep = "idle" | "checkout" | "pay" | "confirm" | "done" | "error";

export const STEP_LABEL: Record<PayStep, string> = {
  idle: "",
  checkout: "Preparing checkout…",
  pay: "Confirm the USDT transfer in your wallet…",
  confirm: "Waiting for BNB Chain…",
  done: "Payment confirmed",
  error: "",
};

/** Payments are live once the treasury wallet is configured. */
export const paymentsLive = !!USDT_ADDRESS && !!TREASURY_ADDRESS;

const friendly = (e: unknown) => {
  const m = e instanceof Error ? e.message : String(e);
  if (/User rejected|denied/i.test(m)) return "You cancelled the transaction in your wallet.";
  if (/insufficient funds/i.test(m)) return "Not enough BNB for gas.";
  if (/transfer amount exceeds balance|ERC20InsufficientBalance/i.test(m)) return "Not enough USDT in this wallet.";
  return m.split("\n")[0].slice(0, 180);
};

// Sent-but-unconfirmed payments survive a closed tab and are retried on the next visit.
const PENDING_KEY = "pc:pending-payments";
type Pending = { checkoutId: string; txHash: Hex; address: Address; at: number };

function readPending(): Pending[] {
  try {
    return JSON.parse(localStorage.getItem(PENDING_KEY) ?? "[]") as Pending[];
  } catch {
    return [];
  }
}
function writePending(list: Pending[]) {
  try {
    if (list.length) localStorage.setItem(PENDING_KEY, JSON.stringify(list));
    else localStorage.removeItem(PENDING_KEY);
  } catch {}
}
const dropPending = (checkoutId: string) => writePending(readPending().filter((p) => p.checkoutId !== checkoutId));

async function confirm<T>(checkoutId: string, txHash: Hex) {
  // the node behind the API can lag a block or two behind the wallet's
  for (let i = 0; ; i++) {
    try {
      const result = await api<T>("/api/checkout/confirm", { checkoutId, txHash });
      dropPending(checkoutId);
      return result;
    } catch (e) {
      if (i === 5) throw e;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

/** Retries confirmations left over from a closed tab, once the wallet is signed in. */
export function useResumePayments(signedIn: Address | null | undefined) {
  useEffect(() => {
    if (!signedIn) return;
    for (const p of readPending()) {
      if (getAddress(p.address) !== getAddress(signedIn)) continue;
      // fresh entries belong to a payment another tab may still be confirming
      if (Date.now() - (p.at ?? 0) < 2 * 60_000) continue;
      api("/api/checkout/confirm", { checkoutId: p.checkoutId, txHash: p.txHash })
        .then(() => dropPending(p.checkoutId))
        .catch((e: unknown) => {
          // keep it for later unless the server says it can never succeed
          if (/already used|another transaction|not found$|Invalid/i.test(e instanceof Error ? e.message : "")) dropPending(p.checkoutId);
        });
    }
  }, [signedIn]);
}

/**
 * Runs a checkout end to end: asks the API for a checkout, sends that exact USDT
 * amount to the treasury from the wallet and lets the server verify the transfer.
 * Returns the server's confirmation results.
 */
export function usePayment() {
  const config = useConfig();
  const { address } = useAccount();
  const [step, setStep] = useState<PayStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<Hex | null>(null);

  async function run<T>(checkout: () => Promise<Checkout>) {
    setError(null);
    setTxHash(null);
    try {
      if (!address) throw new Error("Connect your wallet first.");
      if (!paymentsLive) throw new Error("Payments aren't live yet.");
      setStep("checkout");
      const { checkoutId, to, amountWei } = await checkout();
      // never send funds anywhere but the configured treasury
      if (!isAddress(to) || to === zeroAddress || getAddress(to) !== getAddress(TREASURY_ADDRESS))
        throw new Error("Payment address mismatch — reload the page and try again.");
      const amount = BigInt(amountWei);
      if (amount <= 0n) throw new Error("Invalid amount.");

      setStep("pay");
      const hash = await writeContract(config, {
        address: USDT_ADDRESS,
        abi: erc20Abi,
        functionName: "transfer",
        args: [to, amount],
        chainId: chain.id,
      });
      writePending([...readPending(), { checkoutId, txHash: hash, address, at: Date.now() }]);
      setTxHash(hash);
      setStep("confirm");
      await waitForTransactionReceipt(config, { hash, chainId: chain.id });
      const result = await confirm<T>(checkoutId, hash);
      setStep("done");
      return result;
    } catch (e) {
      setStep("error");
      setError(friendly(e));
      throw e;
    }
  }

  return { run, step, error, txHash, busy: step !== "idle" && step !== "done" && step !== "error", reset: () => setStep("idle") };
}
