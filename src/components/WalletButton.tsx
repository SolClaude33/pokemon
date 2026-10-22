"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { formatUnits } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { bsc } from "wagmi/chains";
import { USDC_BSC, erc20BalanceAbi } from "@/lib/wallet";

export function useUsdcBalance() {
  const { address } = useAccount();
  const q = useReadContract({
    address: USDC_BSC.address,
    abi: erc20BalanceAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: bsc.id,
    query: { enabled: !!address, refetchInterval: 30_000 },
  });
  const value = q.data != null ? Number(formatUnits(q.data, USDC_BSC.decimals)) : null;
  return { value, isLoading: q.isLoading, isError: q.isError };
}

export const shortAddr = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

export function WalletButton({ size = "hud" }: { size?: "hud" | "large" }) {
  const usdc = useUsdcBalance();
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
              {usdc.isLoading ? "…" : usdc.value != null ? usdc.value.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "—"} USDC
            </span>
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}
