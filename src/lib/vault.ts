"use client";

import { useSyncExternalStore } from "react";
import type { Pull } from "./odds";
import { ECONOMICS, buybackFor } from "./packs";

// DEMO persistence: the vault lives in this browser's localStorage, keyed by
// wallet address. Production keeps it server-side against real inventory.

export type VaultStatus = "vault" | "sold" | "shipping";

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
};

export type LedgerEntry = {
  id: string;
  type: "pack" | "sellback" | "shipping";
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
  const shipment: Shipment = { id: `HV-${id().toUpperCase()}`, at: Date.now(), items: uids, fee: ECONOMICS.shippingFee, to };
  write(owner, {
    items: s.items.map((it) => (uids.includes(it.uid) && it.status === "vault" ? { ...it, status: "shipping", shipmentId: shipment.id } : it)),
    shipments: [shipment, ...s.shipments],
    ledger: [{ id: id(), type: "shipping", amount: -ECONOMICS.shippingFee, label: `Shipment ${shipment.id}`, at: shipment.at }, ...s.ledger],
  });
  return shipment;
}
