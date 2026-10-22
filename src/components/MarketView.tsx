"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useDeferredValue, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { fmtUSDC } from "@/lib/odds";
import { ECONOMICS, buybackFor } from "@/lib/packs";
import { rarityMeta, rarityRank } from "@/lib/rarity";
import { DEMO_OWNER, buyListing, cancelListing, listForSale, marketFee, useMarket, useVault, type Listing, type VaultItem } from "@/lib/vault";
import { CardModal } from "./CardModal";
import { RarityTag, TcgCard } from "./TcgCard";
import { WalletButton, shortAddr } from "./WalletButton";

type Tab = "browse" | "sell" | "mine";
type Sort = "deal" | "price-desc" | "price-asc" | "rarity";

const SORTS: { id: Sort; label: string }[] = [
  { id: "deal", label: "Best deal vs market" },
  { id: "price-desc", label: "Price: high → low" },
  { id: "price-asc", label: "Price: low → high" },
  { id: "rarity", label: "Rarity" },
];

const delta = (l: Listing) => (l.value ? (l.price - l.value) / l.value : 0);

function ago(l: Listing) {
  const h = l.demo ? l.listedAt : Math.floor((Date.now() - l.listedAt) / 3_600_000);
  return h < 1 ? "just now" : h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

function DeltaBadge({ l }: { l: Listing }) {
  const d = delta(l);
  if (!l.value) return null;
  const under = d < -0.005;
  return (
    <span className={`hud ${under ? "text-ok" : d > 0.005 ? "text-warn" : "text-dim"}`}>
      {under ? "▼" : d > 0.005 ? "▲" : "="} {Math.abs(d * 100).toFixed(0)}% {under ? "under" : d > 0.005 ? "over" : "at"} market
    </span>
  );
}

export function MarketView({
  seeded,
  packs,
  dex,
}: {
  seeded: Listing[];
  packs: { id: string; name: string; price: number }[];
  dex: Record<string, { odds: number; supertype: string }>;
}) {
  const params = useSearchParams();
  const { address } = useAccount();
  const owner = address ?? DEMO_OWNER;
  const market = useMarket();
  const vault = useVault(owner);

  const [tab, setTab] = useState<Tab>("browse");
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [pack, setPack] = useState("all");
  const [sort, setSort] = useState<Sort>("deal");
  const [open, setOpen] = useState<Listing | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const q = useDeferredValue(query.trim().toLowerCase());

  const listings = useMemo(() => {
    const live = [...market.listings, ...seeded.filter((l) => !market.soldDemo.includes(l.id))];
    const out = live.filter(
      (l) => (pack === "all" || l.setId === pack) && (!q || l.name.toLowerCase().includes(q)),
    );
    const by: Record<Sort, (a: Listing, b: Listing) => number> = {
      deal: (a, b) => delta(a) - delta(b),
      "price-desc": (a, b) => b.price - a.price,
      "price-asc": (a, b) => a.price - b.price,
      rarity: (a, b) => rarityRank(b.rarity) - rarityRank(a.rarity) || b.price - a.price,
    };
    return out.sort(by[sort]);
  }, [market, seeded, pack, q, sort]);

  const mine = market.listings.filter((l) => l.seller === owner);
  const sellable = vault.items.filter((i) => i.status === "vault").sort((a, b) => b.value - a.value);

  const buy = () => {
    if (!open) return;
    try {
      buyListing(owner, open);
      setResult({ tone: "ok", text: `You got ${open.name}! It's waiting in your vault.` });
    } catch (e) {
      setResult({ tone: "error", text: e instanceof Error ? e.message : "Purchase failed" });
    }
    setConfirm(false);
  };

  const closeModal = () => {
    setOpen(null);
    setConfirm(false);
    setResult(null);
  };

  return (
    <>
      <div className="mt-8 flex flex-wrap items-end justify-between gap-4 border-b border-line">
        <div role="tablist" aria-label="PokéMart" className="hud flex gap-6">
          {(
            [
              ["browse", `Browse (${listings.length})`],
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
          {address ? `Trading as ${shortAddr(address)}` : "Trading as guest (demo vault)"} · {ECONOMICS.marketFee * 100}% seller fee
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

          {listings.length === 0 ? (
            <div className="mx-auto mt-12 max-w-md">
              <p className="gb-dialog">The PokéMart shelves are empty for that search. Try another name or pack.</p>
            </div>
          ) : (
            <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
              {listings.map((l) => (
                <li key={l.id}>
                  <button type="button" onClick={() => setOpen(l)} className="group block w-full cursor-pointer text-left">
                    <span className="block transition-transform duration-300 group-hover:-translate-y-1">
                      <TcgCard img={l.img} name={l.name} rarity={l.rarity} reverse={l.reverse} glow={rarityMeta(l.rarity).hit} sizes="(max-width: 640px) 45vw, 200px" />
                    </span>
                    <span className="mt-2 block truncate text-[13px] group-hover:text-poke-yellow">{l.name}</span>
                    <RarityTag rarity={l.reverse ? "Reverse Holo" : l.rarity} className="mt-1" />
                    <span className="mt-1.5 flex items-baseline justify-between gap-2">
                      <span className="font-display text-xl text-poke-yellow">{l.price.toFixed(2)}</span>
                      <span className="hud text-dim">USDC</span>
                    </span>
                    <DeltaBadge l={l} />
                    <span className="hud mt-0.5 block truncate text-faint">
                      {l.demo ? `${l.seller} · demo` : l.seller === owner ? "Your listing" : shortAddr(l.seller) || l.seller} · {ago(l)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {tab === "sell" && <SellPanel owner={owner} items={sellable} connected={!!address} onListed={() => setTab("mine")} />}

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
                <p className="mt-1 font-display text-xl text-poke-yellow">{l.price.toFixed(2)} USDC</p>
                <DeltaBadge l={l} />
                <button type="button" className="btn btn-ghost hud mt-2 w-full" onClick={() => cancelListing(owner, l.id)}>
                  Cancel listing
                </button>
              </li>
            ))}
          </ul>
        ))}

      {open && (
        <CardModal
          card={{
            ...open,
            price: open.value || null,
            ...dex[open.cardId],
            packPrice: packs.find((p) => p.id === open.setId)?.price,
          }}
          onClose={closeModal}
          actions={
            result?.tone === "ok" ? (
              <Link href="/vault" className="btn btn-primary">
                Open vault
              </Link>
            ) : open.seller === owner ? (
              <button type="button" className="btn" onClick={() => (cancelListing(owner, open.id), closeModal())}>
                Cancel my listing
              </button>
            ) : confirm ? (
              <>
                <button type="button" className="btn btn-primary" onClick={buy}>
                  Yes, buy it
                </button>
                <button type="button" className="btn" onClick={() => setConfirm(false)}>
                  No
                </button>
              </>
            ) : (
              <button type="button" className="btn btn-primary" onClick={() => setConfirm(true)}>
                Buy for {open.price.toFixed(2)} USDC
              </button>
            )
          }
        >
          <div className="mt-6 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="font-display text-4xl text-poke-yellow">{open.price.toFixed(2)} USDC</span>
            <DeltaBadge l={open} />
          </div>
          <p className="hud mt-2 text-faint">
            Seller {open.demo ? `${open.seller} (demo listing)` : open.seller === owner ? "you" : shortAddr(open.seller) || open.seller} · listed {ago(open)}
          </p>
          {confirm && (
            <p className="gb-dialog mt-6" data-more="true">
              Buy {open.name.toUpperCase()} for {open.price.toFixed(2)} USDC?
            </p>
          )}
          {result && (
            <p role={result.tone === "error" ? "alert" : "status"} className={`gb-dialog mt-6 ${result.tone === "error" ? "!text-poke-red" : ""}`}>
              {result.text}
            </p>
          )}
          {!address && !result && (
            <p className="hud mt-4 text-dim">Demo mode: purchases go to the guest vault. Connect a wallet to trade as yourself.</p>
          )}
        </CardModal>
      )}
    </>
  );
}

function SellPanel({ owner, items, connected, onListed }: { owner: string; items: VaultItem[]; connected: boolean; onListed: () => void }) {
  const [pick, setPick] = useState<VaultItem | null>(null);
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const n = Number(price);
  const valid = Number.isFinite(n) && n >= 0.1 && n <= 100_000;

  if (items.length === 0) {
    return (
      <div className="mx-auto mt-12 flex max-w-md flex-col items-center gap-5">
        <p className="gb-dialog">Your vault is empty! Rip a pack first, then come back to sell your pulls.</p>
        <Link href="/" className="btn btn-primary">
          Tune in to a pack
        </Link>
        {!connected && (
          <div className="w-56">
            <WalletButton size="large" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_340px]">
      <ul className="grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 md:grid-cols-5" aria-label="Cards in your vault">
        {items.map((it) => (
          <li key={it.uid}>
            <button
              type="button"
              aria-pressed={pick?.uid === it.uid}
              onClick={() => {
                setPick(it);
                setPrice(it.value ? it.value.toFixed(2) : "");
                setError(null);
              }}
              className={`block w-full cursor-pointer text-left transition-opacity ${pick && pick.uid !== it.uid ? "opacity-50 hover:opacity-90" : ""}`}
            >
              <span className={`block rounded-[4.6%/3.3%] ${pick?.uid === it.uid ? "outline-2 outline-offset-4 outline-poke-yellow" : ""}`}>
                <TcgCard img={it.img} name={it.name} rarity={it.rarity} reverse={it.reverse} sizes="140px" />
              </span>
              <span className="mt-1.5 block truncate text-xs">{it.name}</span>
              <span className="hud block text-dim">{fmtUSDC(it.value)}</span>
            </button>
          </li>
        ))}
      </ul>

      <aside className="h-fit border border-line p-5 lg:sticky lg:top-4" aria-live="polite">
        {!pick ? (
          <p className="gb-dialog">Which card do you want to sell? Pick one from your vault.</p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!valid) {
                setError("Enter a price between 0.10 and 100,000 USDC.");
                return;
              }
              try {
                listForSale(owner, pick.uid, n);
                setPick(null);
                onListed();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Listing failed");
              }
            }}
          >
            <p className="pixel text-dim">Listing</p>
            <p className="mt-2 font-display text-2xl">{pick.name}</p>
            <RarityTag rarity={pick.rarity} className="mt-1" />
            <label className="hud mt-5 flex flex-col gap-1.5 text-dim">
              Ask price (USDC)
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
              <dd className="text-right text-phosphor">{fmtUSDC(pick.value)}</dd>
              <dt>Fee ({ECONOMICS.marketFee * 100}%)</dt>
              <dd className="text-right text-phosphor">−{valid ? marketFee(n).toFixed(2) : "0.00"}</dd>
              <dt>You receive</dt>
              <dd className="text-right text-ok">{valid ? (n - marketFee(n)).toFixed(2) : "0.00"} USDC</dd>
              <dt>Or instant buyback</dt>
              <dd className="text-right text-phosphor">{buybackFor(pick.value).toFixed(2)} USDC</dd>
            </dl>
            {error && (
              <p role="alert" className="hud mt-3 text-poke-red">
                {error}
              </p>
            )}
            <button type="submit" className="btn btn-primary mt-5 w-full" disabled={!price}>
              List on PokéMart
            </button>
          </form>
        )}
      </aside>
    </div>
  );
}
