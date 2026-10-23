"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { erc20Abi, getAddress } from "viem";
import { useAccount, useConfig } from "wagmi";
import { deployContract, waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { mockUsdtAbi, mockUsdtBytecode } from "@/lib/chain/artifacts";
import { CHAIN_KEY, USDT_ADDRESS, chain } from "@/lib/chain/config";
import { toUsdtUnits } from "@/lib/chain/units";
import { api, useMe } from "@/lib/session";
import { PAYOUT_LABEL } from "@/lib/types";
import { shortAddr } from "./WalletButton";

type Overview = {
  payouts: { id: number; address: string; kind: string; amount: string; created_at: string }[];
  shipments: {
    id: string;
    address: string;
    name: string;
    line1: string;
    city: string;
    postal: string;
    country: string;
    created_at: string;
    items: { name: string; number: string; set_id: string; rarity: string; reverse: boolean }[] | null;
  }[];
  stats: { revenue: string; packs: string; users: string };
  config: { chain: string; usdt: string | null; treasury: string | null; database: string };
};

export function AdminView() {
  const me = useMe();
  const { openConnectModal } = useConnectModal();
  const { address } = useAccount();
  const config = useConfig();
  const qc = useQueryClient();
  const data = useQuery<Overview>({ queryKey: ["admin"], queryFn: () => api("/api/admin/overview"), enabled: !!me.data?.admin });
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [tracking, setTracking] = useState<Record<string, string>>({});
  const [testUsdt, setTestUsdt] = useState<string | null>(null);

  if (me.isLoading) return <div className="skeleton mt-8 h-40" />;
  if (!me.data?.address)
    return (
      <div className="mt-10 flex flex-col items-start gap-4">
        <p className="gb-dialog">Sign in with an admin wallet.</p>
        <button type="button" className="btn btn-primary" onClick={() => openConnectModal?.()}>
          Connect wallet
        </button>
      </div>
    );
  if (!me.data.admin) return <p className="gb-dialog mt-10 max-w-md">This wallet isn&apos;t an admin (ADMIN_ADDRESSES).</p>;

  const run = async (key: string, fn: () => Promise<string>) => {
    setBusy(key);
    setMsg(null);
    try {
      setMsg({ tone: "ok", text: await fn() });
      qc.invalidateQueries({ queryKey: ["admin"] });
    } catch (e) {
      setMsg({ tone: "error", text: e instanceof Error ? e.message.split("\n")[0] : "Failed" });
    } finally {
      setBusy(null);
    }
  };

  const payPayout = (p: Overview["payouts"][number]) =>
    run(`pay-${p.id}`, async () => {
      if (!USDT_ADDRESS) throw new Error("USDT address not configured");
      const hash = await writeContract(config, {
        address: USDT_ADDRESS,
        abi: erc20Abi,
        functionName: "transfer",
        args: [getAddress(p.address), toUsdtUnits(Number(p.amount))],
        chainId: chain.id,
      });
      await waitForTransactionReceipt(config, { hash, chainId: chain.id });
      await api("/api/admin/payout", { id: p.id, status: "paid", txHash: hash });
      return `Paid ${Number(p.amount).toFixed(2)} USDT to ${shortAddr(p.address)}`;
    });

  const c = data.data?.config;

  return (
    <>
      {msg && (
        <p role={msg.tone === "error" ? "alert" : "status"} className={`hud mt-6 break-all ${msg.tone === "error" ? "text-poke-red" : "text-ok"}`}>
          {msg.text}
        </p>
      )}

      <section className="mt-8 grid gap-3 sm:grid-cols-3">
        {[
          ["Pack revenue", `${Number(data.data?.stats.revenue ?? 0).toFixed(2)} USDT`],
          ["Packs opened", data.data?.stats.packs ?? "…"],
          ["Trainers", data.data?.stats.users ?? "…"],
        ].map(([k, v]) => (
          <div key={k} className="border border-line p-4">
            <p className="hud text-faint">[{k}]</p>
            <p className="mt-1 font-display text-2xl">{v}</p>
          </div>
        ))}
      </section>

      {/* config + deploy */}
      <section className="mt-10 border border-line p-5" aria-labelledby="cfg">
        <h2 id="cfg" className="font-display text-2xl">
          Setup
        </h2>
        <dl className="hud mt-4 grid gap-2 break-all text-dim sm:grid-cols-2">
          {c &&
            Object.entries(c).map(([k, v]) => (
              <div key={k}>
                <dt className="text-faint">{k}</dt>
                <dd className={v ? "text-phosphor normal-case" : "text-warn"}>{v ?? "not set"}</dd>
              </div>
            ))}
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn" disabled={!!busy} onClick={() => run("prices", async () => {
            const r = await api<{ cards: number; packs: number }>("/api/cron/prices");
            return `Prices refreshed: ${r.cards} cards, ${r.packs} packs`;
          })}>
            {busy === "prices" ? "Refreshing…" : "Refresh prices now"}
          </button>
          <button type="button" className="btn" disabled={!!busy || !c?.treasury} onClick={() => run("sync", async () => {
            const r = await api<{ fulfilled: number; scanned: number; failedChunks: number }>("/api/cron/sync");
            if (r.failedChunks)
              throw new Error(`Treasury scan incomplete: the RPC rejected ${r.failedChunks} log request(s) — set BSC_RPC_URL_SERVER to a provider that supports eth_getLogs. ${r.fulfilled} fulfilled.`);
            return `Treasury scanned (${r.scanned} transfers): ${r.fulfilled} payment(s) fulfilled`;
          })}>
            {busy === "sync" ? "Syncing…" : "Sync recent payments"}
          </button>
        </div>

        {c && !c.treasury && (
          <p className="hud mt-4 text-warn">
            Set <code>NEXT_PUBLIC_TREASURY_ADDRESS</code> in Vercel and redeploy: every payment is a USDT transfer to that wallet.
          </p>
        )}

        {c && CHAIN_KEY !== "bsc" && (
          <div className="mt-6 border-t border-line pt-5">
            <p className="text-sm leading-relaxed text-phosphor/85">
              Test network: deploy a test USDT from this wallet ({address ? shortAddr(address) : "not connected"}), then set{" "}
              <code>NEXT_PUBLIC_USDT_ADDRESS</code> and redeploy the site.
            </p>
            <button
              type="button"
              className="btn mt-4"
              disabled={!!busy || !address}
              onClick={() =>
                run("mock", async () => {
                  const hash = await deployContract(config, { abi: mockUsdtAbi, bytecode: mockUsdtBytecode, args: [], chainId: chain.id });
                  const r = await waitForTransactionReceipt(config, { hash, chainId: chain.id });
                  const token = r.contractAddress!;
                  const mint = await writeContract(config, {
                    address: token,
                    abi: mockUsdtAbi,
                    functionName: "mint",
                    args: [address!, toUsdtUnits(10_000)],
                    chainId: chain.id,
                  });
                  await waitForTransactionReceipt(config, { hash: mint, chainId: chain.id });
                  setTestUsdt(token);
                  return `Test USDT deployed at ${token} and 10,000 minted to you`;
                })
              }
            >
              {busy === "mock" ? "Deploying…" : "Deploy test USDT"}
            </button>
            {testUsdt && <pre className="hud mt-4 overflow-x-auto border border-ok/40 p-3 text-ok normal-case">{`NEXT_PUBLIC_USDT_ADDRESS=${testUsdt}`}</pre>}
          </div>
        )}
      </section>

      {/* payouts */}
      <section className="mt-10" aria-labelledby="payouts">
        <h2 id="payouts" className="font-display text-2xl">
          Payout queue ({data.data?.payouts.length ?? 0})
        </h2>
        <p className="hud mt-1 text-dim">Buybacks, cashback withdrawals, PokéMart sales (price minus fee) and refunds. Paying sends USDT from your connected wallet; the server checks the transfer.</p>
        <ul className="mt-4 border-t border-line">
          {data.data?.payouts.length === 0 && <li className="hud py-3 text-faint">Nothing to pay.</li>}
          {data.data?.payouts.map((p) => (
            <li key={p.id} className="hud flex flex-wrap items-center justify-between gap-3 border-b border-line py-3">
              <span className="text-dim">#{p.id} · {PAYOUT_LABEL[p.kind] ?? p.kind}</span>
              <span className="normal-case">{shortAddr(p.address)}</span>
              <span className="text-poke-yellow">{Number(p.amount).toFixed(2)} USDT</span>
              <span className="text-faint">{new Date(p.created_at).toLocaleString("en-US")}</span>
              <span className="flex gap-2">
                <button type="button" className="btn btn-primary" disabled={!!busy} onClick={() => payPayout(p)}>
                  {busy === `pay-${p.id}` ? "Paying…" : "Pay with wallet"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={!!busy}
                  onClick={() =>
                    run(`rej-${p.id}`, async () => {
                      await api("/api/admin/payout", { id: p.id, status: "rejected", note: "rejected by admin" });
                      return `Payout #${p.id} rejected`;
                    })
                  }
                >
                  Reject
                </button>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* shipments */}
      <section className="mt-10" aria-labelledby="ship">
        <h2 id="ship" className="font-display text-2xl">
          Paid shipments ({data.data?.shipments.length ?? 0})
        </h2>
        <ul className="mt-4 grid gap-4 md:grid-cols-2">
          {data.data?.shipments.length === 0 && <li className="hud text-faint">Nothing to ship.</li>}
          {data.data?.shipments.map((s) => (
            <li key={s.id} className="border border-line p-4">
              <p className="pixel text-dim">{s.id}</p>
              <p className="mt-2 text-sm leading-relaxed">
                {s.name}
                <br />
                {s.line1}
                <br />
                {s.postal} {s.city}, {s.country}
              </p>
              <ul className="hud mt-3 text-dim">
                {(s.items ?? []).map((i, k) => (
                  <li key={k} className="normal-case">
                    {i.name} · {i.set_id} #{i.number} · {i.rarity}
                    {i.reverse ? " (reverse)" : ""}
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex gap-2">
                <input
                  value={tracking[s.id] ?? ""}
                  onChange={(e) => setTracking((t) => ({ ...t, [s.id]: e.target.value }))}
                  placeholder="Tracking number"
                  aria-label={`Tracking number for ${s.id}`}
                  className="h-11 flex-1 border border-line-strong bg-transparent px-3 font-mono text-sm text-phosphor outline-none focus:border-poke-yellow"
                />
                <button
                  type="button"
                  className="btn"
                  disabled={!!busy || !tracking[s.id]}
                  onClick={() =>
                    run(`ship-${s.id}`, async () => {
                      await api("/api/admin/shipment", { id: s.id, tracking: tracking[s.id] });
                      return `${s.id} marked as shipped`;
                    })
                  }
                >
                  Mark shipped
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <p className="hud mt-10 text-faint">Network: {chain.name}</p>
    </>
  );
}
