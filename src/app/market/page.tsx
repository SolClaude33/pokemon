import type { Metadata } from "next";
import { Suspense } from "react";
import { MarketView } from "@/components/MarketView";
import { listDexCards, listPacks } from "@/lib/catalog";

export const metadata: Metadata = { title: "PokéMart" };

export default async function MarketPage() {
  const packs = (await listPacks()).map((p) => ({ id: p.setId, name: p.set.name, price: p.price }));
  // per-card market price, odds and type, so listings can be compared with the Dex
  const dex = Object.fromEntries((await listDexCards()).map((c) => [c.id, { odds: c.odds, supertype: c.supertype, price: c.price }]));

  return (
    <div className="channel-scroll">
      <div className="mx-auto max-w-7xl px-[clamp(16px,3.4vw,40px)] pt-[clamp(96px,15vh,140px)] pb-[clamp(80px,12vh,120px)]">
        <p className="pixel text-dim">Player market</p>
        <h1 className="poke-title mt-3 text-[clamp(2.4rem,6vw,4.6rem)] leading-[0.95]">PokéMart</h1>
        <p className="mt-4 max-w-[60ch] text-[15px] leading-relaxed text-phosphor/85">
          Buy cards straight from other trainers&apos; vaults, or list your pulls at your own price in USDT. You pay in USDT on BNB Chain, the card moves
          vaults instantly and the seller is paid out in USDT — it only leaves the vault when someone ships it home.
        </p>
        <Suspense fallback={<div className="skeleton mt-8 h-24 w-full" />}>
          <MarketView packs={packs} dex={dex} />
        </Suspense>
      </div>
    </div>
  );
}
