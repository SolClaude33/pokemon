"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { createPortal } from "react-dom";
import { useAccount } from "wagmi";
import { sfx } from "@/lib/audio";
import { chain, explorerTx } from "@/lib/chain/config";
import { fmtUSDT } from "@/lib/odds";
import { ECONOMICS, packSize, type PackConfig } from "@/lib/packs";
import { STEP_LABEL, paymentsLive, usePayment, type Checkout } from "@/lib/pay";
import { api, useMe } from "@/lib/session";
import type { ConfirmResult, OpenedPack, VaultData } from "@/lib/types";
import { useMounted } from "@/lib/useClient";
import { PackOpening } from "./PackOpening";
import { useUsdtBalance } from "./WalletButton";

type Props = {
  pack: PackConfig;
  setName: string;
  packImage: string;
  ev: number;
};

const QUANTITIES = [1, 3, 5, 10];

export function PackStation({ pack, setName, packImage, ev }: Props) {
  const { address, chainId, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const me = useMe();
  const qc = useQueryClient();
  const usdt = useUsdtBalance();
  const mounted = useMounted();
  const pay = usePayment();
  const [quantity, setQuantity] = useState(1);
  const [queue, setQueue] = useState<{ packs: OpenedPack[]; index: number; free: boolean } | null>(null);
  const [freeError, setFreeError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  const signedIn = !!me.data?.address && !!address && me.data.address.toLowerCase() === address.toLowerCase();
  const wrongChain = isConnected && chainId !== chain.id;
  const total = Math.round(pack.price * quantity * 100) / 100;
  const lowBalance = usdt.value != null && usdt.value < total;
  const live = paymentsLive;

  const vault = useQuery<VaultData>({
    queryKey: ["vault"],
    queryFn: () => api<VaultData>("/api/vault"),
    enabled: signedIn,
  });
  const vouchers = (vault.data?.vouchers ?? []).filter((v) => v.set_id === pack.setId);

  const buy = async () => {
    try {
      const res = await pay.run<{ results: ConfirmResult[] }>(() =>
        api<Checkout>("/api/checkout/pack", { setId: pack.setId, quantity }),
      );
      const opened = res.results.flatMap((r) => (r.kind === "pack" ? r.opened : []));
      sfx.coin();
      usdt.refetch();
      qc.invalidateQueries();
      if (opened.length) setQueue({ packs: opened, index: 0, free: false });
    } catch {
      sfx.error();
    }
  };

  const openFree = async (voucherId: number) => {
    setOpening(true);
    setFreeError(null);
    try {
      const opened = await api<OpenedPack>("/api/packs/free", { voucherId });
      sfx.select();
      qc.invalidateQueries();
      setQueue({ packs: [opened], index: 0, free: true });
    } catch (e) {
      sfx.error();
      setFreeError(e instanceof Error ? e.message : "Couldn't open the free pack");
    } finally {
      setOpening(false);
    }
  };

  const sell = (uids: string[]) => api<{ total: number; count: number }>("/api/vault/buyback", { itemIds: uids });

  const portalTarget = mounted ? document.getElementById("channel") : null;
  const current = queue?.packs[queue.index];
  const remaining = queue ? queue.packs.length - queue.index - 1 : 0;

  return (
    <div className="border border-line bg-[#0b0d11]/70 p-5 backdrop-blur-sm">
      <div className="flex items-baseline justify-between gap-4">
        <p className="hud text-dim">1 sealed booster · {packSize(pack)} cards</p>
        <p className="font-display text-3xl">
          {pack.price.toFixed(2)} <span className="hud text-dim">USDT</span>
        </p>
      </div>
      <dl className="hud mt-4 grid grid-cols-2 gap-y-2 border-t border-line pt-4 text-dim">
        <dt>Expected value</dt>
        <dd className="text-right text-phosphor">{fmtUSDT(ev)}</dd>
        <dt>Instant buyback</dt>
        <dd className="text-right text-phosphor">{Math.round(ECONOMICS.buybackRate * 100)}% of market</dd>
        <dt>Ship home</dt>
        <dd className="text-right text-phosphor">{ECONOMICS.shippingFee} USDT / shipment</dd>
        {signedIn && !wrongChain && (
          <>
            <dt>Your balance</dt>
            <dd className={`text-right ${lowBalance ? "text-warn" : "text-phosphor"}`}>
              {usdt.isLoading ? "…" : usdt.value == null ? "—" : `${usdt.value.toFixed(2)} USDT`}
            </dd>
          </>
        )}
      </dl>

      <div className="mt-5 flex flex-col gap-2">
        {!mounted ? (
          <span className="btn skeleton w-full" aria-hidden="true" />
        ) : !live ? (
          <p className="gb-dialog">Pack sales open soon. Payments on BNB Chain aren&apos;t live yet.</p>
        ) : !isConnected || !signedIn ? (
          <button type="button" className="btn btn-primary w-full" onClick={() => openConnectModal?.()}>
            {isConnected ? "Sign in with your wallet" : "Connect wallet to buy"}
          </button>
        ) : wrongChain ? (
          <p className="hud text-poke-red">Switch your wallet to {chain.name} to buy.</p>
        ) : (
          <>
            <div role="radiogroup" aria-label="Packs to buy" className="grid grid-cols-4 gap-1.5">
              {QUANTITIES.map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={quantity === n}
                  disabled={pay.busy}
                  onClick={() => {
                    sfx.click();
                    setQuantity(n);
                  }}
                  className={`hud min-h-10 cursor-pointer border transition-colors ${quantity === n ? "border-poke-yellow bg-poke-yellow/10 text-poke-yellow" : "border-line text-dim hover:text-phosphor"}`}
                >
                  ×{n}
                </button>
              ))}
            </div>
            <button type="button" className="btn btn-holo w-full" onClick={buy} disabled={pay.busy}>
              {pay.busy ? STEP_LABEL[pay.step] : `Buy & rip ${quantity > 1 ? `${quantity} packs` : ""} · ${total.toFixed(2)} USDT`}
            </button>
            {lowBalance && !pay.busy && <p className="hud text-warn">Your wallet holds less than {total.toFixed(2)} USDT.</p>}
          </>
        )}

        {pay.step === "error" && pay.error && (
          <p role="alert" className="hud text-poke-red">
            {pay.error}
          </p>
        )}
        {pay.txHash && (
          <a href={explorerTx(pay.txHash)} target="_blank" rel="noreferrer" className="hud link-hud text-dim">
            View transaction ↗
          </a>
        )}

        {vouchers.length > 0 && (
          <div className="mt-2 border-t border-line pt-3">
            <p className="hud text-ok">
              {vouchers.length} free {setName} pack{vouchers.length > 1 ? "s" : ""} from missions
            </p>
            <button type="button" className="btn btn-primary mt-2 w-full" disabled={opening} onClick={() => openFree(vouchers[0].id)}>
              {opening ? "Opening…" : "Open a free pack"}
            </button>
            {freeError && <p className="hud mt-1 text-poke-red">{freeError}</p>}
          </div>
        )}
        <p className="hud text-faint">
          Paid in USDT on {chain.name} · <Link href="/how-it-works" className="link-hud">how it works</Link>
        </p>
      </div>

      {current &&
        portalTarget &&
        createPortal(
          <PackOpening
            key={current.orderId}
            free={queue!.free}
            minor={pack.minorRarities}
            pulls={current.pulls}
            packImage={packImage}
            setName={setName}
            price={queue!.free ? 0 : pack.price}
            proof={current.proof}
            onSell={async (uids) => {
              const r = await sell(uids);
              qc.invalidateQueries();
              return r;
            }}
            onClose={() => setQueue(null)}
            next={
              remaining > 0
                ? { label: `Open next pack (${remaining} left)`, run: () => setQueue((q) => (q ? { ...q, index: q.index + 1 } : q)) }
                : { label: "Back to the pack", run: () => setQueue(null) }
            }
          />,
          portalTarget,
        )}
    </div>
  );
}
