import "server-only";
import { getAddress, type Address, type Hash, type Hex } from "viem";
import { getPack } from "@/lib/catalog";
import { levelFor, MIN_CASHBACK_WITHDRAWAL } from "@/lib/levels";
import { goalTarget, MISSIONS, periodWindow, type Mission } from "@/lib/missions";
import { buildPool, drawPack } from "@/lib/odds";
import { ECONOMICS, buybackFor, packBySetId } from "@/lib/packs";
import { rarityMeta } from "@/lib/rarity";
import { toUnits, treasury, verifyPayment, type TreasuryTransfer } from "./chain";
import { num, one, q } from "./db";
import { fairRng, newClientSeed, newServerSeed } from "./fair";
import { livePriceBook } from "./prices";
import { HttpError } from "./session";

const MAX_PACKS_PER_CHECKOUT = 10;
const CHECKOUT_MINUTES = 15;
const LISTING_HOLD_MINUTES = 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

// ─────────────────────────────── users ───────────────────────────────

type UserRow = {
  address: string;
  created_at: Date;
  server_seed: string;
  server_seed_hash: string;
  client_seed: string;
  nonce: number;
  previous_server_seed: string | null;
  total_spent: string;
  cashback_balance: string;
  cashback_earned: string;
};

export async function ensureUser(address: Address) {
  const s = newServerSeed();
  await q(
    `insert into users (address, server_seed, server_seed_hash, client_seed) values ($1, $2, $3, $4) on conflict do nothing`,
    [address, s.seed, s.hash, newClientSeed()],
  );
}

async function user(address: Address) {
  await ensureUser(address);
  return (await one<UserRow>("select * from users where address = $1", [address]))!;
}

/** Reveals the current server seed and starts a new one (provably fair rotation). */
export async function rotateSeed(address: Address, clientSeed?: string) {
  const u = await user(address);
  const s = newServerSeed();
  const cs = clientSeed?.trim().slice(0, 64) || u.client_seed;
  await q(
    `update users set previous_server_seed = server_seed, server_seed = $2, server_seed_hash = $3, client_seed = $4, nonce = 0 where address = $1`,
    [address, s.seed, s.hash, cs],
  );
  return { revealed: u.server_seed, revealedHash: u.server_seed_hash, newHash: s.hash, clientSeed: cs };
}

// ─────────────────────────────── packs ───────────────────────────────

export type ItemRow = {
  id: string;
  address: string;
  card_id: string;
  set_id: string;
  name: string;
  number: string;
  rarity: string;
  reverse: boolean;
  img: string;
  value_at_pull: string;
  order_id: number | null;
  slot: string | null;
  hit: boolean;
  source: string;
  status: string;
  sold_for: string | null;
  acquired_at: Date;
};

/** Opens one pack with the user's provably fair seeds and puts the cards in their vault. */
async function openPack(address: Address, setId: string, opts: { checkoutId?: string; voucherId?: number; price: number; cashback: number }) {
  const book = await livePriceBook();
  const data = await getPack(setId, book);
  const pack = packBySetId(setId);
  if (!data || !pack) throw new HttpError(404, "Unknown pack");

  // claim the next nonce atomically
  const u = (await one<{ nonce: number; server_seed: string; server_seed_hash: string; client_seed: string }>(
    `update users set nonce = nonce + 1 where address = $1 returning nonce - 1 as nonce, server_seed, server_seed_hash, client_seed`,
    [address],
  ))!;
  const pulls = drawPack(data.listing, buildPool(data.cards), fairRng(u.server_seed, u.client_seed, u.nonce));

  const [order] = await q<{ id: number }>(
    `insert into orders (address, set_id, checkout_id, voucher_id, price, cashback, server_seed_hash, client_seed, nonce)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id`,
    [address, setId, opts.checkoutId ?? null, opts.voucherId ?? null, opts.price, opts.cashback, u.server_seed_hash, u.client_seed, u.nonce],
  );
  const minor = new Set(pack.minorRarities ?? []);
  const rows = pulls.map((p) => ({
    id: crypto.randomUUID(),
    card: p.card,
    rarity: p.rarity,
    reverse: p.reverse,
    value: p.value,
    slot: p.slot,
    hit: !p.reverse && rarityMeta(p.rarity).hit && !minor.has(p.rarity),
  }));
  await q(
    `insert into items (id, address, card_id, set_id, name, number, rarity, reverse, img, value_at_pull, order_id, slot, hit, source)
     select t.id, $1, t.card_id, $2, t.name, t.number, t.rarity, t.reverse, t.img, t.value, $3, t.slot, t.hit, 'pack'
     from unnest($4::text[], $5::text[], $6::text[], $7::text[], $8::text[], $9::boolean[], $10::text[], $11::numeric[], $12::text[], $13::boolean[])
       as t(id, card_id, name, number, rarity, reverse, img, value, slot, hit)`,
    [
      address,
      setId,
      order.id,
      rows.map((r) => r.id),
      rows.map((r) => r.card.id),
      rows.map((r) => r.card.name),
      rows.map((r) => r.card.number),
      rows.map((r) => r.rarity),
      rows.map((r) => r.reverse),
      rows.map((r) => r.card.img),
      rows.map((r) => r.value),
      rows.map((r) => r.slot),
      rows.map((r) => r.hit),
    ],
  );
  return {
    orderId: order.id,
    setId,
    proof: { serverSeedHash: u.server_seed_hash, clientSeed: u.client_seed, nonce: u.nonce },
    pulls: rows.map((r) => ({
      uid: r.id,
      card: r.card,
      rarity: r.rarity,
      reverse: r.reverse,
      value: r.value,
      slot: r.slot,
    })),
  };
}

export type OpenedPack = Awaited<ReturnType<typeof openPack>>;

/** Opens a checkout the user pays with a plain USDT transfer to the treasury. */
async function createCheckout(
  address: Address,
  c: { kind: "pack" | "listing" | "shipping"; ref: string; quantity: number; amount: number; fee?: number; payee?: string | null; minutes: number; meta: CheckoutRow["meta"] },
) {
  const to = treasury();
  const id = crypto.randomUUID();
  await q(
    `insert into checkouts (id, address, kind, ref, quantity, amount, fee, payee, deadline, meta)
     values ($1, $2, $3, $4, $5, $6, $7, $8, now() + make_interval(mins => $9), $10)`,
    [id, address, c.kind, c.ref, c.quantity, c.amount, c.fee ?? 0, c.payee ?? null, c.minutes, JSON.stringify(c.meta)],
  );
  return { checkoutId: id, to, amount: c.amount, amountWei: toUnits(c.amount).toString() };
}

export type Checkout = Awaited<ReturnType<typeof createCheckout>>;

/** Prices a pack checkout the user then pays on-chain. */
export async function checkoutPacks(address: Address, setId: string, quantity: number) {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_PACKS_PER_CHECKOUT)
    throw new HttpError(400, `Buy between 1 and ${MAX_PACKS_PER_CHECKOUT} packs at a time`);
  const book = await livePriceBook();
  const data = await getPack(setId, book);
  if (!data) throw new HttpError(404, "Unknown pack");
  await ensureUser(address);
  const unit = data.listing.price;
  const amount = round2(unit * quantity);
  const checkout = await createCheckout(address, { kind: "pack", ref: setId, quantity, amount, minutes: CHECKOUT_MINUTES, meta: { unitPrice: unit } });
  return { ...checkout, unitPrice: unit };
}

/** Opens a free pack earned from a mission. */
export async function openVoucher(address: Address, voucherId: number) {
  const v = await one<{ id: number; set_id: string }>(
    `update vouchers set status = 'used' where id = $1 and address = $2 and status = 'available' returning id, set_id`,
    [voucherId, address],
  );
  if (!v) throw new HttpError(404, "That free pack was already used");
  const opened = await openPack(address, v.set_id, { voucherId: v.id, price: 0, cashback: 0 });
  await q("update vouchers set used_order_id = $2 where id = $1", [v.id, opened.orderId]);
  return opened;
}

// ─────────────────────────────── confirm payments ───────────────────────────────

type CheckoutRow = {
  id: string;
  address: string;
  kind: string;
  ref: string;
  quantity: number;
  amount: string;
  fee: string;
  payee: string | null;
  status: string;
  tx_hash: string | null;
  created_at: Date;
  meta: { unitPrice?: number; itemIds?: string[]; shipmentId?: string; listingId?: string };
};

/** Money that arrived for something no longer available goes back through the payout queue. */
async function refund(c: CheckoutRow, reason: string) {
  await q(`insert into payouts (address, kind, amount, note) values ($1, 'refund', $2, $3)`, [getAddress(c.address), num(c.amount), reason]);
}

/** Turns a paid checkout into packs, a market transfer or a shipment. Idempotent. */
async function fulfil(checkoutId: string) {
  const c = await one<CheckoutRow>("select * from checkouts where id = $1", [checkoutId]);
  if (!c || c.status === "pending") return { kind: "unknown" as const };
  const address = getAddress(c.address);

  if (c.kind === "pack") {
    const done = await q<{ id: number }>("select id from orders where checkout_id = $1", [c.id]);
    const opened: OpenedPack[] = [];
    if (done.length < c.quantity) {
      const u = await user(address);
      const before = num(u.total_spent);
      const rate = levelFor(before).current.cashback;
      const unit = c.meta.unitPrice ?? num(c.amount) / c.quantity;
      if (done.length === 0) {
        const cashback = round2(num(c.amount) * rate);
        await q(
          `update users set total_spent = total_spent + $2, cashback_balance = cashback_balance + $3, cashback_earned = cashback_earned + $3 where address = $1`,
          [address, num(c.amount), cashback],
        );
      }
      for (let i = done.length; i < c.quantity; i++)
        opened.push(await openPack(address, c.ref, { checkoutId: c.id, price: unit, cashback: round2(unit * rate) }));
    }
    await q(`update checkouts set status = 'fulfilled' where id = $1`, [c.id]);
    return { kind: "pack" as const, opened, checkoutId: c.id };
  }

  // the paid → fulfilled flip makes the side effects below run exactly once
  const claimed = await one(`update checkouts set status = 'fulfilled' where id = $1 and status = 'paid' returning id`, [c.id]);

  if (c.kind === "listing") {
    const listingId = c.meta.listingId ?? c.ref;
    if (!claimed) {
      const l = await one<{ item_id: string }>("select item_id from listings where checkout_id = $1", [c.id]);
      return { kind: "listing" as const, listingId, itemId: l?.item_id ?? null, refunded: !l };
    }
    // the buyer's hold may have lapsed while the transaction was mining: still theirs unless someone else took it
    const l = await one<{ id: string; item_id: string; seller: string }>(
      `update listings set status = 'sold', buyer = $2, sold_at = now(), checkout_id = $3
        where id = $1 and status = 'active' and seller <> $2
          and (reserved_by = $2 or reserved_until is null or reserved_until < now())
        returning id, item_id, seller`,
      [listingId, address, c.id],
    );
    if (!l) {
      await refund(c, `Listing ${listingId} was no longer available`);
      return { kind: "listing" as const, listingId, itemId: null, refunded: true };
    }
    await q(`update items set address = $2, status = 'vault', source = 'market', acquired_at = now(), sold_for = null where id = $1`, [
      l.item_id,
      address,
    ]);
    // the seller is paid from the treasury, minus the PokéMart fee
    await q(`insert into payouts (address, kind, amount, item_ids, note) values ($1, 'sale', $2, $3, $4)`, [
      getAddress(l.seller),
      round2(num(c.amount) - num(c.fee)),
      [l.item_id],
      `PokéMart sale ${listingId}`,
    ]);
    return { kind: "listing" as const, listingId, itemId: l.item_id, refunded: false };
  }

  if (c.kind === "shipping") {
    const shipmentId = c.meta.shipmentId ?? c.ref;
    if (!claimed) return { kind: "shipping" as const, shipmentId };
    const s = await one<{ item_ids: string[] }>(
      `update shipments set status = 'paid' where id = $1 and status = 'awaiting_payment' returning item_ids`,
      [shipmentId],
    );
    if (!s) {
      await refund(c, `Shipment ${shipmentId} was no longer awaiting payment`);
      return { kind: "shipping" as const, shipmentId, refunded: true };
    }
    await q(`update items set status = 'shipping' where id = any($1) and address = $2 and status = 'vault'`, [s.item_ids, address]);
    return { kind: "shipping" as const, shipmentId };
  }
  return { kind: "unknown" as const };
}

const isUniqueViolation = (e: unknown) => (e as { code?: string })?.code === "23505";

/** Marks a checkout paid by `txHash` (pending → paid once; a transaction pays one checkout only). */
async function markPaid(checkoutId: string, txHash: Hash) {
  try {
    return !!(await one(`update checkouts set status = 'paid', tx_hash = $2, paid_at = now() where id = $1 and status = 'pending' returning id`, [
      checkoutId,
      txHash.toLowerCase(),
    ]));
  } catch (e) {
    if (isUniqueViolation(e)) throw new HttpError(409, "That transaction was already used for another payment");
    throw e;
  }
}

/** Called by the browser once its USDT transfer to the treasury has been mined. */
export async function confirmPayment(address: Address, checkoutId: string, txHash: Hash) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash ?? "")) throw new HttpError(400, "Invalid transaction hash");
  const c = await one<CheckoutRow>("select * from checkouts where id = $1 and address = $2", [String(checkoutId), address]);
  if (!c) throw new HttpError(404, "Checkout not found");
  if (c.status === "pending") {
    await verifyPayment(txHash, address, num(c.amount), new Date(c.created_at));
    await markPaid(c.id, txHash);
  }
  const paid = await one<{ tx_hash: string }>("select tx_hash from checkouts where id = $1", [c.id]);
  if (paid?.tx_hash !== txHash.toLowerCase()) throw new HttpError(409, "This checkout was paid by another transaction");
  return fulfil(c.id);
}

/**
 * Catches payments whose browser tab closed before confirming (cron): matches recent
 * treasury transfers to pending checkouts of the same wallet and exact amount.
 */
export async function reconcile(transfers: TreasuryTransfer[]) {
  let fulfilled = 0;
  for (const t of transfers) {
    if (await one("select id from checkouts where tx_hash = $1", [t.txHash.toLowerCase()])) continue;
    const pending = await q<CheckoutRow>(
      `select * from checkouts where address = $1 and status = 'pending' and created_at <= $2::timestamptz + interval '5 minutes' order by created_at`,
      [t.from, t.minedAt],
    );
    const c = pending.find((p) => toUnits(num(p.amount)) === t.value);
    if (c && (await markPaid(c.id, t.txHash).catch(() => false))) {
      await fulfil(c.id);
      fulfilled++;
    }
  }
  // paid but interrupted before fulfilment
  for (const c of await q<{ id: string }>("select id from checkouts where status = 'paid'")) {
    await fulfil(c.id);
    fulfilled++;
  }
  return { scanned: transfers.length, fulfilled };
}

// ─────────────────────────────── vault ───────────────────────────────

export async function vault(address: Address) {
  const [items, listings, payouts, shipments, vouchers] = await Promise.all([
    q<ItemRow>("select * from items where address = $1 order by acquired_at desc", [address]),
    q("select * from listings where seller = $1 order by created_at desc limit 100", [address]),
    q("select * from payouts where address = $1 order by created_at desc limit 50", [address]),
    q("select id, item_ids, status, tracking, created_at, city, country from shipments where address = $1 order by created_at desc", [address]),
    q("select id, set_id, source, created_at from vouchers where address = $1 and status = 'available' order by created_at", [address]),
  ]);
  return { items, listings, payouts, shipments, vouchers };
}

const canBuyBack = (it: ItemRow) =>
  it.status === "vault" && Date.now() - new Date(it.acquired_at).getTime() < ECONOMICS.buybackWindowHours * 3_600_000;

/** Instant buyback: the cards leave the vault and a USDT payout is queued for the admin. */
export async function requestBuyback(address: Address, itemIds: string[]) {
  if (!itemIds.length) throw new HttpError(400, "Pick at least one card");
  const items = await q<ItemRow>("select * from items where address = $1 and id = any($2)", [address, itemIds]);
  const eligible = items.filter(canBuyBack);
  if (!eligible.length) throw new HttpError(400, `Buyback is available for ${ECONOMICS.buybackWindowHours}h after a pull`);
  const book = await livePriceBook();
  let total = 0;
  for (const it of eligible) {
    const live = book.cards[it.card_id];
    const value = (it.reverse ? (live?.reverse ?? live?.price) : live?.price) ?? num(it.value_at_pull);
    const offer = buybackFor(value);
    total += offer;
    await q(`update items set status = 'buyback_pending', sold_for = $3 where id = $1 and address = $2 and status = 'vault'`, [
      it.id,
      address,
      offer,
    ]);
  }
  total = round2(total);
  await q(`insert into payouts (address, kind, amount, item_ids) values ($1, 'buyback', $2, $3)`, [
    address,
    total,
    eligible.map((i) => i.id),
  ]);
  return { total, count: eligible.length };
}

export async function withdrawCashback(address: Address) {
  const u = await user(address);
  const bal = num(u.cashback_balance);
  if (bal < MIN_CASHBACK_WITHDRAWAL) throw new HttpError(400, `You can withdraw from ${MIN_CASHBACK_WITHDRAWAL} USDT of cashback`);
  const r = await one<{ amount: string }>(
    `update users set cashback_balance = 0 where address = $1 and cashback_balance = $2 returning $2::numeric as amount`,
    [address, bal],
  );
  if (!r) throw new HttpError(409, "Balance changed, try again");
  await q(`insert into payouts (address, kind, amount) values ($1, 'cashback', $2)`, [address, bal]);
  return { amount: bal };
}

export type ShipTo = { name: string; line1: string; city: string; postal: string; country: string };

/** Creates a shipment and signs its shipping-fee checkout. */
export async function checkoutShipment(address: Address, itemIds: string[], to: ShipTo) {
  for (const k of ["name", "line1", "city", "postal", "country"] as const)
    if (!to[k]?.trim()) throw new HttpError(400, "Fill in every address field");
  const items = await q<ItemRow>("select * from items where address = $1 and id = any($2) and status = 'vault'", [address, itemIds]);
  if (!items.length) throw new HttpError(400, "Pick cards that are in your vault");
  const shipmentId = `PC-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  await q(
    `insert into shipments (id, address, item_ids, name, line1, city, postal, country) values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [shipmentId, address, items.map((i) => i.id), to.name.trim(), to.line1.trim(), to.city.trim(), to.postal.trim(), to.country.trim()],
  );
  const amount = ECONOMICS.shippingFee;
  const checkout = await createCheckout(address, {
    kind: "shipping",
    ref: shipmentId,
    quantity: items.length,
    amount,
    minutes: CHECKOUT_MINUTES,
    meta: { shipmentId },
  });
  await q("update shipments set checkout_id = $2 where id = $1", [shipmentId, checkout.checkoutId]);
  return { ...checkout, shipmentId };
}

// ─────────────────────────────── market ───────────────────────────────

export async function listItem(address: Address, itemId: string, price: number) {
  if (!(price >= 0.5 && price <= 1_000_000)) throw new HttpError(400, "Price must be between 0.50 and 1,000,000 USDT");
  const it = await one<ItemRow>(`update items set status = 'listed' where id = $1 and address = $2 and status = 'vault' returning *`, [
    itemId,
    address,
  ]);
  if (!it) throw new HttpError(400, "That card isn't in your vault");
  const id = crypto.randomUUID().slice(0, 12);
  await q(`insert into listings (id, item_id, seller, price) values ($1, $2, $3, $4)`, [id, itemId, address, round2(price)]);
  return { listingId: id };
}

export async function cancelListing(address: Address, listingId: string) {
  const l = await one<{ item_id: string }>(
    `update listings set status = 'cancelled' where id = $1 and seller = $2 and status = 'active'
       and (reserved_until is null or reserved_until < now()) returning item_id`,
    [listingId, address],
  );
  if (!l) throw new HttpError(409, "Listing can't be cancelled right now (someone may be paying for it)");
  await q(`update items set status = 'vault' where id = $1 and address = $2`, [l.item_id, address]);
  return { ok: true };
}

export async function marketListings() {
  return q(
    `select l.id, l.price, l.seller, l.created_at, l.reserved_until, i.id as item_id, i.card_id, i.set_id, i.name, i.number,
            i.rarity, i.reverse, i.img, i.value_at_pull
       from listings l join items i on i.id = l.item_id
      where l.status = 'active' order by l.created_at desc limit 500`,
  );
}

/** Holds a listing for the buyer, who pays the treasury; the seller is paid from the payout queue. */
export async function checkoutListing(address: Address, listingId: string) {
  treasury();
  const l = await one<{ id: string; seller: string; price: string }>(
    `update listings set reserved_by = $2, reserved_until = now() + interval '${LISTING_HOLD_MINUTES} minutes'
      where id = $1 and status = 'active' and seller <> $2
        and (reserved_until is null or reserved_until < now() or reserved_by = $2)
      returning id, seller, price`,
    [listingId, address],
  );
  if (!l) throw new HttpError(409, "That card is no longer available (sold, cancelled or being bought)");
  await ensureUser(address);
  const price = num(l.price);
  const fee = round2(price * ECONOMICS.marketFee);
  const checkout = await createCheckout(address, {
    kind: "listing",
    ref: l.id,
    quantity: 1,
    amount: price,
    fee,
    payee: l.seller,
    minutes: LISTING_HOLD_MINUTES,
    meta: { listingId: l.id },
  });
  return { ...checkout, price, fee };
}

// ─────────────────────────────── missions ───────────────────────────────

async function missionProgress(address: Address, m: Mission) {
  const { start } = periodWindow(m.period);
  const g = m.goal;
  if (g.type === "packs") {
    const r = await one<{ n: string }>(
      `select count(*)::text as n from orders where address = $1 and created_at >= $2 ${g.setId ? "and set_id = $3" : ""}`,
      g.setId ? [address, start, g.setId] : [address, start],
    );
    return num(r?.n);
  }
  if (g.type === "sets") {
    const r = await one<{ n: string }>(`select count(distinct set_id)::text as n from orders where address = $1 and created_at >= $2`, [address, start]);
    return num(r?.n);
  }
  if (g.type === "hits") {
    const r = await one<{ n: string }>(
      `select count(*)::text as n from items i join orders o on o.id = i.order_id where o.address = $1 and i.hit and o.created_at >= $2`,
      [address, start],
    );
    return num(r?.n);
  }
  if (g.type === "spent") {
    const r = await one<{ n: string }>(
      `select coalesce(sum(amount), 0)::text as n from checkouts where address = $1 and kind = 'pack' and paid_at is not null and paid_at >= $2`,
      [address, start],
    );
    return num(r?.n);
  }
  const r = await one<{ n: string }>(`select count(*)::text as n from listings where seller = $1 and status = 'sold' and sold_at >= $2`, [address, start]);
  return num(r?.n);
}

export async function missions(address: Address | null) {
  const claims = address
    ? await q<{ mission_id: string; period_key: string }>("select mission_id, period_key from mission_claims where address = $1", [address])
    : [];
  return Promise.all(
    MISSIONS.map(async (m) => {
      const w = periodWindow(m.period);
      const progress = address ? await missionProgress(address, m) : 0;
      const target = goalTarget(m.goal);
      return {
        ...m,
        progress: Math.min(progress, target),
        target,
        claimed: claims.some((c) => c.mission_id === m.id && c.period_key === w.key),
        resetsAt: w.resetsAt?.toISOString() ?? null,
      };
    }),
  );
}

export async function claimMission(address: Address, missionId: string) {
  const m = MISSIONS.find((x) => x.id === missionId);
  if (!m) throw new HttpError(404, "Unknown mission");
  const w = periodWindow(m.period);
  if ((await missionProgress(address, m)) < goalTarget(m.goal)) throw new HttpError(400, "Mission not completed yet");
  const inserted = await q(
    `insert into mission_claims (address, mission_id, period_key) values ($1, $2, $3) on conflict do nothing returning mission_id`,
    [address, m.id, w.key],
  );
  if (!inserted.length) throw new HttpError(409, "Reward already claimed");
  await ensureUser(address);
  if (m.reward.type === "pack") {
    await q(`insert into vouchers (address, set_id, source) values ($1, $2, $3)`, [address, m.reward.setId, `${m.id}:${w.key}`]);
  } else {
    await q(`update users set cashback_balance = cashback_balance + $2, cashback_earned = cashback_earned + $2 where address = $1`, [
      address,
      m.reward.amount,
    ]);
  }
  return { reward: m.reward };
}

// ─────────────────────────────── profile ───────────────────────────────

export async function profile(address: Address) {
  const u = await user(address);
  const [orders, pulled, best, sales, buys, buybacks, raritySplit, recent] = await Promise.all([
    one<{ paid: string; free: string; sets: string; fav: string | null }>(
      `select count(*) filter (where checkout_id is not null)::text as paid, count(*) filter (where voucher_id is not null)::text as free,
              count(distinct set_id)::text as sets, mode() within group (order by set_id) as fav
         from orders where address = $1`,
      [address],
    ),
    one<{ cards: string; value: string; hits: string }>(
      `select count(*)::text as cards, coalesce(sum(i.value_at_pull), 0)::text as value, count(*) filter (where i.hit)::text as hits
         from items i join orders o on o.id = i.order_id where o.address = $1`,
      [address],
    ),
    one<{ name: string; rarity: string; img: string; value_at_pull: string; set_id: string; card_id: string }>(
      `select i.name, i.rarity, i.img, i.value_at_pull, i.set_id, i.card_id from items i join orders o on o.id = i.order_id
        where o.address = $1 order by i.value_at_pull desc limit 1`,
      [address],
    ),
    one<{ n: string; total: string }>(
      `select count(*)::text as n, coalesce(sum(price), 0)::text as total from listings where seller = $1 and status = 'sold'`,
      [address],
    ),
    one<{ n: string; total: string }>(
      `select count(*)::text as n, coalesce(sum(price), 0)::text as total from listings where buyer = $1 and status = 'sold'`,
      [address],
    ),
    one<{ paid: string; pending: string }>(
      `select coalesce(sum(amount) filter (where status = 'paid'), 0)::text as paid, coalesce(sum(amount) filter (where status = 'pending'), 0)::text as pending
         from payouts where address = $1 and kind = 'buyback'`,
      [address],
    ),
    q<{ rarity: string; n: string }>(
      `select i.rarity, count(*)::text as n from items i join orders o on o.id = i.order_id where o.address = $1 group by i.rarity`,
      [address],
    ),
    q<{ id: number; set_id: string; price: string; created_at: Date; best_name: string; best_value: string; best_rarity: string }>(
      `select o.id, o.set_id, o.price, o.created_at,
              (select name from items where order_id = o.id order by value_at_pull desc limit 1) as best_name,
              (select value_at_pull from items where order_id = o.id order by value_at_pull desc limit 1) as best_value,
              (select rarity from items where order_id = o.id order by value_at_pull desc limit 1) as best_rarity
         from orders o where o.address = $1 order by o.created_at desc limit 12`,
      [address],
    ),
  ]);
  const spent = num(u.total_spent);
  return {
    address,
    memberSince: u.created_at,
    spent,
    level: levelFor(spent),
    cashback: { balance: num(u.cashback_balance), earned: num(u.cashback_earned), min: MIN_CASHBACK_WITHDRAWAL },
    packs: { paid: num(orders?.paid), free: num(orders?.free), sets: num(orders?.sets), favoriteSet: orders?.fav ?? null },
    pulls: { cards: num(pulled?.cards), value: num(pulled?.value), hits: num(pulled?.hits) },
    best: best ? { ...best, value: num(best.value_at_pull) } : null,
    market: { sold: num(sales?.n), soldTotal: num(sales?.total), bought: num(buys?.n), boughtTotal: num(buys?.total) },
    buyback: { paid: num(buybacks?.paid), pending: num(buybacks?.pending) },
    rarities: raritySplit.map((r) => ({ rarity: r.rarity, count: num(r.n) })),
    recent: recent.map((r) => ({
      id: r.id,
      setId: r.set_id,
      price: num(r.price),
      at: r.created_at,
      best: r.best_name ? { name: r.best_name, value: num(r.best_value), rarity: r.best_rarity } : null,
    })),
    fair: { serverSeedHash: u.server_seed_hash, clientSeed: u.client_seed, nonce: u.nonce, previousServerSeed: u.previous_server_seed },
  };
}

// ─────────────────────────────── admin ───────────────────────────────

export async function adminOverview() {
  const [payouts, shipments, stats] = await Promise.all([
    q("select * from payouts where status = 'pending' order by created_at"),
    q(
      `select s.*, (select json_agg(json_build_object('name', i.name, 'number', i.number, 'set_id', i.set_id, 'rarity', i.rarity, 'reverse', i.reverse))
                      from items i where i.id = any(s.item_ids)) as items
         from shipments s where s.status = 'paid' order by s.created_at`,
    ),
    one<{ revenue: string; packs: string; users: string }>(
      `select (select coalesce(sum(amount), 0) from checkouts where kind = 'pack' and paid_at is not null)::text as revenue,
              (select count(*) from orders)::text as packs, (select count(*) from users)::text as users`,
    ),
  ]);
  return { payouts, shipments, stats };
}

export async function markPayout(id: number, status: "paid" | "rejected", txHash?: Hex, note?: string) {
  const p = await one<{ address: string; kind: string; amount: string; item_ids: string[] }>(
    `update payouts set status = $2, tx_hash = $3, note = $4, paid_at = case when $2 = 'paid' then now() else null end
      where id = $1 and status = 'pending' returning address, kind, amount, item_ids`,
    [id, status, txHash ?? null, note ?? null],
  );
  if (!p) throw new HttpError(409, "Payout already processed");
  if (p.kind === "buyback") {
    if (status === "paid") await q(`update items set status = 'sold' where id = any($1)`, [p.item_ids]);
    else await q(`update items set status = 'vault', sold_for = null where id = any($1)`, [p.item_ids]);
  } else if (p.kind === "cashback" && status === "rejected") {
    await q(`update users set cashback_balance = cashback_balance + $2 where address = $1`, [p.address, num(p.amount)]);
  }
  return p;
}

export async function markShipped(id: string, tracking: string) {
  const s = await one<{ item_ids: string[] }>(
    `update shipments set status = 'shipped', tracking = $2 where id = $1 and status = 'paid' returning item_ids`,
    [id, tracking],
  );
  if (!s) throw new HttpError(409, "Shipment not found or already shipped");
  await q(`update items set status = 'shipped' where id = any($1)`, [s.item_ids]);
}
