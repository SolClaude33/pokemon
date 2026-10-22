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
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const USDT = env.NEXT_PUBLIC_USDT_ADDRESS;
const PAYMENTS = env.NEXT_PUBLIC_PAYMENTS_ADDRESS;
const abi = JSON.parse(readFileSync(new URL("../contracts/artifacts/contracts/PokeCastPayments.sol/PokeCastPayments.json", import.meta.url), "utf8")).abi;

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
  async function pay({ payment, signature }) {
    const amount = BigInt(payment.amount);
    const approve = await wallet.writeContract({ address: USDT, abi: erc20Abi, functionName: "approve", args: [PAYMENTS, amount] });
    await pub.waitForTransactionReceipt({ hash: approve });
    const hash = await wallet.writeContract({
      address: PAYMENTS,
      abi,
      functionName: "pay",
      args: [{ ...payment, amount, fee: BigInt(payment.fee), deadline: BigInt(payment.deadline) }, signature],
    });
    await pub.waitForTransactionReceipt({ hash });
    return call("/api/checkout/confirm", { txHash: hash });
  }
  const balance = async (addr = account.address) =>
    Number(formatUnits(await pub.readContract({ address: USDT, abi: erc20Abi, functionName: "balanceOf", args: [addr] }), 18));
  return { account, wallet, call, signIn, pay, balance };
}

const alice = trainer("alice");
const bob = trainer("bob");
const admin = trainer("admin");

// 1. sign in
await alice.signIn();
const me = await alice.call("/api/auth/me");
ok(me.address === alice.account.address, "SIWE sign-in opens a session");

// 2. buy 2 Mega Evolution packs on-chain
const treasury = env.NEXT_PUBLIC_TREASURY_ADDRESS;
const t0 = await alice.balance(treasury);
const checkout = await alice.call("/api/checkout/pack", { setId: "me1", quantity: 2 });
ok(checkout.amount > 0 && checkout.payment.quantity === 2, `checkout signed: 2 packs for ${checkout.amount} USDT`);
const confirmed = await alice.pay(checkout);
const opened = confirmed.results[0].opened;
ok(opened.length === 2 && opened.every((p) => p.pulls.length === 10), "payment confirmed → 2 packs opened, 10 cards each");
ok(Math.abs((await alice.balance(treasury)) - t0 - checkout.amount) < 1e-9, "treasury received the USDT");

// replaying the confirmation must not open more packs
const again = await alice.call("/api/checkout/confirm", { txHash: (await pub.getBlock()).transactions[0] }).catch((e) => e);
const vault1 = await alice.call("/api/vault");
ok(vault1.items.length === 20, `vault holds 20 cards (no duplicate fulfilment)${again instanceof Error ? "" : ""}`);

// 3. buyback one card
const cheapest = [...vault1.items].sort((a, b) => a.value_at_pull - b.value_at_pull)[0];
const bb = await alice.call("/api/vault/buyback", { itemIds: [cheapest.id] });
ok(bb.count === 1 && bb.total > 0, `buyback queued: ${bb.total} USDT`);

// 4. list the most valuable card, bob buys it
const best = [...vault1.items].filter((i) => i.status === "vault").sort((a, b) => b.value_at_pull - a.value_at_pull)[0];
const { listingId } = await alice.call("/api/market/list", { itemId: best.id, price: 20 });
ok(!!listingId, `listed ${best.name} for 20 USDT`);
await bob.signIn();
const aliceBefore = await alice.balance();
const lc = await bob.call("/api/market/checkout", { listingId });
ok(Number(formatUnits(BigInt(lc.payment.fee), 18)) === 0.5, "market checkout signed with a 2.5% fee");
await bob.pay(lc);
ok(Math.abs((await alice.balance()) - aliceBefore - 19.5) < 1e-9, "seller received 19.5 USDT on-chain");
const bobVault = await bob.call("/api/vault");
ok(bobVault.items.some((i) => i.id === best.id && i.source === "market"), "card moved to the buyer's vault");
const relist = await bob.call("/api/market/checkout", { listingId }).catch((e) => e);
ok(relist instanceof Error, "sold listing can't be bought twice");

// 5. missions: first rip → free pack, then open it
const missions = (await alice.call("/api/missions")).missions;
const first = missions.find((m) => m.id === "first-rip");
ok(first.progress === 1 && !first.claimed, "mission 'first broadcast' completed");
await alice.call("/api/missions/claim", { missionId: "first-rip" });
const dup = await alice.call("/api/missions/claim", { missionId: "first-rip" }).catch((e) => e);
ok(dup instanceof Error, "mission reward can't be claimed twice");
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

// 8. admin pays the buyback and ships the order
await admin.signIn();
const overview = await admin.call("/api/admin/overview");
const payout = overview.payouts.find((p) => p.address === alice.account.address && p.kind === "buyback");
ok(!!payout, "buyback appears in the admin payout queue");
const fake = await admin.call("/api/admin/payout", { id: payout.id, status: "paid", txHash: (await pub.getBlock()).transactions[0] }).catch((e) => e);
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
ok(finalVault.payouts.some((p) => p.status === "paid"), "buyback payout marked paid after on-chain check");
ok(finalVault.shipments[0].status === "shipped", "shipment marked shipped with tracking");
const notAdmin = await alice.call("/api/admin/overview").catch((e) => e);
ok(notAdmin instanceof Error, "non-admins are locked out of /api/admin");

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
