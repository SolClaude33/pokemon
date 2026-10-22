import type { Metadata } from "next";
import Link from "next/link";
import { LEVELS } from "@/lib/levels";
import { ECONOMICS } from "@/lib/packs";

export const metadata: Metadata = { title: "How it works" };

const pct = (n: number) => `${+(n * 100).toFixed(1)}%`;

const STEPS = [
  {
    n: "01",
    title: "Pick a channel",
    body: "Every channel is one real, sealed English booster pack — from the 1999 Base Set to current Pokémon TCG sets. Flip through them with ← →.",
  },
  {
    n: "02",
    title: "Read the odds first",
    body: "Each pack page shows the chance of every rarity per pack, the chase cards and the pack's expected value at TCGplayer market prices — before you pay. The Card Dex lists every card you can pull, with its odds.",
  },
  {
    n: "03",
    title: "Pay in USDT on BNB Chain",
    body: "Sign in with MetaMask, Binance Wallet, Trust, OKX or any BNB Chain wallet and pay in USDT (BEP-20). Payments go through the PokéCast contract straight to the treasury — it never holds your funds.",
  },
  {
    n: "04",
    title: "Rip it, provably fair",
    body: "Your cards are drawn from a server seed committed by its hash before you buy, your own client seed and a nonce. Rotate the seed in your profile to reveal it and re-check any pack.",
  },
  {
    n: "05",
    title: "Level up and earn cashback",
    body: `Every USDT you spend on packs levels up your trainer card — from Rookie to Champion — and unlocks up to ${pct(LEVELS[LEVELS.length - 1].cashback)} cashback on every pack, withdrawable in USDT.`,
  },
  {
    n: "06",
    title: "Complete missions",
    body: "Daily, weekly and monthly missions reward free packs and cashback for ripping, chasing hits and trading.",
  },
  {
    n: "07",
    title: "Trade on the PokéMart",
    body: `List any card from your vault at your own price, or buy the exact card you're chasing from other trainers. Buyers pay sellers directly on BNB Chain; sellers pay a ${pct(ECONOMICS.marketFee)} fee.`,
  },
  {
    n: "08",
    title: "Ship it or sell it back",
    body: `Ship cards home for a flat ${ECONOMICS.shippingFee} USDT per shipment, or sell them back for ${pct(ECONOMICS.buybackRate)} of market (${pct(ECONOMICS.highValueRate)} on cards worth ${ECONOMICS.highValueThreshold}+ USDT) within ${ECONOMICS.buybackWindowHours} hours of pulling them.`,
  },
];

const FAQ = [
  {
    q: "Where do the odds come from?",
    a: "The Pokémon Company does not publish pull rates. We use large TCGplayer and community pack-opening samples and cite the sources on every pack page.",
  },
  {
    q: "How are prices set?",
    a: "Card values are TCGplayer market prices, refreshed every day and shown in USDT. A pack costs its sealed TCGplayer market price plus 5%.",
  },
  {
    q: "When do I receive buybacks and cashback?",
    a: "They're queued as payouts and sent in USDT to the wallet you signed in with once the PokéCast team processes them. Track every payout, with its transaction, in your vault.",
  },
  {
    q: "What do I need to buy?",
    a: "A BNB Chain wallet holding USDT (BEP-20) for the packs and a little BNB for gas. The first purchase asks you to approve USDT for the PokéCast contract.",
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
