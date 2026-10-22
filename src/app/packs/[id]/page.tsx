import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PackHero } from "@/components/PackHero";
import { PackStation } from "@/components/PackStation";
import { RarityTag, TcgCard } from "@/components/TcgCard";
import { catalogGeneratedAt, getPack, listPacks } from "@/lib/catalog";
import { buildPool, cardOdds, chaseCards, expectedValue, fmtOneIn, fmtPct, fmtUSDC, rarityOdds } from "@/lib/odds";
import { ECONOMICS } from "@/lib/packs";
import { rarityMeta } from "@/lib/rarity";

export function generateStaticParams() {
  return listPacks().map((p) => ({ id: p.setId }));
}

export async function generateMetadata({ params }: PageProps<"/packs/[id]">): Promise<Metadata> {
  const { id } = await params;
  const pack = getPack(id);
  return pack ? { title: `${pack.listing.set.name} — odds & pack opening` } : {};
}

const pad2 = (n: number) => String(n).padStart(2, "0");

export default function PackPage({ params }: PageProps<"/packs/[id]">) {
  return (
    <Suspense fallback={<PackSkeleton />}>
      {params.then(({ id }) => (
        <PackContent id={id} />
      ))}
    </Suspense>
  );
}

function PackSkeleton() {
  return (
    <div className="channel-scroll" role="status" aria-label="Loading pack">
      <div className="mx-auto grid max-w-6xl gap-10 px-[clamp(16px,3.4vw,40px)] pt-[clamp(120px,19vh,180px)] md:grid-cols-[minmax(220px,320px)_1fr] lg:gap-16">
        <div className="skeleton mx-auto aspect-[548/1000] w-[min(62vw,320px)] md:w-full" />
        <div className="flex flex-col gap-5">
          <div className="skeleton h-4 w-64" />
          <div className="skeleton h-16 w-3/4" />
          <div className="skeleton h-4 w-1/2" />
          <div className="skeleton mt-6 h-56 max-w-2xl" />
        </div>
      </div>
    </div>
  );
}

function PackContent({ id }: { id: string }) {
  const data = getPack(id);
  if (!data) notFound();
  const { listing: pack, cards } = data;
  const pool = buildPool(cards);
  const odds = rarityOdds(pack, pool);
  const ev = expectedValue(pack, pool);
  const chase = chaseCards(cards, 6);
  const hitChance = 1 - odds.filter((o) => rarityMeta(o.rarity).hit && o.rarity !== "Reverse Holo").reduce((a, o) => a * (1 - o.perPack), 1);
  const updated = new Date(catalogGeneratedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="channel-scroll">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[80vh]"
        style={{ background: `radial-gradient(50% 60% at 22% 30%, color-mix(in oklab, ${pack.accent} 16%, transparent), transparent 70%)` }}
      />
      <article className="relative mx-auto max-w-6xl px-[clamp(16px,3.4vw,40px)] pt-[clamp(96px,15vh,140px)] pb-[clamp(80px,12vh,120px)]">
        <Link href="/" className="hud link-hud text-dim">
          ← All channels
        </Link>

        {/* hero */}
        <div className="mt-6 grid items-start gap-10 md:grid-cols-[minmax(220px,320px)_1fr] lg:gap-16">
          <div className="mx-auto w-[min(62vw,320px)] md:sticky md:top-28 md:w-full">
            <PackHero pack={{ setId: pack.setId, setName: pack.set.name, packImage: pack.set.packImage, logo: pack.set.logo, accent: pack.accent }} />
          </div>

          <div className="fade-up">
            <dl className="hud grid max-w-lg grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
              {[
                ["Channel", pad2(pack.channel)],
                ["Released", pack.set.releaseDate.replaceAll("/", ".")],
                ["Cards in set", String(pack.set.cardCount)],
                ["Sealed market", pack.set.packMarketPrice ? fmtUSDC(pack.set.packMarketPrice) : "—"],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-faint">[{k}]</dt>
                  <dd className="mt-1">{v}</dd>
                </div>
              ))}
            </dl>

            <Image
              src={pack.set.logo}
              alt=""
              width={480}
              height={200}
              className="mt-8 h-auto w-[min(260px,60%)] opacity-90"
              aria-hidden="true"
            />
            <h1 className="poke-title mt-4 text-[clamp(2.4rem,5.4vw,4.4rem)] leading-[0.95]">
              {pack.set.name}
            </h1>
            <p className="mt-4 max-w-[46ch] text-[15px] leading-relaxed text-phosphor/85">{pack.tagline}</p>

            <div className="mt-8 grid max-w-2xl gap-6 sm:grid-cols-[1.25fr_1fr]">
              <PackStation pack={pack} cards={cards} setName={pack.set.name} packImage={pack.set.packImage} ev={ev} />
              <div className="flex flex-col justify-between gap-6 border-l border-line pl-6">
                <div>
                  <p className="hud text-faint">[Chance of a hit]</p>
                  <p className="mt-1 font-display text-4xl">{fmtPct(hitChance)}</p>
                  <p className="hud mt-1 text-dim">Double Rare or better · {fmtOneIn(hitChance)}</p>
                </div>
                <div>
                  <p className="hud text-faint">[Sell-back EV]</p>
                  <p className="mt-1 font-display text-4xl">{fmtUSDC(ev * ECONOMICS.buybackRate)}</p>
                  <p className="hud mt-1 text-dim">If you sold every card back</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* odds */}
        <section aria-labelledby="odds" className="mt-24">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line-strong pb-4">
            <div>
              <p className="pixel text-[10px] text-dim">Before you rip</p>
              <h2 id="odds" className="mt-2 font-display text-[clamp(1.8rem,3.6vw,2.8rem)] leading-none">
                The odds, on air
              </h2>
            </div>
            <p className="hud max-w-[52ch] text-dim">
              Per-pack chance of pulling each rarity. 4 Common · 3 Uncommon · 2 reverse holo (one can upgrade to a hit) · 1 Rare or better.
            </p>
          </div>

          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="hud text-faint">
                  <th scope="col" className="py-3 font-normal">Rarity</th>
                  <th scope="col" className="py-3 font-normal">Cards</th>
                  <th scope="col" className="py-3 font-normal">Per pack</th>
                  <th scope="col" className="py-3 font-normal">Odds</th>
                  <th scope="col" className="py-3 text-right font-normal">Avg value</th>
                  <th scope="col" className="py-3 text-right font-normal">Top card</th>
                </tr>
              </thead>
              <tbody>
                {odds.map((o) => (
                  <tr key={o.rarity} className="border-t border-line transition-colors hover:bg-phosphor/[0.03]">
                    <th scope="row" className="py-3 font-normal">
                      <RarityTag rarity={o.rarity} />
                    </th>
                    <td className="hud py-3 text-dim">{o.poolSize}</td>
                    <td className="py-3">
                      <span className="flex items-center gap-3">
                        <span className="hud w-16 tabular-nums">{fmtPct(o.perPack)}</span>
                        <span className="hidden h-1 w-28 bg-line sm:block" aria-hidden="true">
                          <span
                            className="block h-full"
                            style={{
                              width: `${Math.max(2, Math.min(100, (Math.log10(o.perPack * 1000 + 1) / 3) * 100))}%`,
                              background: o.rarity === "Reverse Holo" ? "var(--r-rare)" : rarityMeta(o.rarity).color,
                            }}
                          />
                        </span>
                      </span>
                    </td>
                    <td className="hud py-3 text-dim">{fmtOneIn(o.perPack)}</td>
                    <td className="hud py-3 text-right tabular-nums">{fmtUSDC(o.avgValue)}</td>
                    <td className="hud max-w-[22ch] truncate py-3 pl-6 text-right normal-case text-dim">
                      {o.top ? o.top.name : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* chase */}
        <section aria-labelledby="chase" className="mt-24">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line-strong pb-4">
            <h2 id="chase" className="font-display text-[clamp(1.8rem,3.6vw,2.8rem)] leading-none">
              Chase cards
            </h2>
            <p className="hud flex gap-4 text-dim">
              Odds for that exact card, per pack
              <Link href={`/dex?pack=${pack.setId}`} className="link-hud text-poke-yellow">
                All {pack.set.cardCount} cards in the Dex →
              </Link>
            </p>
          </div>
          <ul className="mt-8 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
            {chase.map((c) => (
              <li key={c.id}>
                <TcgCard img={c.img} name={c.name} rarity={c.rarity} glow sizes="(max-width: 640px) 45vw, 180px" />
                <p className="mt-3 truncate text-[13px]">{c.name}</p>
                <RarityTag rarity={c.rarity} className="mt-1" />
                <p className="hud mt-1 flex justify-between text-dim">
                  <span className="text-phosphor">{fmtUSDC(c.price ?? 0)}</span>
                  <span>{fmtOneIn(cardOdds(c, odds))}</span>
                </p>
              </li>
            ))}
          </ul>
        </section>

        <footer className="hud mt-20 border-t border-line pt-6 leading-relaxed text-faint">
          <p>
            Card values: TCGplayer market price, snapshot {updated}. Pull rates are community estimates — The Pokémon Company does not
            publish official odds. Sources:{" "}
            {pack.sources.map((s, i) => (
              <span key={s.url}>
                <a href={s.url} target="_blank" rel="noreferrer" className="underline decoration-dotted underline-offset-4 hover:text-phosphor">
                  {s.label}
                </a>
                {i < pack.sources.length - 1 ? ", " : "."}
              </span>
            ))}
          </p>
        </footer>
      </article>
    </div>
  );
}
