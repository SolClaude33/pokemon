import type { Metadata } from "next";
import { Suspense } from "react";
import { MarketView } from "@/components/MarketView";
import { demoListings, listDexCards, listPacks } from "@/lib/catalog";

export const metadata: Metadata = { title: "PokéMart" };

export default function MarketPage() {
  const seeded = demoListings();
  const packs = listPacks().map((p) => ({ id: p.setId, name: p.set.name, price: p.price }));
  // per-card odds and type, so listing details match the Dex
  const dex = Object.fromEntries(listDexCards().map((c) => [c.id, { odds: c.odds, supertype: c.supertype }]));

  return (
    <div className="channel-scroll">
      <div className="mx-auto max-w-7xl px-[clamp(16px,3.4vw,40px)] pt-[clamp(96px,15vh,140px)] pb-[clamp(80px,12vh,120px)]">
        <p className="pixel text-dim">Player market</p>
        <h1 className="poke-title mt-3 text-[clamp(2.4rem,6vw,4.6rem)] leading-[0.95]">PokéMart</h1>
        <p className="mt-4 max-w-[60ch] text-[15px] leading-relaxed text-phosphor/85">
          Buy cards straight from other collectors&apos; vaults, or list your pulls at your own price in USDC. Cards never leave the vault
          until someone ships them home.
        </p>
        <p className="hud mt-3 text-faint">Demo market · seeded listings are examples, not real sellers</p>
        <Suspense fallback={<div className="skeleton mt-8 h-24 w-full" />}>
          <MarketView seeded={seeded} packs={packs} dex={dex} />
        </Suspense>
      </div>
    </div>
  );
}
