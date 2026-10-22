"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { sfx } from "@/lib/audio";
import { explorerTx } from "@/lib/chain/config";
import { fmtUSDT } from "@/lib/odds";
import { ECONOMICS, buybackFor } from "@/lib/packs";
import { STEP_LABEL, usePayment, type SignedPayment } from "@/lib/pay";
import { rarityRank } from "@/lib/rarity";
import { api, useMe } from "@/lib/session";
import type { ApiItem, VaultData } from "@/lib/types";
import { RarityTag, TcgCard } from "./TcgCard";
import { shortAddr } from "./WalletButton";

type Tab = "vault" | "listed" | "pending" | "shipping" | "sold";

const TABS: { id: Tab; label: string; statuses: ApiItem["status"][] }[] = [
  { id: "vault", label: "In vault", statuses: ["vault"] },
  { id: "listed", label: "On PokéMart", statuses: ["listed"] },
  { id: "pending", label: "Buyback pending", statuses: ["buyback_pending"] },
  { id: "shipping", label: "Shipping", statuses: ["shipping", "shipped"] },
  { id: "sold", label: "Sold", statuses: ["sold"] },
];

const STATUS_LABEL: Record<ApiItem["status"], string> = {
  vault: "",
  listed: "Listed",
  buyback_pending: "Payout pending",
  sold: "Sold",
  shipping: "Packing",
  shipped: "Shipped",
};

type Notice = { tone: "ok" | "error"; text: string } | null;

const canBuyBack = (it: ApiItem) =>
  it.status === "vault" && Date.now() - new Date(it.acquired_at).getTime() < ECONOMICS.buybackWindowHours * 3_600_000;

export function VaultView({ setNames }: { setNames: Record<string, string> }) {
  const me = useMe();
  const { openConnectModal } = useConnectModal();
  const qc = useQueryClient();
  const pay = usePayment();
  const address = me.data?.address ?? null;
  const vault = useQuery<VaultData>({ queryKey: ["vault"], queryFn: () => api("/api/vault"), enabled: !!address });
  const [tab, setTab] = useState<Tab>("vault");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [shipOpen, setShipOpen] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);

  const all = useMemo(() => vault.data?.items ?? [], [vault.data]);
  const statuses = TABS.find((t) => t.id === tab)!.statuses;
  const items = useMemo(
    () =>
      all
        .filter((i) => statuses.includes(i.status))
        .sort((a, b) => Number(b.value_at_pull) - Number(a.value_at_pull) || rarityRank(b.rarity) - rarityRank(a.rarity)),
    [all, statuses],
  );
  const inVault = all.filter((i) => i.status === "vault");
  const vaultValue = inVault.reduce((a, i) => a + Number(i.value_at_pull), 0);
  const chosen = inVault.filter((i) => selected.has(i.id));
  const chosenBuyback = chosen.filter(canBuyBack).reduce((a, i) => a + buybackFor(Number(i.value_at_pull)), 0);

  if (!me.isLoading && !address) {
    return (
      <div className="mx-auto mt-14 flex max-w-md flex-col items-center gap-5">
        <p className="gb-dialog w-full">Sign in with your wallet to open your vault.</p>
        <button type="button" className="btn btn-primary" onClick={() => openConnectModal?.()}>
          Connect wallet
        </button>
      </div>
    );
  }

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const buyback = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const r = await api<{ total: number; count: number }>("/api/vault/buyback", { itemIds: [...selected] });
      sfx.coin();
      setSelected(new Set());
      setNotice({ tone: "ok", text: `Buyback requested: ${r.total.toFixed(2)} USDT for ${r.count} card${r.count === 1 ? "" : "s"}. It's paid to your wallet once processed.` });
      qc.invalidateQueries();
    } catch (e) {
      sfx.error();
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Buyback failed" });
    } finally {
      setBusy(false);
    }
  };

  const ship = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const to = Object.fromEntries(["name", "line1", "city", "postal", "country"].map((k) => [k, String(f.get(k) ?? "").trim()]));
    if (Object.values(to).some((v) => !v)) {
      setNotice({ tone: "error", text: "Fill in every address field to ship." });
      return;
    }
    setNotice(null);
    try {
      await pay.run(() => api<SignedPayment>("/api/vault/ship", { itemIds: [...selected], to }));
      sfx.coin();
      setSelected(new Set());
      setShipOpen(false);
      setTab("shipping");
      setNotice({ tone: "ok", text: "Shipping paid — we'll pack your cards and post the tracking number here." });
      qc.invalidateQueries();
    } catch {
      sfx.error();
    }
  };

  const payouts = vault.data?.payouts ?? [];
  const shipments = vault.data?.shipments ?? [];
  const vouchers = vault.data?.vouchers ?? [];

  return (
    <>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-6 border-b border-line-strong pb-6">
        <p className="pixel text-dim">{address ? `Wallet ${shortAddr(address)}` : "…"}</p>
        <dl className="hud grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3">
          {[
            ["Cards held", String(inVault.length)],
            ["Vault value", fmtUSDT(vaultValue)],
            ["Free packs", String(vouchers.length)],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-faint">[{k}]</dt>
              <dd className="mt-1 text-phosphor">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      {vouchers.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border border-ok/40 p-4">
          <p className="hud text-ok">
            You have {vouchers.length} free pack{vouchers.length > 1 ? "s" : ""} from missions:{" "}
            {vouchers.map((v) => setNames[v.set_id] ?? v.set_id).join(", ")}
          </p>
          <div className="flex flex-wrap gap-2">
            {[...new Set(vouchers.map((v) => v.set_id))].map((s) => (
              <Link key={s} href={`/packs/${s}`} className="btn btn-primary">
                Open {setNames[s] ?? s}
              </Link>
            ))}
          </div>
        </div>
      )}

      {notice && (
        <p role={notice.tone === "error" ? "alert" : "status"} className={`hud mt-6 ${notice.tone === "error" ? "text-poke-red" : "text-ok"}`}>
          {notice.text}
        </p>
      )}

      <div role="tablist" aria-label="Vault sections" className="hud mt-8 flex flex-wrap gap-x-6 gap-y-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => {
              setTab(t.id);
              setSelected(new Set());
            }}
            className={`cursor-pointer border-b-2 pb-2 uppercase transition-colors ${tab === t.id ? "border-poke-yellow text-poke-yellow" : "border-transparent text-dim hover:text-phosphor"}`}
          >
            {t.label} ({all.filter((i) => t.statuses.includes(i.status)).length})
          </button>
        ))}
      </div>

      {vault.isLoading ? (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="skeleton aspect-[734/1024]" />
          ))}
        </div>
      ) : vault.isError ? (
        <p className="gb-dialog mx-auto mt-12 max-w-md">Couldn&apos;t load your vault. Refresh to try again.</p>
      ) : items.length === 0 ? (
        <div className="mx-auto mt-14 flex max-w-md flex-col items-center gap-5">
          <p className="gb-dialog w-full">
            {tab === "vault" ? "No signal. Your vault is empty." : tab === "listed" ? "Nothing listed on the PokéMart." : "Nothing here yet."}
          </p>
          {tab === "vault" && (
            <Link href="/" className="btn btn-primary">
              Tune in to a pack
            </Link>
          )}
        </div>
      ) : (
        <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
          {items.map((it) => {
            const on = selected.has(it.id);
            const value = Number(it.value_at_pull);
            const body = (
              <>
                <span className={`block transition-[opacity,transform] duration-300 ${on ? "scale-[0.96] opacity-60" : ""}`}>
                  <TcgCard img={it.img} name={it.name} rarity={it.rarity} reverse={it.reverse} sizes="(max-width: 640px) 45vw, 200px" />
                </span>
                <span className="mt-2 block truncate text-[13px]">{it.name}</span>
                <RarityTag rarity={it.rarity} className="mt-1" />
                <span className="hud mt-1 flex justify-between gap-2 text-dim">
                  <span>{fmtUSDT(value)}</span>
                  {it.status === "vault" ? (
                    <span className={on ? "text-ok" : ""}>{on ? "■ Selected" : "□ Select"}</span>
                  ) : (
                    <span className="text-poke-yellow">{STATUS_LABEL[it.status]}</span>
                  )}
                </span>
                <span className="hud mt-0.5 block truncate text-faint">
                  {setNames[it.set_id] ?? it.set_id}
                  {it.source === "market" && " · bought"}
                  {it.status === "vault" && !canBuyBack(it) && " · ship or list"}
                </span>
              </>
            );
            return (
              <li key={it.id}>
                {it.status === "vault" ? (
                  <label className="block cursor-pointer">
                    <input type="checkbox" className="peer sr-only" checked={on} onChange={() => toggle(it.id)} />
                    <span className="block peer-focus-visible:outline peer-focus-visible:outline-1 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-dashed">
                      {body}
                    </span>
                  </label>
                ) : (
                  body
                )}
              </li>
            );
          })}
        </ul>
      )}

      {tab === "vault" && inVault.length > 0 && (
        <div className="sticky bottom-0 z-10 -mx-[clamp(16px,3.4vw,40px)] mt-10 border-t border-line bg-[#0b0d11]/95 px-[clamp(16px,3.4vw,40px)] pt-4 pb-[clamp(16px,4vh,36px)] backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="hud text-dim">
              {chosen.length
                ? `${chosen.length} selected · buyback ${chosenBuyback.toFixed(2)} USDT · or ship for ${ECONOMICS.shippingFee} USDT`
                : "Select cards to sell back instantly, ship home or list on the PokéMart."}
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-ghost hud" onClick={() => setSelected(new Set(inVault.map((i) => i.id)))}>
                Select all
              </button>
              <Link href="/market?tab=sell" className="btn">
                List on PokéMart
              </Link>
              <button type="button" className="btn" disabled={!chosen.length} onClick={() => setShipOpen(true)}>
                Ship home
              </button>
              <button type="button" className="btn btn-primary" disabled={!chosenBuyback || busy} onClick={buyback}>
                {busy ? "Requesting…" : `Sell back ${chosenBuyback ? `${chosenBuyback.toFixed(2)} USDT` : ""}`}
              </button>
            </div>
          </div>

          {shipOpen && (
            <form onSubmit={ship} className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-2 lg:grid-cols-5" aria-label="Shipping address">
              {[
                ["name", "Full name", "name"],
                ["line1", "Street address", "street-address"],
                ["city", "City", "address-level2"],
                ["postal", "Postal code", "postal-code"],
                ["country", "Country", "country-name"],
              ].map(([n, label, ac]) => (
                <label key={n} className="hud flex flex-col gap-1 text-dim">
                  {label}
                  <input
                    name={n}
                    autoComplete={ac}
                    required
                    className="h-11 border border-line-strong bg-transparent px-3 font-mono text-sm tracking-normal text-phosphor normal-case outline-none focus:border-poke-yellow"
                  />
                </label>
              ))}
              <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-5">
                <button type="submit" className="btn btn-primary" disabled={pay.busy}>
                  {pay.busy ? STEP_LABEL[pay.step] : `Pay shipping · ${ECONOMICS.shippingFee} USDT`}
                </button>
                <button type="button" className="btn btn-ghost hud" onClick={() => setShipOpen(false)}>
                  Cancel
                </button>
                {pay.error && <span className="hud text-poke-red">{pay.error}</span>}
              </div>
            </form>
          )}
        </div>
      )}

      {(payouts.length > 0 || shipments.length > 0) && (
        <section aria-labelledby="activity" className="mt-20 grid gap-10 lg:grid-cols-2">
          <div>
            <h2 id="activity" className="font-display text-2xl">
              Payouts
            </h2>
            <ol className="mt-4 border-t border-line">
              {payouts.length === 0 && <li className="hud py-3 text-faint">No payouts yet.</li>}
              {payouts.map((p) => (
                <li key={p.id} className="hud flex items-center justify-between gap-4 border-b border-line py-3">
                  <span className="text-dim">{p.kind === "buyback" ? "Buyback" : "Cashback"}</span>
                  <span>{Number(p.amount).toFixed(2)} USDT</span>
                  {p.status === "paid" && p.tx_hash ? (
                    <a className="link-hud text-ok" href={explorerTx(p.tx_hash)} target="_blank" rel="noreferrer">
                      Paid ↗
                    </a>
                  ) : (
                    <span className={p.status === "rejected" ? "text-poke-red" : "text-warn"}>{p.status}</span>
                  )}
                </li>
              ))}
            </ol>
          </div>
          <div>
            <h2 className="font-display text-2xl">Shipments</h2>
            <ol className="mt-4 border-t border-line">
              {shipments.length === 0 && <li className="hud py-3 text-faint">No shipments yet.</li>}
              {shipments.map((s) => (
                <li key={s.id} className="hud flex items-center justify-between gap-4 border-b border-line py-3">
                  <span className="text-dim">{s.id}</span>
                  <span>
                    {s.item_ids.length} card{s.item_ids.length === 1 ? "" : "s"} → {s.city}, {s.country}
                  </span>
                  <span className={s.status === "shipped" ? "text-ok" : "text-warn"}>
                    {s.status === "shipped" ? `Shipped · ${s.tracking}` : s.status.replace("_", " ")}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}
    </>
  );
}
