// End-to-end check against a local Hardhat chain + `npm run dev`.
// Uses Hardhat's public test accounts (never use them anywhere real).
// Usage: node scripts/e2e-local.mjs [baseUrl]
import { readFileSync } from "node:fs";
import { createPublicClient, createWalletClient, erc20Abi, formatUnits, http, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hardhat } from "viem/chains";
import { createSiweMessage } from "viem/siwe";

const BASE = process.argv[2] ?? "http://localhost:3311";
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const USDT = env.NEXT_PUBLIC_USDT_ADDRESS;
const TREASURY = env.NEXT_PUBLIC_TREASURY_ADDRESS;

// Hardhat default accounts #0 (admin), #1 (buyer/seller), #2 (second trainer)
const KEYS = {
  admin: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  alice: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  bob: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
};

const pub = createPublicClient({ chain: hardhat, transport: http("http://127.0.0.1:8545") });
let failures = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`);
  if (!cond) failures++;
};
const fails = (p) => p.then(() => null).catch((e) => e);

function trainer(name) {
  const account = privateKeyToAccount(KEYS[name]);
  const wallet = createWalletClient({ account, chain: hardhat, transport: http("http://127.0.0.1:8545") });
  const jar = new Map();
  async function call(path, body) {
    const res = await fetch(BASE + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const c of res.headers.getSetCookie()) {
      const [kv] = c.split(";");
      const [k, v] = kv.split("=");
      if (v) jar.set(k, v);
      else jar.delete(k);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`${path} → ${res.status} ${data.error ?? ""}`);
    return data;
  }
  async function signIn() {
    const { nonce } = await call("/api/auth/nonce");
    const message = createSiweMessage({
      domain: new URL(BASE).host,
      address: account.address,
      statement: "Sign in to PokéCast.",
      uri: BASE,
      version: "1",
      chainId: hardhat.id,
      nonce,
    });
    await call("/api/auth/verify", { message, signature: await account.signMessage({ message }) });
  }
  /** Sends USDT for a checkout (optionally tampered with) and returns the tx hash. */
  async function transfer(checkout, { to = checkout.to, amount = BigInt(checkout.amountWei) } = {}) {
    const hash = await wallet.writeContract({ address: USDT, abi: erc20Abi, functionName: "transfer", args: [to, amount] });
    await pub.waitForTransactionReceipt({ hash });
    return hash;
  }
  const confirm = (checkout, txHash) => call("/api/checkout/confirm", { checkoutId: checkout.checkoutId, txHash });
  const pay = async (checkout) => confirm(checkout, await transfer(checkout));
  const balance = async (addr = account.address) =>
    Number(formatUnits(await pub.readContract({ address: USDT, abi: erc20Abi, functionName: "balanceOf", args: [addr] }), 18));
  return { account, wallet, call, signIn, transfer, confirm, pay, balance };
}

const alice = trainer("alice");
const bob = trainer("bob");
const admin = trainer("admin");

// 1. sign in
await alice.signIn();
await bob.signIn();
const me = await alice.call("/api/auth/me");
ok(me.address === alice.account.address, "SIWE sign-in opens a session");

// 2. buy 2 Mega Evolution packs with a plain USDT transfer to the treasury
const t0 = await alice.balance(TREASURY);
const checkout = await alice.call("/api/checkout/pack", { setId: "me1", quantity: 2 });
ok(checkout.to === TREASURY && BigInt(checkout.amountWei) === parseUnits(checkout.amount.toFixed(6), 18), `checkout: send ${checkout.amount} USDT to the treasury`);
const packTx = await alice.transfer(checkout);
const confirmed = await alice.confirm(checkout, packTx);
const opened = confirmed.results[0].opened;
ok(opened.length === 2 && opened.every((p) => p.pulls.length === 10), "transfer verified → 2 packs opened, 10 cards each");
ok(Math.abs((await alice.balance(TREASURY)) - t0 - checkout.amount) < 1e-9, "treasury received the USDT");
const again = await alice.confirm(checkout, packTx);
ok(again.results[0].opened.length === 0, "confirming twice doesn't open more packs");

// the guarantees the payment contract used to give, now enforced by the server
const second = await alice.call("/api/checkout/pack", { setId: "me1", quantity: 2 });
ok((await fails(alice.confirm(second, packTx)))?.message.includes("409"), "a transaction can't pay two checkouts");
const bobCheckout = await bob.call("/api/checkout/pack", { setId: "me1", quantity: 2 });
ok((await fails(bob.confirm(bobCheckout, packTx))) instanceof Error, "someone else's transfer can't pay your checkout");
const short = await alice.call("/api/checkout/pack", { setId: "me1", quantity: 1 });
const shortTx = await alice.transfer(short, { amount: BigInt(short.amountWei) / 2n });
ok((await fails(alice.confirm(short, shortTx))) instanceof Error, "underpaying is rejected");
const elsewhere = await alice.call("/api/checkout/pack", { setId: "me1", quantity: 1 });
const elsewhereTx = await alice.transfer(elsewhere, { to: bob.account.address });
ok((await fails(alice.confirm(elsewhere, elsewhereTx))) instanceof Error, "a transfer to another wallet is rejected");

const vault1 = await alice.call("/api/vault");
ok(vault1.items.length === 20, "vault holds 20 cards (no duplicate fulfilment)");

// 3. buyback one card
const cheapest = [...vault1.items].sort((a, b) => a.value_at_pull - b.value_at_pull)[0];
const bb = await alice.call("/api/vault/buyback", { itemIds: [cheapest.id] });
ok(bb.count === 1 && bb.total > 0, `buyback queued: ${bb.total} USDT`);

// 4. list the most valuable card, bob buys it through the treasury
const byValue = [...vault1.items].filter((i) => i.status === "vault").sort((a, b) => b.value_at_pull - a.value_at_pull);
const best = byValue[0];
const { listingId } = await alice.call("/api/market/list", { itemId: best.id, price: 20 });
ok(!!listingId, `listed ${best.name} for 20 USDT`);
const lc = await bob.call("/api/market/checkout", { listingId });
const lc2 = await bob.call("/api/market/checkout", { listingId }); // same buyer, second tab
ok(lc.to === TREASURY && lc.fee === 0.5, "market checkout pays the treasury, 2.5% fee");
await bob.pay(lc);
const bobVault = await bob.call("/api/vault");
ok(bobVault.items.some((i) => i.id === best.id && i.source === "market"), "card moved to the buyer's vault");
const sale = (await alice.call("/api/vault")).payouts.find((p) => p.kind === "sale");
ok(sale && Number(sale.amount) === 19.5 && sale.status === "pending", "seller payout of 19.5 USDT queued");
ok((await fails(bob.call("/api/market/checkout", { listingId }))) instanceof Error, "sold listing can't be bought twice");
await bob.pay(lc2);
const refund = (await bob.call("/api/vault")).payouts.find((p) => p.kind === "refund");
ok(refund && Number(refund.amount) === 20, "paying for an already-sold listing queues a full refund");

// 5. missions: first rip → free pack, then open it
const missions = (await alice.call("/api/missions")).missions;
const first = missions.find((m) => m.id === "first-rip");
ok(first.progress === 1 && !first.claimed, "mission 'first broadcast' completed");
await alice.call("/api/missions/claim", { missionId: "first-rip" });
ok((await fails(alice.call("/api/missions/claim", { missionId: "first-rip" }))) instanceof Error, "mission reward can't be claimed twice");
const vouchers = (await alice.call("/api/vault")).vouchers;
ok(vouchers.length === 1 && vouchers[0].set_id === "me1", "free Mega Evolution pack credited");
const free = await alice.call("/api/packs/free", { voucherId: vouchers[0].id });
ok(free.pulls.length === 10, "free pack opened");
const daily = (await alice.call("/api/missions")).missions.find((m) => m.id === "daily-triple");
ok(daily.progress === 3, "daily mission counts 3 packs today");
await alice.call("/api/missions/claim", { missionId: "daily-triple" });

// 6. shipping fee paid on-chain
const shipItem = (await alice.call("/api/vault")).items.find((i) => i.status === "vault");
const sc = await alice.call("/api/vault/ship", {
  itemIds: [shipItem.id],
  to: { name: "Test Trainer", line1: "1 Pallet Town Rd", city: "Pallet", postal: "00001", country: "Kanto" },
});
await alice.pay(sc);
const shipped = (await alice.call("/api/vault")).shipments[0];
ok(shipped.status === "paid", "shipment paid on-chain");

// 7. profile + level
const profile = await alice.call("/api/profile");
ok(profile.packs.paid === 2 && profile.packs.free === 1, "profile counts paid + free packs");
ok(profile.spent === checkout.amount && profile.cashback.balance === 1, "profile tracks spend and mission cashback");

// 8. admin pays the seller and ships the order
await admin.signIn();
const overview = await admin.call("/api/admin/overview");
ok(overview.config.treasury === TREASURY && !("payments" in overview.config), "admin config shows the treasury, no contract");
const payout = overview.payouts.find((p) => p.address === alice.account.address && p.kind === "sale");
ok(!!payout, "seller payout appears in the admin queue");
const fake = await fails(admin.call("/api/admin/payout", { id: payout.id, status: "paid", txHash: packTx }));
ok(fake instanceof Error, "admin can't mark a payout paid with an unrelated tx");
const tx = await admin.wallet.writeContract({
  address: USDT,
  abi: erc20Abi,
  functionName: "transfer",
  args: [alice.account.address, parseUnits(Number(payout.amount).toFixed(6), 18)],
});
await pub.waitForTransactionReceipt({ hash: tx });
await admin.call("/api/admin/payout", { id: payout.id, status: "paid", txHash: tx });
await admin.call("/api/admin/shipment", { id: shipped.id, tracking: "PC123456789" });
const finalVault = await alice.call("/api/vault");
ok(finalVault.payouts.some((p) => p.kind === "sale" && p.status === "paid"), "seller payout marked paid after on-chain check");
ok(finalVault.shipments[0].status === "shipped", "shipment marked shipped with tracking");
ok((await fails(alice.call("/api/admin/overview"))) instanceof Error, "non-admins are locked out of /api/admin");

// 9. tab closed after paying: the sync cron matches the transfer to the checkout
const orphan = await alice.call("/api/checkout/pack", { setId: "me1", quantity: 1 });
await alice.transfer(orphan);
const before = (await alice.call("/api/vault")).items.length;
const sync = await admin.call("/api/cron/sync");
const after = (await alice.call("/api/vault")).items.length;
ok(sync.fulfilled >= 1 && after === before + 10, "sync fulfils a paid checkout that was never confirmed");

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
