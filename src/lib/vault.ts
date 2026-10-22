"use client";

import { useSyncExternalStore } from "react";
import type { Pull } from "./odds";
import { ECONOMICS, buybackFor } from "./packs";

// DEMO persistence: the vault lives in this browser's localStorage, keyed by
// wallet address. Production keeps it server-side against real inventory.

export type VaultStatus = "vault" | "listed" | "sold" | "shipping";

export type VaultItem = {
  uid: string;
  cardId: string;
  setId: string;
  setName: string;
  name: string;
  number: string;
  rarity: string;
  reverse: boolean;
  value: number;
  img: string;
  pulledAt: number;
  status: VaultStatus;
  soldFor?: number;
  shipmentId?: string;
  listingId?: string;
  /** how the card arrived: a pack rip or a PokéMart purchase */
  source?: "pack" | "market";
};

export type LedgerEntry = {
  id: string;
  type: "pack" | "sellback" | "shipping" | "market";
  amount: number;
  label: string;
  at: number;
};

export type Shipment = {
  id: string;
  at: number;
  items: string[];
  fee: number;
  to: { name: string; city: string; country: string };
};

export type VaultState = { items: VaultItem[]; ledger: LedgerEntry[]; shipments: Shipment[] };

/** Owner key for free demo rips made without a wallet. */
export const DEMO_OWNER = "guest";

const EMPTY: VaultState = { items: [], ledger: [], shipments: [] };
const key = (owner: string) => `hv:vault:v1:${owner.toLowerCase()}`;
const listeners = new Set<() => void>();
const cache = new Map<string, VaultState>();

function read(owner: string): VaultState {
  if (cache.has(owner)) return cache.get(owner)!;
  let state = EMPTY;
  try {
    const raw = localStorage.getItem(key(owner));
    if (raw) state = { ...EMPTY, ...JSON.parse(raw) };
  } catch {}
  cache.set(owner, state);
  return state;
}

function write(owner: string, next: VaultState) {
  cache.set(owner, next);
  try {
    localStorage.setItem(key(owner), JSON.stringify(next));
  } catch {}
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key?.startsWith("hv:vault:")) {
      cache.clear();
      l();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
};

export function useVault(owner: string | undefined) {
  return useSyncExternalStore(
    subscribe,
    () => (owner ? read(owner) : EMPTY),
    () => EMPTY,
  );
}

const id = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export function recordPack(owner: string, pulls: Pull[], meta: { setId: string; setName: string; price: number }) {
  const s = read(owner);
  const now = Date.now();
  const items: VaultItem[] = pulls.map((p) => ({
    uid: p.uid,
    cardId: p.card.id,
    setId: meta.setId,
    setName: meta.setName,
    name: p.card.name,
    number: p.card.number,
    rarity: p.rarity,
    reverse: p.reverse,
    value: p.value,
    img: p.card.img,
    pulledAt: now,
    status: "vault",
  }));
  write(owner, {
    ...s,
    items: [...items, ...s.items],
    ledger: [{ id: id(), type: "pack", amount: -meta.price, label: `${meta.setName} booster pack${meta.price ? "" : " (free demo)"}`, at: now }, ...s.ledger],
  });
}

export const canSellBack = (it: VaultItem, now = Date.now()) =>
  it.status === "vault" && now - it.pulledAt < ECONOMICS.buybackWindowHours * 3_600_000;

export function sellBack(owner: string, uids: string[]) {
  const s = read(owner);
  const now = Date.now();
  let total = 0;
  let count = 0;
  const items = s.items.map((it) => {
    if (!uids.includes(it.uid) || !canSellBack(it, now)) return it;
    const soldFor = buybackFor(it.value);
    total += soldFor;
    count++;
    return { ...it, status: "sold" as const, soldFor };
  });
  write(owner, {
    ...s,
    items,
    ledger: count
      ? [{ id: id(), type: "sellback", amount: Math.round(total * 100) / 100, label: `Sold back ${count} card${count > 1 ? "s" : ""}`, at: now }, ...s.ledger]
      : s.ledger,
  });
  return { total: Math.round(total * 100) / 100, count };
}

export function requestShipment(owner: string, uids: string[], to: Shipment["to"]) {
  const s = read(owner);
  const shipment: Shipment = { id: `PC-${id().toUpperCase()}`, at: Date.now(), items: uids, fee: ECONOMICS.shippingFee, to };
  write(owner, {
    items: s.items.map((it) => (uids.includes(it.uid) && it.status === "vault" ? { ...it, status: "shipping", shipmentId: shipment.id } : it)),
    shipments: [shipment, ...s.shipments],
    ledger: [{ id: id(), type: "shipping", amount: -ECONOMICS.shippingFee, label: `Shipment ${shipment.id}`, at: shipment.at }, ...s.ledger],
  });
  return shipment;
}

// ─────────────────────────────── PokéMart ───────────────────────────────
// DEMO marketplace: player listings live in this browser's localStorage next
// to the vaults, so a listing made with one wallet can be bought with another
// (or the guest vault) on the same device. Production needs an on-chain
// escrow/order book.

export type ListingCard = Pick<VaultItem, "cardId" | "setId" | "setName" | "name" | "number" | "rarity" | "reverse" | "value" | "img">;

export type Listing = ListingCard & {
  id: string;
  seller: string;
  price: number;
  /** ms timestamp; for seeded demo listings, hours ago */
  listedAt: number;
  /** seeded demo listing, not a real player */
  demo: boolean;
  /** vault item behind a player listing */
  uid?: string;
};

type MarketState = { listings: Listing[]; soldDemo: string[] };
const MARKET_KEY = "hv:market:v1";
const EMPTY_MARKET: MarketState = { listings: [], soldDemo: [] };
let market: MarketState | null = null;

function readMarket(): MarketState {
  if (market) return market;
  try {
    const raw = localStorage.getItem(MARKET_KEY);
    market = raw ? { ...EMPTY_MARKET, ...JSON.parse(raw) } : EMPTY_MARKET;
  } catch {
    market = EMPTY_MARKET;
  }
  return market!;
}

function writeMarket(next: MarketState) {
  market = next;
  try {
    localStorage.setItem(MARKET_KEY, JSON.stringify(next));
  } catch {}
  listeners.forEach((l) => l());
}

const subscribeMarket = (l: () => void) => {
  const off = subscribe(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === MARKET_KEY) {
      market = null;
      l();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    off();
    window.removeEventListener("storage", onStorage);
  };
};

export function useMarket() {
  return useSyncExternalStore(subscribeMarket, readMarket, () => EMPTY_MARKET);
}

const round2 = (n: number) => Math.round(n * 100) / 100;
export const marketFee = (price: number) => round2(price * ECONOMICS.marketFee);

export function listForSale(owner: string, uid: string, price: number) {
  const s = read(owner);
  const it = s.items.find((i) => i.uid === uid && i.status === "vault");
  if (!it || !(price > 0)) throw new Error("This card can't be listed");
  const listing: Listing = {
    id: `L-${id()}`,
    seller: owner,
    price: round2(price),
    listedAt: Date.now(),
    demo: false,
    uid,
    cardId: it.cardId,
    setId: it.setId,
    setName: it.setName,
    name: it.name,
    number: it.number,
    rarity: it.rarity,
    reverse: it.reverse,
    value: it.value,
    img: it.img,
  };
  write(owner, { ...s, items: s.items.map((i) => (i.uid === uid ? { ...i, status: "listed", listingId: listing.id } : i)) });
  const m = readMarket();
  writeMarket({ ...m, listings: [listing, ...m.listings] });
  return listing;
}

export function cancelListing(owner: string, listingId: string) {
  const m = readMarket();
  const l = m.listings.find((x) => x.id === listingId && x.seller === owner);
  if (!l) return;
  writeMarket({ ...m, listings: m.listings.filter((x) => x.id !== listingId) });
  const s = read(owner);
  write(owner, {
    ...s,
    items: s.items.map((i) => (i.uid === l.uid ? { ...i, status: "vault", listingId: undefined } : i)),
  });
}

export function buyListing(buyer: string, listing: Listing) {
  if (listing.seller === buyer) throw new Error("That's your own listing");
  const m = readMarket();
  const live = listing.demo ? !m.soldDemo.includes(listing.id) : m.listings.some((x) => x.id === listing.id);
  if (!live) throw new Error("Someone else just bought this card");
  const now = Date.now();

  // seller gets paid, minus the marketplace fee
  if (!listing.demo) {
    const s = read(listing.seller);
    const net = round2(listing.price - marketFee(listing.price));
    write(listing.seller, {
      ...s,
      items: s.items.map((i) => (i.uid === listing.uid ? { ...i, status: "sold", soldFor: net, listingId: undefined } : i)),
      ledger: [{ id: id(), type: "market", amount: net, label: `Sold ${listing.name} on PokéMart`, at: now }, ...s.ledger],
    });
  }
  writeMarket(
    listing.demo
      ? { ...m, soldDemo: [...m.soldDemo, listing.id] }
      : { ...m, listings: m.listings.filter((x) => x.id !== listing.id) },
  );

  const b = read(buyer);
  const item: VaultItem = {
    uid: `${listing.cardId}-m-${id()}`,
    cardId: listing.cardId,
    setId: listing.setId,
    setName: listing.setName,
    name: listing.name,
    number: listing.number,
    rarity: listing.rarity,
    reverse: listing.reverse,
    value: listing.value,
    img: listing.img,
    pulledAt: now,
    status: "vault",
    source: "market",
  };
  write(buyer, {
    ...b,
    items: [item, ...b.items],
    ledger: [{ id: id(), type: "market", amount: -listing.price, label: `Bought ${listing.name} on PokéMart`, at: now }, ...b.ledger],
  });
  return item;
}
