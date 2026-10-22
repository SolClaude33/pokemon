"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useMounted } from "@/lib/useClient";
import { useAccount } from "wagmi";
import { bsc } from "wagmi/chains";
import { buildPool, drawPack, fmtUSDC, type Card, type Pull } from "@/lib/odds";
import { ECONOMICS, type PackConfig } from "@/lib/packs";
import { DEMO_OWNER, recordPack } from "@/lib/vault";
import { PackOpening } from "./PackOpening";
import { WalletButton, useUsdcBalance } from "./WalletButton";

type Props = {
  pack: PackConfig;
  cards: Card[];
  setName: string;
  packImage: string;
  ev: number;
};

type Status = "idle" | "processing" | "error";


export function PackStation({ pack, cards, setName, packImage, ev }: Props) {
  const { address, chainId, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const usdc = useUsdcBalance();
  const mounted = useMounted();
  const pool = useMemo(() => buildPool(cards), [cards]);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [pulls, setPulls] = useState<Pull[] | null>(null);

  const wrongChain = isConnected && chainId !== bsc.id;
  const lowBalance = usdc.value != null && usdc.value < pack.price;

  const [owner, setOwner] = useState<string | null>(null);

  /** `guest` = free demo rip without a wallet; its cards land in a guest vault. */
  const buy = (guest = false) => {
    const who = guest ? DEMO_OWNER : address;
    if (!who) {
      openConnectModal?.();
      return;
    }
    setOwner(who);
    setStatus("processing");
    setError(null);
    // DEMO: stands in for the USDC transfer + server-side draw.
    setTimeout(() => {
      try {
        const result = drawPack(pack, pool);
        if (result.length !== 10) throw new Error("Pack draw failed");
        recordPack(who, result, { setId: pack.setId, setName, price: guest ? 0 : pack.price });
        setPulls(result);
        setStatus("idle");
      } catch (e) {
        setStatus("error");
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    }, 1100);
  };

  const portalTarget = mounted ? document.getElementById("channel") : null;

  return (
    <div className="border border-line bg-[#0b0d11]/70 p-5 backdrop-blur-sm">
      <div className="flex items-baseline justify-between gap-4">
        <p className="hud text-dim">1 sealed booster · 10 cards</p>
        <p className="font-display text-3xl">
          {pack.price.toFixed(2)} <span className="hud not-italic text-dim">USDC</span>
        </p>
      </div>
      <dl className="hud mt-4 grid grid-cols-2 gap-y-2 border-t border-line pt-4 text-dim">
        <dt>Expected value</dt>
        <dd className="text-right text-phosphor">{fmtUSDC(ev)}</dd>
        <dt>Instant buyback</dt>
        <dd className="text-right text-phosphor">{Math.round(ECONOMICS.buybackRate * 100)}% of market</dd>
        <dt>Ship home</dt>
        <dd className="text-right text-phosphor">{ECONOMICS.shippingFee} USDC / shipment</dd>
        {isConnected && !wrongChain && (
          <>
            <dt>Your balance</dt>
            <dd className={`text-right ${lowBalance ? "text-warn" : "text-phosphor"}`}>
              {usdc.isLoading ? "…" : usdc.isError ? "Unavailable" : `${usdc.value?.toFixed(2)} USDC`}
            </dd>
          </>
        )}
      </dl>

      <div className="mt-5 flex flex-col gap-2">
        {!mounted ? (
          <span className="btn skeleton w-full" aria-hidden="true" />
        ) : !isConnected || wrongChain ? (
          <>
            <WalletButton size="large" />
            {!isConnected && (
              <button type="button" className="btn btn-ghost hud w-full" onClick={() => buy(true)} disabled={status === "processing"}>
                {status === "processing" ? "Shuffling…" : "Or try a free demo rip →"}
              </button>
            )}
          </>
        ) : (
          <button type="button" className="btn btn-holo w-full" onClick={() => buy()} disabled={status === "processing"}>
            {status === "processing" ? "Confirming purchase…" : `Buy & rip · ${pack.price.toFixed(2)} USDC`}
          </button>
        )}
        {status === "error" && (
          <p role="alert" className="hud text-signal">
            {error}. Nothing was charged — try again.
          </p>
        )}
        {mounted && isConnected && !wrongChain && lowBalance && (
          <p className="hud text-warn">Not enough USDC on BNB Chain for a live purchase. Demo rips still work.</p>
        )}
        <p className="hud text-faint">Demo mode · no USDC leaves your wallet yet</p>
      </div>

      {pulls &&
        owner &&
        portalTarget &&
        createPortal(
          <PackOpening
            key={pulls[0]?.uid}
            owner={owner}
            demo={owner === DEMO_OWNER}
            pulls={pulls}
            packImage={packImage}
            setName={setName}
            price={owner === DEMO_OWNER ? 0 : pack.price}
            onClose={() => setPulls(null)}
            onAgain={() => {
              setPulls(null);
              buy(owner === DEMO_OWNER);
            }}
          />,
          portalTarget,
        )}
    </div>
  );
}
