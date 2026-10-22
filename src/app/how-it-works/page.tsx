import type { Metadata } from "next";
import Link from "next/link";
import { ECONOMICS } from "@/lib/packs";

export const metadata: Metadata = { title: "How it works" };

const STEPS = [
  {
    n: "01",
    title: "Pick a channel",
    body: "Every channel is one real, sealed English booster pack from a current Pokémon TCG set. Flip through them with ← →.",
  },
  {
    n: "02",
    title: "Read the odds first",
    body: "Each pack page shows the chance of every rarity per pack, the chase cards and the pack's expected value at TCGplayer market prices — before you pay a cent. The Card Dex lists every card you can pull, with its odds.",
  },
  {
    n: "03",
    title: "Pay in USDC on BNB Chain",
    body: "Connect MetaMask, Binance Wallet, Trust, OKX or any BNB Chain wallet and pay the listed price in USDC.",
  },
  {
    n: "04",
    title: "Rip it on air",
    body: "Tear the seal and flip every card one by one: 10 in modern packs (4 Common, 3 Uncommon, 2 reverse holos — one can upgrade to a hit — and a Rare or better), 11 in the vintage 1999 Base Set.",
  },
  {
    n: "05",
    title: "Trade on the PokéMart",
    body: `List any card from your vault at your own price, or buy the exact card you're chasing from other collectors. Sellers pay a ${ECONOMICS.marketFee * 100}% fee; the card changes vaults instantly.`,
  },
  {
    n: "06",
    title: "Ship it or sell it back",
    body: `Keep cards in your vault and ship them home for a flat ${ECONOMICS.shippingFee} USDC per shipment, or sell any card back instantly for ${Math.round(
      ECONOMICS.buybackRate * 100,
    )}% of market (${Math.round(ECONOMICS.highValueRate * 100)}% on cards worth $${ECONOMICS.highValueThreshold}+).`,
  },
];

const FAQ = [
  {
    q: "Where do the odds come from?",
    a: "The Pokémon Company does not publish pull rates. We use large community and TCGplayer pack-opening samples and cite the sources on every pack page.",
  },
  {
    q: "How is a card's value set?",
    a: "By its TCGplayer market price at the time of the last catalog snapshot, shown next to every card. Reverse holos use their reverse-holo price.",
  },
  {
    q: `How long can I sell a card back?`,
    a: `Buyback is available for ${ECONOMICS.buybackWindowHours} hours after the pull. After that, the card stays in your vault until you ship it.`,
  },
  {
    q: "Is this live?",
    a: "Not yet. This build runs in demo mode: purchases, draws and buybacks are simulated in your browser and no USDC leaves your wallet.",
  },
];

export default function HowItWorks() {
  return (
    <div className="channel-scroll">
      <article className="mx-auto max-w-5xl px-[clamp(16px,3.4vw,40px)] pt-[clamp(96px,15vh,140px)] pb-[clamp(80px,12vh,120px)]">
        <p className="pixel text-[10px] text-dim">Program guide</p>
        <h1 className="poke-title mt-4 max-w-[16ch] text-[clamp(2.6rem,6vw,5rem)] leading-[0.95]">
          Real packs. Live odds. Your call.
        </h1>

        <ol className="mt-16 border-t border-line-strong">
          {STEPS.map((s) => (
            <li key={s.n} className="grid gap-3 border-b border-line py-8 sm:grid-cols-[80px_minmax(0,1fr)_minmax(0,1.4fr)] sm:gap-8">
              <span className="pixel text-xs text-dim">{s.n}</span>
              <h2 className="font-display text-2xl text-poke-yellow">{s.title}</h2>
              <p className="leading-relaxed text-phosphor/85">{s.body}</p>
            </li>
          ))}
        </ol>

        <section aria-labelledby="faq" className="mt-20">
          <h2 id="faq" className="font-display text-[clamp(1.8rem,3.6vw,2.8rem)]">
            Questions
          </h2>
          <div className="mt-6 border-t border-line">
            {FAQ.map((f) => (
              <details key={f.q} className="group border-b border-line py-5">
                <summary className="hud flex cursor-pointer list-none items-center justify-between gap-4 text-phosphor">
                  {f.q}
                  <span aria-hidden="true" className="text-dim transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 max-w-[64ch] leading-relaxed text-phosphor/80">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <div className="mt-16 flex flex-wrap items-center gap-4">
          <Link href="/" className="btn btn-holo">
            Start watching
          </Link>
          <Link href="/vault" className="btn">
            Open vault
          </Link>
        </div>

        <p className="hud mt-16 leading-relaxed text-faint">
          PokéCast is not affiliated with, endorsed by or sponsored by Nintendo, The Pokémon Company, Creatures or GAME FREAK. Pokémon
          and card artwork are trademarks of their respective owners. Card data from pokemontcg.io; prices and pack images from TCGplayer.
        </p>
      </article>
    </div>
  );
}
