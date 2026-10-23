import type { Card } from "./odds";

// Shapes returned by the PokéCast API (numeric columns arrive as strings).

export type ApiItem = {
  id: string;
  card_id: string;
  set_id: string;
  name: string;
  number: string;
  rarity: string;
  reverse: boolean;
  img: string;
  value_at_pull: string;
  hit: boolean;
  source: "pack" | "market";
  status: "vault" | "listed" | "buyback_pending" | "sold" | "shipping" | "shipped";
  sold_for: string | null;
  acquired_at: string;
};

export type ApiListing = {
  id: string;
  price: string;
  seller: string;
  created_at: string;
  reserved_until: string | null;
  item_id: string;
  card_id: string;
  set_id: string;
  name: string;
  number: string;
  rarity: string;
  reverse: boolean;
  img: string;
  value_at_pull: string;
};

export type ApiPayout = { id: number; kind: "buyback" | "cashback"; amount: string; status: "pending" | "paid" | "rejected"; tx_hash: string | null; created_at: string };

export type ApiShipment = { id: string; item_ids: string[]; status: string; tracking: string | null; created_at: string; city: string; country: string };

export type ApiVoucher = { id: number; set_id: string; source: string; created_at: string };

export type VaultData = {
  items: ApiItem[];
  listings: { id: string; item_id: string; price: string; status: string; created_at: string }[];
  payouts: ApiPayout[];
  shipments: ApiShipment[];
  vouchers: ApiVoucher[];
};

/** A pack opened by the server: what PackOpening animates. */
export type OpenedPack = {
  orderId: number;
  setId: string;
  proof: { serverSeedHash: string; clientSeed: string; nonce: number };
  pulls: { uid: string; card: Card; rarity: string; reverse: boolean; value: number; slot: string }[];
};

export type ConfirmResult =
  | { kind: "pack"; opened: OpenedPack[]; checkoutId: string }
  | { kind: "listing"; listingId: string; itemId: string | null }
  | { kind: "shipping"; shipmentId: string }
  | { kind: "unknown" | "mismatch" };

/** What each payout in the queue is for. */
export const PAYOUT_LABEL: Record<string, string> = {
  buyback: "Buyback",
  cashback: "Cashback",
  sale: "PokéMart sale",
  refund: "Refund",
};
