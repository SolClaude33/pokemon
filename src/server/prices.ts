import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import index from "@/data/sets/index.json";
import { CARDS } from "@/lib/cards-data";
import { PACKS } from "@/lib/packs";
import { num, q } from "./db";

// Real prices. Card values = TCGplayer market price; pack price = sealed TCGplayer
// market + PACK_MARKUP, rounded up to 0.25 USDT. Stored in Postgres and refreshed
// daily by /api/cron/prices; the static catalog JSON is the fallback.

export const PACK_MARKUP = 0.05;
export const packPriceFromMarket = (market: number) => Math.ceil(market * (1 + PACK_MARKUP) * 4) / 4;

const SETS = index.sets;

export type PriceBook = {
  cards: Record<string, { price: number | null; reverse: number | null }>;
  packs: Record<string, { market: number | null; price: number }>;
  updatedAt: string | null;
};

const catalogCards = async (setId: string) => CARDS[setId] ?? [];

/** Fills empty price tables from the catalog snapshot. */
async function seed() {
  const [{ n }] = await q<{ n: string }>("select count(*)::text as n from card_prices");
  if (Number(n) === 0) {
    for (const s of SETS) {
      const cards = await catalogCards(s.id);
      await q(
        `insert into card_prices (card_id, price, reverse_price)
         select * from unnest($1::text[], $2::numeric[], $3::numeric[]) on conflict do nothing`,
        [cards.map((c) => c.id), cards.map((c) => c.price), cards.map((c) => c.reversePrice)],
      );
    }
  }
  for (const p of PACKS) {
    const set = SETS.find((s) => s.id === p.setId);
    const market = set?.packMarketPrice ?? null;
    await q(`insert into pack_prices (set_id, market, price) values ($1, $2, $3) on conflict do nothing`, [
      p.setId,
      market,
      market ? packPriceFromMarket(market) : p.price,
    ]);
  }
}

async function loadBook(): Promise<PriceBook> {
  await seed();
  const cards = await q<{ card_id: string; price: string | null; reverse_price: string | null; updated_at: Date }>(
    "select card_id, price, reverse_price, updated_at from card_prices",
  );
  const packs = await q<{ set_id: string; market: string | null; price: string }>("select set_id, market, price from pack_prices");
  return {
    cards: Object.fromEntries(
      cards.map((c) => [c.card_id, { price: c.price == null ? null : num(c.price), reverse: c.reverse_price == null ? null : num(c.reverse_price) }]),
    ),
    packs: Object.fromEntries(packs.map((p) => [p.set_id, { market: p.market == null ? null : num(p.market), price: num(p.price) }])),
    updatedAt: cards.reduce<Date | null>((a, c) => (!a || c.updated_at > a ? c.updated_at : a), null)?.toISOString() ?? null,
  };
}

/** Current price book, cached for an hour (and invalidated after each refresh). */
export async function priceBook(): Promise<PriceBook> {
  "use cache";
  cacheTag("prices");
  cacheLife("hours");
  // the build prerenders with the catalog snapshot; live prices take over at runtime
  if (process.env.NEXT_PHASE === "phase-production-build") return { cards: {}, packs: {}, updatedAt: null };
  try {
    return await loadBook();
  } catch (e) {
    console.error("price book unavailable, using catalog snapshot", e);
    return { cards: {}, packs: {}, updatedAt: null };
  }
}

/** Uncached prices for checkout and buyback (money changes hands on these). */
export const livePriceBook = loadBook;

// ─────────────────────────────── refresh ───────────────────────────────

async function fetchJson(url: string, init?: RequestInit, tries = 8) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000), cache: "no-store" });
      if (res.ok) return res.json();
      if (res.status === 404) return null;
    } catch {}
    await new Promise((r) => setTimeout(r, 800 + i * 400));
  }
  return null;
}

const tcgMarket = (tcg: { prices?: Record<string, { market?: number; mid?: number }> } | undefined) => {
  const p = tcg?.prices ?? {};
  const v = (k: string) => p[k]?.market ?? p[k]?.mid ?? null;
  return { price: v("normal") ?? v("holofoil") ?? v("1stEditionHolofoil") ?? v("reverseHolofoil"), reverse: v("reverseHolofoil") };
};

/** Pulls fresh TCGplayer market prices for every card and sealed pack. */
export async function refreshPrices() {
  let cards = 0;
  let packs = 0;
  for (const s of SETS) {
    const ids: string[] = [];
    const prices: (number | null)[] = [];
    const reverses: (number | null)[] = [];
    for (let page = 1; page < 20; page++) {
      const r = await fetchJson(`https://api.pokemontcg.io/v2/cards?q=set.id:${s.id}&pageSize=100&page=${page}&select=id,tcgplayer`);
      if (!r?.data?.length) break;
      for (const c of r.data) {
        const m = tcgMarket(c.tcgplayer);
        if (m.price == null) continue; // keep the last known price
        ids.push(c.id);
        prices.push(m.price);
        reverses.push(m.reverse);
      }
      if (page * 100 >= r.totalCount) break;
    }
    if (ids.length) {
      await q(
        `insert into card_prices (card_id, price, reverse_price, updated_at)
         select id, p, rp, now() from unnest($1::text[], $2::numeric[], $3::numeric[]) as t(id, p, rp)
         on conflict (card_id) do update set price = excluded.price,
           reverse_price = coalesce(excluded.reverse_price, card_prices.reverse_price), updated_at = now()`,
        [ids, prices, reverses],
      );
      cards += ids.length;
    }
    const detail = await fetchJson(`https://mp-search-api.tcgplayer.com/v2/product/${s.tcgplayerPackId}/details`, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    const market = typeof detail?.marketPrice === "number" ? detail.marketPrice : null;
    if (market) {
      await q(
        `insert into pack_prices (set_id, market, price, updated_at) values ($1, $2, $3, now())
         on conflict (set_id) do update set market = excluded.market, price = excluded.price, updated_at = now()`,
        [s.id, market, packPriceFromMarket(market)],
      );
      packs++;
    }
  }
  return { cards, packs };
}
