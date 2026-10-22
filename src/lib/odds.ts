import { REVERSE_KEY, type PackConfig } from "./packs";
import { rarityRank } from "./rarity";

export type Card = {
  id: string;
  number: string;
  name: string;
  rarity: string;
  supertype: string;
  price: number | null;
  reversePrice: number | null;
  priceUpdatedAt: string | null;
  img: string;
};

/** A card as listed in the Dex: card data plus where it drops and how often. */
export type DexCard = {
  id: string;
  number: string;
  name: string;
  rarity: string;
  supertype: string;
  price: number | null;
  img: string;
  setId: string;
  setName: string;
  packPrice: number;
  /** expected copies per pack (≈ chance per pack for rare cards) */
  odds: number;
};

export type Pull = {
  uid: string;
  card: Card;
  /** rarity as shown to the user ("Reverse Holo" for reverse copies) */
  rarity: string;
  reverse: boolean;
  value: number;
  slot: string;
};

const REVERSE_BASE = new Set(["Common", "Uncommon", "Rare"]);

export type Pool = Map<string, Card[]>;

export function buildPool(cards: Card[]): Pool {
  const pool: Pool = new Map();
  for (const c of cards) {
    if (!pool.has(c.rarity)) pool.set(c.rarity, []);
    pool.get(c.rarity)!.push(c);
    if (REVERSE_BASE.has(c.rarity)) {
      if (!pool.has(REVERSE_KEY)) pool.set(REVERSE_KEY, []);
      pool.get(REVERSE_KEY)!.push(c);
    }
  }
  return pool;
}

const valueOf = (c: Card, reverse: boolean) => (reverse ? (c.reversePrice ?? c.price) : c.price) ?? 0;

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Slot tables restricted to rarities that exist in the pool; the remainder goes to `fill`. */
export function slotTables(pack: PackConfig, pool: Pool) {
  return pack.slots.map((s) => {
    const entries = Object.entries(s.odds ?? {}).filter(([r]) => pool.has(r));
    const upgrades = entries.reduce((a, [, p]) => a + p, 0);
    return { ...s, table: [...entries, [s.fill, Math.max(0, 1 - upgrades)] as [string, number]] };
  });
}

export type RarityOdds = {
  rarity: string;
  /** probability of at least one in a pack */
  perPack: number;
  /** expected copies per pack */
  expected: number;
  poolSize: number;
  avgValue: number;
  top: Card | null;
};

export function rarityOdds(pack: PackConfig, pool: Pool): RarityOdds[] {
  const miss = new Map<string, number>();
  const expected = new Map<string, number>();
  for (const s of slotTables(pack, pool)) {
    for (const [r, p] of s.table) {
      miss.set(r, (miss.get(r) ?? 1) * (1 - p) ** s.count);
      expected.set(r, (expected.get(r) ?? 0) + p * s.count);
    }
  }
  return [...expected.keys()]
    .map((r) => {
      const cards = pool.get(r) ?? [];
      const reverse = r === REVERSE_KEY;
      const top = [...cards].sort((a, b) => valueOf(b, reverse) - valueOf(a, reverse))[0] ?? null;
      return {
        rarity: reverse ? "Reverse Holo" : r,
        perPack: 1 - (miss.get(r) ?? 1),
        expected: expected.get(r) ?? 0,
        poolSize: cards.length,
        avgValue: avg(cards.map((c) => valueOf(c, reverse))),
        top,
      };
    })
    .sort((a, b) => rarityRank(a.rarity === "Reverse Holo" ? "Rare" : a.rarity) - rarityRank(b.rarity === "Reverse Holo" ? "Rare" : b.rarity) || a.perPack - b.perPack);
}

/** Expected market value of one pack, using the average market price per rarity. */
export function expectedValue(pack: PackConfig, pool: Pool) {
  let ev = 0;
  for (const s of slotTables(pack, pool)) {
    for (const [r, p] of s.table) {
      const cards = pool.get(r) ?? [];
      ev += s.count * p * avg(cards.map((c) => valueOf(c, r === REVERSE_KEY)));
    }
  }
  return ev;
}

/** Odds of pulling one specific card (its rarity's expected copies spread across its pool). */
export function cardOdds(card: Card, odds: RarityOdds[]) {
  const r = odds.find((o) => o.rarity === card.rarity);
  if (!r || !r.poolSize) return 0;
  return r.expected / r.poolSize;
}

export function chaseCards(cards: Card[], n = 6) {
  return [...cards]
    .filter((c) => c.price != null)
    .sort((a, b) => (b.price ?? 0) - (a.price ?? 0))
    .slice(0, n);
}

function rand() {
  const u = new Uint32Array(1);
  crypto.getRandomValues(u);
  return u[0] / 2 ** 32;
}

const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];

/**
 * DEMO draw, done in the browser. In production the pull must come from the
 * vaulted inventory server-side or on-chain (e.g. VRF) so it can be audited.
 */
export function drawPack(pack: PackConfig, pool: Pool): Pull[] {
  const pulls: Pull[] = [];
  for (const s of slotTables(pack, pool)) {
    for (let i = 0; i < s.count; i++) {
      let roll = rand();
      let rarity = s.fill;
      for (const [r, p] of s.table) {
        if (roll < p) {
          rarity = r;
          break;
        }
        roll -= p;
      }
      const reverse = rarity === REVERSE_KEY;
      const candidates = (pool.get(rarity) ?? []).filter((c) => !pulls.some((p) => p.card.id === c.id && p.reverse === reverse));
      const card = pick(candidates.length ? candidates : (pool.get(rarity) ?? pool.get(s.fill) ?? []));
      if (!card) continue;
      pulls.push({
        uid: `${card.id}-${reverse ? "rh" : "n"}-${Date.now().toString(36)}-${Math.floor(rand() * 1e6).toString(36)}`,
        card,
        rarity: reverse ? "Reverse Holo" : card.rarity,
        reverse,
        value: valueOf(card, reverse),
        slot: s.label,
      });
    }
  }
  return pulls;
}

/** Card and pack values in USDC (1 USDC ≈ 1 USD of TCGplayer market price). */
export const fmtUSDC = (n: number) =>
  `${n.toLocaleString("en-US", n >= 1000 ? { maximumFractionDigits: 0 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`;

export const fmtOneIn = (p: number) => {
  if (p <= 0) return "—";
  const n = 1 / p;
  if (n < 1.05) return "every pack";
  return `1 in ${n < 10 ? n.toFixed(1) : Math.round(n).toLocaleString("en-US")}`;
};

export const fmtPct = (p: number) =>
  p >= 0.995 ? "100%" : p >= 0.1 ? `${(p * 100).toFixed(1)}%` : p >= 0.01 ? `${(p * 100).toFixed(2)}%` : `${(p * 100).toFixed(3)}%`;
