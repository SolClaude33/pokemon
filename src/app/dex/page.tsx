import type { Metadata } from "next";
import { Suspense } from "react";
import { DexView } from "@/components/DexView";
import { listDexCards, listPacks } from "@/lib/catalog";

export const metadata: Metadata = { title: "Card Dex" };

export default async function DexPage() {
  const cards = await listDexCards();
  const packs = (await listPacks()).map((p) => ({ id: p.setId, name: p.set.name }));
  const hits = cards.filter((c) => c.price != null && c.price >= 20).length;

  return (
    <div className="channel-scroll">
      <div className="mx-auto max-w-7xl px-[clamp(16px,3.4vw,40px)] pt-[clamp(96px,15vh,140px)] pb-[clamp(80px,12vh,120px)]">
        <p className="pixel text-dim">Card Dex</p>
        <h1 className="poke-title mt-3 text-[clamp(2.4rem,6vw,4.6rem)] leading-[0.95]">Every card on air</h1>
        <p className="mt-4 max-w-[60ch] text-[15px] leading-relaxed text-phosphor/85">
          All {cards.length.toLocaleString("en-US")} cards you can pull from the {packs.length} packs on PokéCast — {hits} of them worth $20
          or more. Filter by pack and rarity, sort by price or odds, and open any card to see exactly how often it drops.
        </p>
        <Suspense fallback={<div className="skeleton mt-8 h-24 w-full" />}>
          <DexView cards={cards} packs={packs} />
        </Suspense>
      </div>
    </div>
  );
}
