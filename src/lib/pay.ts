"use client";

import { useState } from "react";
import { erc20Abi, type Address, type Hex } from "viem";
import { useAccount, useConfig } from "wagmi";
import { readContract, waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { paymentsAbi } from "./chain/artifacts";
import { PAYMENTS_ADDRESS, USDT_ADDRESS, chain } from "./chain/config";
import { api } from "./session";

/** Signed checkout as returned by the PokéCast API. */
export type SignedPayment = {
  payment: {
    id: Hex;
    payer: Address;
    kind: number;
    ref: Hex;
    quantity: number;
    amount: string;
    payee: Address;
    fee: string;
    deadline: string;
  };
  signature: Hex;
};

export type PayStep = "idle" | "checkout" | "approve" | "pay" | "confirm" | "done" | "error";

export const STEP_LABEL: Record<PayStep, string> = {
  idle: "",
  checkout: "Preparing checkout…",
  approve: "Approve USDT in your wallet…",
  pay: "Confirm the payment in your wallet…",
  confirm: "Waiting for BNB Chain…",
  done: "Payment confirmed",
  error: "",
};

const friendly = (e: unknown) => {
  const m = e instanceof Error ? e.message : String(e);
  if (/User rejected|denied/i.test(m)) return "You cancelled the transaction in your wallet.";
  if (/insufficient funds/i.test(m)) return "Not enough BNB for gas.";
  if (/transfer amount exceeds balance|ERC20InsufficientBalance/i.test(m)) return "Not enough USDT in this wallet.";
  return m.split("\n")[0].slice(0, 180);
};

/**
 * Runs a checkout end to end: asks the API for a signed payment, approves USDT if
 * the allowance is short, calls PokeCastPayments.pay and lets the server confirm
 * the transaction. Returns the server's confirmation results.
 */
export function usePayment() {
  const config = useConfig();
  const { address } = useAccount();
  const [step, setStep] = useState<PayStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<Hex | null>(null);

  async function run<T>(checkout: () => Promise<SignedPayment>) {
    setError(null);
    setTxHash(null);
    try {
      if (!address) throw new Error("Connect your wallet first.");
      if (!PAYMENTS_ADDRESS || !USDT_ADDRESS) throw new Error("Payments aren't live yet.");
      setStep("checkout");
      const { payment, signature } = await checkout();
      const amount = BigInt(payment.amount);

      const allowance = await readContract(config, {
        address: USDT_ADDRESS,
        abi: erc20Abi,
        functionName: "allowance",
        args: [address, PAYMENTS_ADDRESS],
        chainId: chain.id,
      });
      if (allowance < amount) {
        setStep("approve");
        const approval = await writeContract(config, {
          address: USDT_ADDRESS,
          abi: erc20Abi,
          functionName: "approve",
          args: [PAYMENTS_ADDRESS, amount],
          chainId: chain.id,
        });
        await waitForTransactionReceipt(config, { hash: approval, chainId: chain.id });
      }

      setStep("pay");
      const hash = await writeContract(config, {
        address: PAYMENTS_ADDRESS,
        abi: paymentsAbi,
        functionName: "pay",
        args: [
          {
            ...payment,
            amount,
            fee: BigInt(payment.fee),
            deadline: BigInt(payment.deadline),
          },
          signature,
        ],
        chainId: chain.id,
      });
      setTxHash(hash);
      setStep("confirm");
      await waitForTransactionReceipt(config, { hash, chainId: chain.id });

      // the node behind the API can lag a block or two behind the wallet's
      let result: T | null = null;
      for (let i = 0; i < 6 && !result; i++) {
        try {
          result = await api<T>("/api/checkout/confirm", { txHash: hash });
        } catch (e) {
          if (i === 5) throw e;
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
      setStep("done");
      return result!;
    } catch (e) {
      setStep("error");
      setError(friendly(e));
      throw e;
    }
  }

  return { run, step, error, txHash, busy: step !== "idle" && step !== "done" && step !== "error", reset: () => setStep("idle") };
}
