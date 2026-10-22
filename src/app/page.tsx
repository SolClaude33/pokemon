import { PackArc, type ArcPack } from "@/components/PackArc";
import { getPackSync, listPacks } from "@/lib/catalog";
import { priceBook } from "@/server/prices";
import { buildPool, chaseCards, expectedValue } from "@/lib/odds";
import { packSize } from "@/lib/packs";

export default async function Home() {
  const book = await priceBook();
  const packs: ArcPack[] = (await listPacks(book)).map((p) => {
    const { cards } = (getPackSync(p.setId, book))!;
    const top = chaseCards(cards, 1)[0];
    return {
      setId: p.setId,
      name: p.set.name,
      series: p.set.series,
      channel: p.channel,
      price: p.price,
      tagline: p.tagline,
      packImage: p.set.packImage,
      logo: p.set.logo,
      accent: p.accent,
      cards: packSize(p),
      ev: expectedValue(p, buildPool(cards)),
      topHit: top ? { name: top.name, price: top.price ?? 0 } : null,
    };
  });

  return <PackArc packs={packs} />;
}
