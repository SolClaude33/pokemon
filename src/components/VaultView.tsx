"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { useAccount } from "wagmi";
import { fmtUSD } from "@/lib/odds";
import { ECONOMICS, buybackFor } from "@/lib/packs";
import { rarityRank } from "@/lib/rarity";
import { DEMO_OWNER, canSellBack, requestShipment, sellBack, useVault, type VaultStatus } from "@/lib/vault";
import { RarityTag, TcgCard } from "./TcgCard";
import { WalletButton, shortAddr } from "./WalletButton";

const TABS: { id: VaultStatus; label: string }[] = [
  { id: "vault", label: "In vault" },
  { id: "shipping", label: "Shipping" },
  { id: "sold", label: "Sold back" },
];

type Notice = { tone: "ok" | "error"; text: string } | null;

export function VaultView() {
  const { address } = useAccount();
  const owner = address ?? DEMO_OWNER;
  const state = useVault(owner);
  const [tab, setTab] = useState<VaultStatus>("vault");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [shipOpen, setShipOpen] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const items = useMemo(
    () =>
      state.items
        .filter((i) => i.status === tab)
        .sort((a, b) => b.value - a.value || rarityRank(b.rarity) - rarityRank(a.rarity)),
    [state.items, tab],
  );
  const inVault = state.items.filter((i) => i.status === "vault");
  const vaultValue = inVault.reduce((a, i) => a + i.value, 0);
  const credited = state.ledger.filter((l) => l.type === "sellback").reduce((a, l) => a + l.amount, 0);
  const spent = -state.ledger.filter((l) => l.type !== "sellback").reduce((a, l) => a + l.amount, 0);
  const chosen = inVault.filter((i) => selected.has(i.uid));
  const chosenBuyback = chosen.filter((i) => canSellBack(i)).reduce((a, i) => a + buybackFor(i.value), 0);

  const toggle = (uid: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(uid)) n.delete(uid);
      else n.add(uid);
      return n;
    });

  const sell = () => {
    const r = sellBack(owner, [...selected]);
    setSelected(new Set());
    setNotice({ tone: "ok", text: `Sold ${r.count} card${r.count === 1 ? "" : "s"} for ${r.total.toFixed(2)} USDC (demo credit).` });
  };

  const ship = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const get = (k: string) => String(f.get(k) ?? "").trim();
    if (!get("name") || !get("street") || !get("city") || !get("postal") || !get("country")) {
      setNotice({ tone: "error", text: "Fill in every address field to ship." });
      return;
    }
    const s = requestShipment(owner, [...selected], { name: get("name"), city: get("city"), country: get("country") });
    setSelected(new Set());
    setShipOpen(false);
    setTab("shipping");
    setNotice({ tone: "ok", text: `Shipment ${s.id} requested · ${s.items.length} card${s.items.length === 1 ? "" : "s"} · ${s.fee} USDC fee (demo).` });
  };

  return (
    <div className="channel-scroll">
      <div className="mx-auto max-w-6xl px-[clamp(16px,3.4vw,40px)] pt-[clamp(96px,15vh,140px)] pb-[clamp(80px,12vh,120px)]">
        <div className="flex flex-wrap items-end justify-between gap-6 border-b border-line-strong pb-6">
          <div>
            <p className="pixel text-[10px] text-dim">{address ? `Wallet ${shortAddr(address)}` : "Demo vault · no wallet"}</p>
            <h1 className="mt-2 font-display text-[clamp(2.2rem,5vw,3.8rem)] leading-none italic">Your vault</h1>
          </div>
          <dl className="hud grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4">
            {[
              ["Cards held", String(inVault.length)],
              ["Market value", fmtUSD(vaultValue)],
              ["Sold back", `${credited.toFixed(2)} USDC`],
              ["Spent", `${spent.toFixed(2)} USDC`],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-faint">[{k}]</dt>
                <dd className="mt-1 text-phosphor">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        {!address && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border border-line p-4">
            <p className="hud text-dim">You&apos;re viewing the demo vault for free rips. Connect a wallet on BNB Chain to see yours.</p>
            <div className="w-56">
              <WalletButton size="large" />
            </div>
          </div>
        )}

        {notice && (
          <p role={notice.tone === "error" ? "alert" : "status"} className={`hud mt-6 ${notice.tone === "error" ? "text-signal" : "text-ok"}`}>
            {notice.text}
          </p>
        )}

        <div role="tablist" aria-label="Vault sections" className="hud mt-8 flex gap-6">
          {TABS.map((t) => {
            const count = state.items.filter((i) => i.status === t.id).length;
            return (
              <button
                key={t.id}
                role="tab"
                type="button"
                aria-selected={tab === t.id}
                onClick={() => {
                  setTab(t.id);
                  setSelected(new Set());
                }}
                className={`cursor-pointer border-b pb-2 uppercase transition-colors ${tab === t.id ? "border-phosphor text-phosphor" : "border-transparent text-dim hover:text-phosphor"}`}
              >
                {t.label} ({count})
              </button>
            );
          })}
        </div>

        {items.length === 0 ? (
          <div className="mt-16 flex flex-col items-center gap-4 text-center">
            <p className="font-display text-2xl italic text-dim">
              {tab === "vault" ? "No signal. Your vault is empty." : tab === "shipping" ? "Nothing on the way yet." : "No cards sold back yet."}
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
              const on = selected.has(it.uid);
              const card = (
                <>
                  <span className={`block transition-[opacity,transform] duration-300 ${on ? "scale-[0.96] opacity-60" : ""}`}>
                    <TcgCard img={it.img} name={it.name} rarity={it.rarity} reverse={it.reverse} sizes="(max-width: 640px) 45vw, 200px" />
                  </span>
                  <span className="mt-2 block truncate text-[13px]">{it.name}</span>
                  <RarityTag rarity={it.rarity} className="mt-1" />
                  <span className="hud mt-1 flex justify-between text-dim">
                    <span>{fmtUSD(it.value)}</span>
                    {it.status === "vault" && <span className={on ? "text-ok" : ""}>{on ? "■ Selected" : "□ Select"}</span>}
                    {it.status === "sold" && <span>Sold {fmtUSD(it.soldFor ?? 0)}</span>}
                    {it.status === "shipping" && <span>{it.shipmentId}</span>}
                  </span>
                  <span className="hud mt-0.5 block text-faint">
                    {it.setName}
                    {it.status === "vault" && !canSellBack(it) && " · ship only"}
                  </span>
                </>
              );
              return (
                <li key={it.uid}>
                  {it.status === "vault" ? (
                    <label className="block cursor-pointer">
                      <input type="checkbox" className="peer sr-only" checked={on} onChange={() => toggle(it.uid)} />
                      <span className="block peer-focus-visible:outline peer-focus-visible:outline-1 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-dashed">
                        {card}
                      </span>
                    </label>
                  ) : (
                    card
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
                  ? `${chosen.length} selected · buyback ${chosenBuyback.toFixed(2)} USDC · or ship for ${ECONOMICS.shippingFee} USDC`
                  : "Select cards to sell back instantly or ship home."}
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-ghost hud" onClick={() => setSelected(new Set(inVault.map((i) => i.uid)))}>
                  Select all
                </button>
                <button type="button" className="btn" disabled={!chosen.length} onClick={() => setShipOpen(true)}>
                  Ship home
                </button>
                <button type="button" className="btn btn-primary" disabled={!chosenBuyback} onClick={sell}>
                  Sell back {chosenBuyback ? `${chosenBuyback.toFixed(2)} USDC` : ""}
                </button>
              </div>
            </div>

            {shipOpen && (
              <form onSubmit={ship} className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-2 lg:grid-cols-5" aria-label="Shipping address">
                {[
                  ["name", "Full name", "name"],
                  ["street", "Street address", "street-address"],
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
                      className="h-11 border border-line-strong bg-transparent px-3 font-mono text-sm normal-case tracking-normal text-phosphor outline-none focus:border-phosphor"
                    />
                  </label>
                ))}
                <div className="flex gap-2 sm:col-span-2 lg:col-span-5">
                  <button type="submit" className="btn btn-primary">
                    Request shipment · {ECONOMICS.shippingFee} USDC
                  </button>
                  <button type="button" className="btn btn-ghost hud" onClick={() => setShipOpen(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {state.ledger.length > 0 && (
          <section aria-labelledby="ledger" className="mt-20">
            <h2 id="ledger" className="font-display text-2xl italic">
              Ledger
            </h2>
            <ol className="mt-4 border-t border-line">
              {state.ledger.slice(0, 20).map((l) => (
                <li key={l.id} className="hud flex justify-between gap-4 border-b border-line py-3">
                  <span className="text-dim">
                    {new Date(l.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="flex-1 truncate normal-case">{l.label}</span>
                  <span className={l.amount >= 0 ? "text-ok" : "text-dim"}>
                    {l.amount >= 0 ? "+" : "−"}
                    {Math.abs(l.amount).toFixed(2)} USDC
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </div>
  );
}
