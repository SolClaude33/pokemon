import "server-only";
import index from "@/data/sets/index.json";
import { priceBook, type PriceBook } from "@/server/prices";
import { CARDS } from "./cards-data";
import { buildPool, cardOdds, rarityOdds, type Card, type DexCard } from "./odds";
import { PACKS, type PackConfig } from "./packs";

export type SetMeta = (typeof index.sets)[number];

export type PackListing = PackConfig & { set: SetMeta };

export const catalogGeneratedAt = index.generatedAt;

function applyPacks(book: PriceBook): PackListing[] {
  return PACKS.flatMap((p) => {
    const set = index.sets.find((s) => s.id === p.setId);
    if (!set) return [];
    const live = book.packs[p.setId];
    return [{ ...p, price: live?.price ?? p.price, set: { ...set, packMarketPrice: live?.market ?? set.packMarketPrice } }];
  });
}

function applyCards(setId: string, book: PriceBook): Card[] {
  return (CARDS[setId] ?? []).map((c) => {
    const live = book.cards[c.id];
    return live ? { ...c, price: live.price ?? c.price, reversePrice: live.reverse ?? c.reversePrice } : c;
  });
}

/** When prices were last refreshed (falls back to the catalog snapshot date). */
export async function pricesUpdatedAt() {
  return (await priceBook()).updatedAt ?? index.generatedAt;
}

export async function listPacks(book?: PriceBook): Promise<PackListing[]> {
  return applyPacks(book ?? (await priceBook()));
}

export function getPackSync(setId: string, book: PriceBook) {
  const listing = applyPacks(book).find((p) => p.setId === setId);
  if (!listing) return null;
  return { listing, cards: applyCards(setId, book) };
}

export async function getPack(setId: string, book?: PriceBook) {
  return getPackSync(setId, book ?? (await priceBook()));
}

/** Every card that can come out of a listed pack, with its per-pack odds. */
export async function listDexCards(): Promise<DexCard[]> {
  const book = await priceBook();
  return applyPacks(book).flatMap((p) => {
    const cards = applyCards(p.setId, book);
    const odds = rarityOdds(p, buildPool(cards));
    return cards.map((c) => ({
      id: c.id,
      number: c.number,
      name: c.name,
      rarity: c.rarity,
      supertype: c.supertype,
      price: c.price,
      img: c.img,
      setId: p.setId,
      setName: p.set.name,
      packPrice: p.price,
      odds: cardOdds(c, odds),
    }));
  });
}

/** Looks up a card by id across all sets (with live prices when a book is given). */
export function findCard(cardId: string, book?: PriceBook) {
  const setId = Object.keys(CARDS).find((s) => CARDS[s].some((c) => c.id === cardId));
  if (!setId) return null;
  const card = (book ? applyCards(setId, book) : CARDS[setId]).find((c) => c.id === cardId)!;
  return { setId, card };
}
