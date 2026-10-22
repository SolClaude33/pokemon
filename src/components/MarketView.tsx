"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useDeferredValue, useMemo, useState } from "react";
import { sfx } from "@/lib/audio";
import { PAYMENTS_ADDRESS, explorerTx } from "@/lib/chain/config";
import { fmtUSDT } from "@/lib/odds";
import { ECONOMICS, buybackFor } from "@/lib/packs";
import { STEP_LABEL, usePayment, type SignedPayment } from "@/lib/pay";
import { rarityMeta, rarityRank } from "@/lib/rarity";
import { api, useMe } from "@/lib/session";
import type { ApiItem, ApiListing, VaultData } from "@/lib/types";
import { CardModal } from "./CardModal";
import { RarityTag, TcgCard } from "./TcgCard";
import { shortAddr } from "./WalletButton";

type Tab = "browse" | "sell" | "mine";
type Sort = "deal" | "price-desc" | "price-asc" | "rarity" | "newest";

const SORTS: { id: Sort; label: string }[] = [
  { id: "newest", label: "Newest" },
  { id: "deal", label: "Best deal vs market" },
  { id: "price-desc", label: "Price: high → low" },
  { id: "price-asc", label: "Price: low → high" },
  { id: "rarity", label: "Rarity" },
];

type DexInfo = Record<string, { odds: number; supertype: string; price: number | null }>;

const fee = (price: number) => Math.round(price * ECONOMICS.marketFee * 100) / 100;

function ago(iso: string) {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  return h < 1 ? "just now" : h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

function Delta({ price, market }: { price: number; market: number | null }) {
  if (!market) return null;
  const d = (price - market) / market;
  const under = d < -0.005;
  const over = d > 0.005;
  return (
    <span className={`hud ${under ? "text-ok" : over ? "text-warn" : "text-dim"}`}>
      {under ? "▼" : over ? "▲" : "="} {Math.abs(d * 100).toFixed(0)}% {under ? "under" : over ? "over" : "at"} market
    </span>
  );
}

export function MarketView({ packs, dex }: { packs: { id: string; name: string; price: number }[]; dex: DexInfo }) {
  const params = useSearchParams();
  const me = useMe();
  const { openConnectModal } = useConnectModal();
  const qc = useQueryClient();
  const pay = usePayment();
  const address = me.data?.address ?? null;

  const market = useQuery<{ listings: ApiListing[] }>({ queryKey: ["market"], queryFn: () => api("/api/market"), refetchInterval: 30_000 });
  const vault = useQuery<VaultData>({ queryKey: ["vault"], queryFn: () => api("/api/vault"), enabled: !!address });

  const [tab, setTab] = useState<Tab>(params.get("tab") === "sell" ? "sell" : "browse");
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [pack, setPack] = useState("all");
  const [sort, setSort] = useState<Sort>("newest");
  const [open, setOpen] = useState<ApiListing | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const q = useDeferredValue(query.trim().toLowerCase());
  const packName = (id: string) => packs.find((p) => p.id === id)?.name ?? id;
  const marketOf = (cardId: string) => dex[cardId]?.price ?? null;

  const listings = useMemo(() => {
    const out = (market.data?.listings ?? []).filter(
      (l) => (pack === "all" || l.set_id === pack) && (!q || l.name.toLowerCase().includes(q)),
    );
    const delta = (l: ApiListing) => {
      const m = dex[l.card_id]?.price;
      return m ? (Number(l.price) - m) / m : 0;
    };
    const by: Record<Sort, (a: ApiListing, b: ApiListing) => number> = {
      newest: (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
      deal: (a, b) => delta(a) - delta(b),
      "price-desc": (a, b) => Number(b.price) - Number(a.price),
      "price-asc": (a, b) => Number(a.price) - Number(b.price),
      rarity: (a, b) => rarityRank(b.rarity) - rarityRank(a.rarity) || Number(b.price) - Number(a.price),
    };
    return out.sort(by[sort]);
  }, [market.data, pack, q, sort, dex]);

  const isMine = (l: ApiListing) => !!address && l.seller.toLowerCase() === address.toLowerCase();
  const mine = (market.data?.listings ?? []).filter(isMine);
  const sellable = (vault.data?.items ?? []).filter((i) => i.status === "vault").sort((a, b) => Number(b.value_at_pull) - Number(a.value_at_pull));
  const live = !!PAYMENTS_ADDRESS;

  const buy = async () => {
    if (!open) return;
    setResult(null);
    try {
      await pay.run(() => api<SignedPayment>("/api/market/checkout", { listingId: open.id }));
      sfx.coin();
      setResult({ tone: "ok", text: `You got ${open.name}! It's in your vault.` });
      qc.invalidateQueries();
    } catch {
      sfx.error();
    }
    setConfirm(false);
  };

  const cancel = async (listingId: string) => {
    try {
      await api("/api/market/cancel", { listingId });
      sfx.click();
      qc.invalidateQueries();
      setOpen(null);
    } catch (e) {
      sfx.error();
      setResult({ tone: "error", text: e instanceof Error ? e.message : "Couldn't cancel" });
    }
  };

  const closeModal = () => {
    setOpen(null);
    setConfirm(false);
    setResult(null);
    pay.reset();
  };

  return (
    <>
      <div className="mt-8 flex flex-wrap items-end justify-between gap-4 border-b border-line">
        <div role="tablist" aria-label="PokéMart" className="hud flex gap-6">
          {(
            [
              ["browse", `Browse (${market.data?.listings.length ?? "…"})`],
              ["sell", "Sell a card"],
              ["mine", `My listings (${mine.length})`],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              type="button"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`cursor-pointer border-b-2 pb-3 uppercase transition-colors ${tab === id ? "border-poke-yellow text-poke-yellow" : "border-transparent text-dim hover:text-phosphor"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="hud pb-3 text-dim">
          {address ? `Trading as ${shortAddr(address)}` : "Sign in to trade"} · sellers pay {ECONOMICS.marketFee * 100}% fee
        </p>
      </div>

      {tab === "browse" && (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <label className="min-w-[220px] flex-1">
              <span className="sr-only">Search listings</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search listings…"
                className="h-11 w-full border border-line-strong bg-transparent px-3 font-mono text-sm text-phosphor outline-none placeholder:text-faint focus:border-poke-yellow"
              />
            </label>
            <select
              aria-label="Pack"
              value={pack}
              onChange={(e) => setPack(e.target.value)}
              className="h-11 border border-line-strong bg-[#0b0d11] px-2 font-mono text-xs text-phosphor outline-none focus:border-poke-yellow"
            >
              <option value="all">All packs</option>
              {packs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="h-11 border border-line-strong bg-[#0b0d11] px-2 font-mono text-xs text-phosphor outline-none focus:border-poke-yellow"
            >
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {market.isLoading ? (
            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="skeleton aspect-[734/1024]" />
              ))}
            </div>
          ) : market.isError ? (
            <p className="gb-dialog mx-auto mt-12 max-w-md">The PokéMart is offline for a moment. Refresh to try again.</p>
          ) : listings.length === 0 ? (
            <div className="mx-auto mt-12 flex max-w-md flex-col items-center gap-5">
              <p className="gb-dialog w-full">
                {market.data?.listings.length ? "No listings match that search." : "The shelves are empty — be the first trainer to list a card!"}
              </p>
              <button type="button" className="btn btn-primary" onClick={() => setTab("sell")}>
                Sell a card
              </button>
            </div>
          ) : (
            <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
              {listings.map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => {
                      sfx.select();
                      setOpen(l);
                    }}
                    className="group block w-full cursor-pointer text-left"
                  >
                    <span className="block transition-transform duration-300 group-hover:-translate-y-1">
                      <TcgCard img={l.img} name={l.name} rarity={l.rarity} reverse={l.reverse} glow={rarityMeta(l.rarity).hit} sizes="(max-width: 640px) 45vw, 200px" />
                    </span>
                    <span className="mt-2 block truncate text-[13px] group-hover:text-poke-yellow">{l.name}</span>
                    <RarityTag rarity={l.reverse ? "Reverse Holo" : l.rarity} className="mt-1" />
                    <span className="mt-1.5 flex items-baseline justify-between gap-2">
                      <span className="font-display text-xl text-poke-yellow">{Number(l.price).toFixed(2)}</span>
                      <span className="hud text-dim">USDT</span>
                    </span>
                    <Delta price={Number(l.price)} market={marketOf(l.card_id)} />
                    <span className="hud mt-0.5 block truncate text-faint">
                      {isMine(l) ? "Your listing" : shortAddr(l.seller)} · {ago(l.created_at)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {tab === "sell" &&
        (!address ? (
          <div className="mx-auto mt-12 flex max-w-md flex-col items-center gap-5">
            <p className="gb-dialog w-full">Sign in with your wallet to sell cards from your vault.</p>
            <button type="button" className="btn btn-primary" onClick={() => openConnectModal?.()}>
              Connect wallet
            </button>
          </div>
        ) : (
          <SellPanel
            items={sellable}
            loading={vault.isLoading}
            packName={packName}
            marketOf={marketOf}
            onListed={() => {
              qc.invalidateQueries();
              setTab("mine");
            }}
          />
        ))}

      {tab === "mine" &&
        (mine.length === 0 ? (
          <div className="mx-auto mt-12 max-w-md">
            <p className="gb-dialog">You haven&apos;t listed anything yet. Pick a card from your vault in “Sell a card”.</p>
          </div>
        ) : (
          <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
            {mine.map((l) => (
              <li key={l.id}>
                <TcgCard img={l.img} name={l.name} rarity={l.rarity} reverse={l.reverse} sizes="200px" />
                <p className="mt-2 truncate text-[13px]">{l.name}</p>
                <p className="mt-1 font-display text-xl text-poke-yellow">{Number(l.price).toFixed(2)} USDT</p>
                <Delta price={Number(l.price)} market={marketOf(l.card_id)} />
                <button type="button" className="btn btn-ghost hud mt-2 w-full" onClick={() => cancel(l.id)}>
                  Cancel listing
                </button>
              </li>
            ))}
          </ul>
        ))}

      {open && (
        <CardModal
          card={{
            img: open.img,
            name: open.name,
            rarity: open.rarity,
            reverse: open.reverse,
            setId: open.set_id,
            setName: packName(open.set_id),
            number: open.number,
            price: marketOf(open.card_id),
            odds: dex[open.card_id]?.odds,
            supertype: dex[open.card_id]?.supertype,
            packPrice: packs.find((p) => p.id === open.set_id)?.price,
          }}
          onClose={closeModal}
          actions={
            result?.tone === "ok" ? (
              <Link href="/vault" className="btn btn-primary">
                Open vault
              </Link>
            ) : isMine(open) ? (
              <button type="button" className="btn" onClick={() => cancel(open.id)}>
                Cancel my listing
              </button>
            ) : !address ? (
              <button type="button" className="btn btn-primary" onClick={() => openConnectModal?.()}>
                Connect wallet to buy
              </button>
            ) : !live ? (
              <span className="hud text-warn">Payments aren&apos;t live yet</span>
            ) : confirm ? (
              <>
                <button type="button" className="btn btn-primary" onClick={buy} disabled={pay.busy}>
                  {pay.busy ? STEP_LABEL[pay.step] : "Yes, buy it"}
                </button>
                <button type="button" className="btn" onClick={() => setConfirm(false)} disabled={pay.busy}>
                  No
                </button>
              </>
            ) : (
              <button type="button" className="btn btn-primary" onClick={() => setConfirm(true)}>
                Buy for {Number(open.price).toFixed(2)} USDT
              </button>
            )
          }
        >
          <div className="mt-6 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="font-display text-4xl text-poke-yellow">{Number(open.price).toFixed(2)} USDT</span>
            <Delta price={Number(open.price)} market={marketOf(open.card_id)} />
          </div>
          <p className="hud mt-2 text-faint">
            Seller {isMine(open) ? "you" : shortAddr(open.seller)} · listed {ago(open.created_at)} · paid straight to the seller on BNB Chain
          </p>
          {confirm && !result && (
            <p className="gb-dialog mt-6" data-more="true">
              Buy {open.name.toUpperCase()} for {Number(open.price).toFixed(2)} USDT?
            </p>
          )}
          {pay.error && (
            <p role="alert" className="gb-dialog mt-6 !text-poke-red">
              {pay.error}
            </p>
          )}
          {pay.txHash && (
            <a href={explorerTx(pay.txHash)} target="_blank" rel="noreferrer" className="hud link-hud mt-3 inline-block text-dim">
              View transaction ↗
            </a>
          )}
          {result && (
            <p role={result.tone === "error" ? "alert" : "status"} className={`gb-dialog mt-6 ${result.tone === "error" ? "!text-poke-red" : ""}`}>
              {result.text}
            </p>
          )}
        </CardModal>
      )}
    </>
  );
}

function SellPanel({
  items,
  loading,
  packName,
  marketOf,
  onListed,
}: {
  items: ApiItem[];
  loading: boolean;
  packName: (id: string) => string;
  marketOf: (cardId: string) => number | null;
  onListed: () => void;
}) {
  const [pick, setPick] = useState<ApiItem | null>(null);
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const n = Number(price);
  const valid = Number.isFinite(n) && n >= 0.5 && n <= 1_000_000;
  const market = pick ? (marketOf(pick.card_id) ?? Number(pick.value_at_pull)) : 0;

  if (loading) return <div className="skeleton mt-8 h-40 w-full" />;
  if (items.length === 0) {
    return (
      <div className="mx-auto mt-12 flex max-w-md flex-col items-center gap-5">
        <p className="gb-dialog">Your vault is empty! Rip a pack first, then come back to sell your pulls.</p>
        <Link href="/" className="btn btn-primary">
          Tune in to a pack
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_340px]">
      <ul className="grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 md:grid-cols-5" aria-label="Cards in your vault">
        {items.map((it) => (
          <li key={it.id}>
            <button
              type="button"
              aria-pressed={pick?.id === it.id}
              onClick={() => {
                sfx.click();
                setPick(it);
                setPrice((marketOf(it.card_id) ?? Number(it.value_at_pull)).toFixed(2));
                setError(null);
              }}
              className={`block w-full cursor-pointer text-left transition-opacity ${pick && pick.id !== it.id ? "opacity-50 hover:opacity-90" : ""}`}
            >
              <span className={`block rounded-[4.6%/3.3%] ${pick?.id === it.id ? "outline-2 outline-offset-4 outline-poke-yellow" : ""}`}>
                <TcgCard img={it.img} name={it.name} rarity={it.rarity} reverse={it.reverse} sizes="140px" />
              </span>
              <span className="mt-1.5 block truncate text-xs">{it.name}</span>
              <span className="hud block text-dim">{fmtUSDT(marketOf(it.card_id) ?? Number(it.value_at_pull))}</span>
            </button>
          </li>
        ))}
      </ul>

      <aside className="h-fit border border-line p-5 lg:sticky lg:top-4" aria-live="polite">
        {!pick ? (
          <p className="gb-dialog">Which card do you want to sell? Pick one from your vault.</p>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!valid) {
                setError("Enter a price between 0.50 and 1,000,000 USDT.");
                return;
              }
              setBusy(true);
              try {
                await api("/api/market/list", { itemId: pick.id, price: n });
                sfx.coin();
                setPick(null);
                onListed();
              } catch (err) {
                sfx.error();
                setError(err instanceof Error ? err.message : "Listing failed");
              } finally {
                setBusy(false);
              }
            }}
          >
            <p className="pixel text-dim">Listing</p>
            <p className="mt-2 font-display text-2xl">{pick.name}</p>
            <RarityTag rarity={pick.rarity} className="mt-1" />
            <p className="hud mt-1 text-faint">{packName(pick.set_id)}</p>
            <label className="hud mt-5 flex flex-col gap-1.5 text-dim">
              Ask price (USDT)
              <input
                inputMode="decimal"
                value={price}
                onChange={(e) => {
                  setPrice(e.target.value.replace(",", "."));
                  setError(null);
                }}
                aria-invalid={!!error}
                className="h-12 border border-line-strong bg-transparent px-3 font-display text-2xl tracking-normal text-poke-yellow normal-case outline-none focus:border-poke-yellow"
              />
            </label>
            <dl className="hud mt-4 grid grid-cols-2 gap-y-2 text-dim">
              <dt>Market</dt>
              <dd className="text-right text-phosphor">{fmtUSDT(market)}</dd>
              <dt>Fee ({ECONOMICS.marketFee * 100}%)</dt>
              <dd className="text-right text-phosphor">−{valid ? fee(n).toFixed(2) : "0.00"}</dd>
              <dt>You receive</dt>
              <dd className="text-right text-ok">{valid ? (n - fee(n)).toFixed(2) : "0.00"} USDT</dd>
              <dt>Or instant buyback</dt>
              <dd className="text-right text-phosphor">{buybackFor(market).toFixed(2)} USDT</dd>
            </dl>
            <p className="hud mt-3 text-faint">Buyers pay you directly on BNB Chain; the card moves to their vault.</p>
            {error && (
              <p role="alert" className="hud mt-3 text-poke-red">
                {error}
              </p>
            )}
            <button type="submit" className="btn btn-primary mt-5 w-full" disabled={!price || busy}>
              {busy ? "Listing…" : "List on PokéMart"}
            </button>
          </form>
        )}
      </aside>
    </div>
  );
}
