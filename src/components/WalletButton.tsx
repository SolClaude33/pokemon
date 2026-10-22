"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { erc20Abi, formatUnits } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { USDT_ADDRESS, USDT_DECIMALS, chain } from "@/lib/chain/config";

export function useUsdtBalance() {
  const { address } = useAccount();
  const q = useReadContract({
    address: USDT_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: chain.id,
    query: { enabled: !!address && !!USDT_ADDRESS, refetchInterval: 20_000 },
  });
  const value = q.data != null ? Number(formatUnits(q.data, USDT_DECIMALS)) : null;
  return { value, isLoading: q.isLoading, isError: q.isError, refetch: q.refetch };
}

export const shortAddr = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

export function WalletButton({ size = "hud" }: { size?: "hud" | "large" }) {
  const usdt = useUsdtBalance();
  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted, authenticationStatus }) => {
        const ready = mounted && authenticationStatus !== "loading";
        const connected = ready && account && chain;
        const base = size === "large" ? "btn btn-primary w-full" : "hud link-hud cursor-pointer whitespace-nowrap";

        if (!ready) {
          return (
            <span className={size === "large" ? "btn w-full opacity-50" : "hud text-dim"} aria-hidden="true">
              {size === "large" ? "Loading wallet…" : "[ · · · ]"}
            </span>
          );
        }
        if (!connected) {
          return (
            <button type="button" onClick={openConnectModal} className={base}>
              {size === "large" ? (
                "Connect wallet"
              ) : (
                <>
                  [ Connect<span className="hidden sm:inline"> wallet</span> ]
                </>
              )}
            </button>
          );
        }
        if (chain.unsupported) {
          return (
            <button
              type="button"
              onClick={openChainModal}
              className={size === "large" ? "btn w-full border-signal text-signal" : "hud cursor-pointer text-signal"}
            >
              {size === "large" ? "Switch to BNB Chain" : "[ Wrong network ]"}
            </button>
          );
        }
        if (size === "large") return null;
        return (
          <button type="button" onClick={openAccountModal} className={base} title="Account">
            <span className="hidden text-dim sm:inline">{shortAddr(account.address)}</span>
            <span className="mx-2 hidden text-faint sm:inline">·</span>
            <span>
              {usdt.isLoading ? "…" : usdt.value != null ? usdt.value.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "—"} USDT
            </span>
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}
