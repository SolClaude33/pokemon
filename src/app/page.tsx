import { PackArc, type ArcPack } from "@/components/PackArc";
import { getPack, listPacks } from "@/lib/catalog";
import { buildPool, chaseCards, expectedValue } from "@/lib/odds";

export default function Home() {
  const packs: ArcPack[] = listPacks().map((p) => {
    const { cards } = getPack(p.setId)!;
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
      ev: expectedValue(p, buildPool(cards)),
      topHit: top ? { name: top.name, price: top.price ?? 0 } : null,
    };
  });

  return <PackArc packs={packs} />;
}
