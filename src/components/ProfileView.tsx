"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { sfx } from "@/lib/audio";
import { LEVELS } from "@/lib/levels";
import { fmtUSDT } from "@/lib/odds";
import { rarityMeta, rarityRank } from "@/lib/rarity";
import { api, useMe } from "@/lib/session";
import { RarityTag } from "./TcgCard";
import { shortAddr } from "./WalletButton";

type Profile = {
  address: string;
  memberSince: string;
  spent: number;
  level: {
    current: { level: number; name: string; minSpent: number; cashback: number };
    next: { level: number; name: string; minSpent: number; cashback: number } | null;
    progress: number;
    toNext: number;
  };
  cashback: { balance: number; earned: number; min: number };
  packs: { paid: number; free: number; sets: number; favoriteSet: string | null };
  pulls: { cards: number; value: number; hits: number };
  best: { name: string; rarity: string; img: string; value: number; set_id: string } | null;
  market: { sold: number; soldTotal: number; bought: number; boughtTotal: number };
  buyback: { paid: number; pending: number };
  rarities: { rarity: string; count: number }[];
  recent: { id: number; setId: string; price: number; at: string; best: { name: string; value: number; rarity: string } | null }[];
  fair: { serverSeedHash: string; clientSeed: string; nonce: number; previousServerSeed: string | null };
};

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="border border-line p-4">
      <p className="hud text-faint">[{label}]</p>
      <p className="mt-1 font-display text-2xl text-phosphor">{value}</p>
      {hint && <p className="hud mt-1 text-dim">{hint}</p>}
    </div>
  );
}

export function ProfileView({ setNames }: { setNames: Record<string, string> }) {
  const me = useMe();
  const { openConnectModal } = useConnectModal();
  const qc = useQueryClient();
  const address = me.data?.address ?? null;
  const p = useQuery<Profile>({ queryKey: ["profile"], queryFn: () => api("/api/profile"), enabled: !!address });
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [seed, setSeed] = useState("");

  if (!me.isLoading && !address) {
    return (
      <div className="mx-auto mt-14 flex max-w-md flex-col items-center gap-5">
        <p className="gb-dialog w-full">Sign in with your wallet to see your trainer card.</p>
        <button type="button" className="btn btn-primary" onClick={() => openConnectModal?.()}>
          Connect wallet
        </button>
      </div>
    );
  }
  if (p.isLoading || !p.data) {
    return p.isError ? (
      <p className="gb-dialog mx-auto mt-12 max-w-md">Couldn&apos;t load your profile. Refresh to try again.</p>
    ) : (
      <div className="skeleton mt-10 h-64 w-full" />
    );
  }
  const d = p.data;
  const net = d.pulls.value - d.spent;
  const raritySorted = [...d.rarities].sort((a, b) => rarityRank(b.rarity) - rarityRank(a.rarity));
  const maxCount = Math.max(1, ...d.rarities.map((r) => r.count));

  const withdraw = async () => {
    try {
      const r = await api<{ amount: number }>("/api/cashback/withdraw", {});
      sfx.coin();
      setNotice({ tone: "ok", text: `Withdrawal of ${r.amount.toFixed(2)} USDT requested — it's sent to your wallet once processed.` });
      qc.invalidateQueries();
    } catch (e) {
      sfx.error();
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Withdrawal failed" });
    }
  };

  const rotate = async () => {
    try {
      const r = await api<{ revealed: string; newHash: string }>("/api/profile/seed", { clientSeed: seed || undefined });
      sfx.select();
      setNotice({ tone: "ok", text: `Previous server seed revealed: ${r.revealed}. New hash: ${r.newHash.slice(0, 16)}…` });
      setSeed("");
      qc.invalidateQueries({ queryKey: ["profile"] });
    } catch (e) {
      sfx.error();
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Couldn't rotate the seed" });
    }
  };

  return (
    <>
      {/* trainer card */}
      <section className="mt-8 grid gap-6 border border-line-strong bg-[#0b0d11]/70 p-5 sm:p-7 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="pixel text-dim">Trainer card · {shortAddr(d.address)}</p>
          <div className="mt-4 flex flex-wrap items-baseline gap-x-4">
            <span className="poke-title text-[clamp(2.2rem,5vw,3.6rem)] leading-none">{d.level.current.name}</span>
            <span className="pixel text-poke-yellow">Lv. {d.level.current.level}</span>
          </div>
          <p className="hud mt-3 text-dim">
            {(d.level.current.cashback * 100).toFixed(1)}% cashback on every pack · member since{" "}
            {new Date(d.memberSince).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
          </p>
          <div className="mt-6">
            <div className="flex items-center gap-3">
              <span className="pixel text-poke-yellow">EXP</span>
              <div className="loader-hp relative h-3 flex-1" aria-hidden="true">
                <div className="h-full" style={{ width: `${Math.round(d.level.progress * 100)}%`, background: "var(--poke-blue)" }} />
              </div>
            </div>
            <p className="hud mt-2 text-dim">
              {d.level.next
                ? `${fmtUSDT(d.level.toNext)} more on packs to reach ${d.level.next.name} (${(d.level.next.cashback * 100).toFixed(1)}% cashback)`
                : "Max level reached — Champion!"}
            </p>
          </div>
          <ol className="mt-5 flex flex-wrap gap-1.5" aria-label="Levels">
            {LEVELS.map((l) => (
              <li
                key={l.level}
                className={`hud border px-2 py-1 ${l.level <= d.level.current.level ? "border-poke-yellow text-poke-yellow" : "border-line text-faint"}`}
                title={`${l.name}: from ${l.minSpent} USDT spent, ${(l.cashback * 100).toFixed(1)}% cashback`}
              >
                {l.level}. {l.name}
              </li>
            ))}
          </ol>
        </div>
        <div className="flex flex-col justify-between gap-4 border-t border-line pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
          <div>
            <p className="hud text-faint">[Cashback balance]</p>
            <p className="mt-1 font-display text-4xl text-poke-yellow">{fmtUSDT(d.cashback.balance)}</p>
            <p className="hud mt-1 text-dim">Earned so far: {fmtUSDT(d.cashback.earned)}</p>
          </div>
          <button type="button" className="btn btn-primary" disabled={d.cashback.balance < d.cashback.min} onClick={withdraw}>
            {d.cashback.balance < d.cashback.min ? `Withdraw from ${d.cashback.min} USDT` : "Withdraw cashback"}
          </button>
        </div>
      </section>

      {notice && (
        <p role={notice.tone === "error" ? "alert" : "status"} className={`hud mt-4 break-all ${notice.tone === "error" ? "text-poke-red" : "text-ok"}`}>
          {notice.text}
        </p>
      )}

      {/* stats */}
      <section aria-label="Stats" className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Spent on packs" value={fmtUSDT(d.spent)} />
        <Stat label="Packs opened" value={String(d.packs.paid + d.packs.free)} hint={d.packs.free ? `${d.packs.free} free from missions` : undefined} />
        <Stat label="Cards pulled" value={String(d.pulls.cards)} hint={`${d.pulls.hits} hits`} />
        <Stat label="Value pulled" value={fmtUSDT(d.pulls.value)} hint={`${net >= 0 ? "+" : "−"}${fmtUSDT(Math.abs(net))} vs spent`} />
        <Stat label="Buybacks" value={fmtUSDT(d.buyback.paid)} hint={d.buyback.pending ? `${fmtUSDT(d.buyback.pending)} pending` : undefined} />
        <Stat label="Sold on PokéMart" value={fmtUSDT(d.market.soldTotal)} hint={`${d.market.sold} card${d.market.sold === 1 ? "" : "s"}`} />
        <Stat label="Bought on PokéMart" value={fmtUSDT(d.market.boughtTotal)} hint={`${d.market.bought} card${d.market.bought === 1 ? "" : "s"}`} />
        <Stat
          label="Favourite channel"
          value={d.packs.favoriteSet ? (setNames[d.packs.favoriteSet] ?? d.packs.favoriteSet) : "—"}
          hint={`${d.packs.sets} set${d.packs.sets === 1 ? "" : "s"} opened`}
        />
      </section>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_1.2fr]">
        {/* best pull + rarities */}
        <section aria-labelledby="best">
          <h2 id="best" className="font-display text-2xl">
            Best pull
          </h2>
          {d.best ? (
            <div className="mt-4 flex gap-5">
              <Image src={d.best.img} alt={d.best.name} width={160} height={223} className="h-auto w-32 rounded-[4.6%/3.3%]" />
              <div>
                <p className="font-display text-xl">{d.best.name}</p>
                <RarityTag rarity={d.best.rarity} className="mt-1" />
                <p className="mt-2 font-display text-2xl text-poke-yellow">{fmtUSDT(d.best.value)}</p>
                <p className="hud mt-1 text-faint">{setNames[d.best.set_id] ?? d.best.set_id}</p>
              </div>
            </div>
          ) : (
            <p className="gb-dialog mt-4">No pulls yet. Your best card will show up here.</p>
          )}

          <h2 className="mt-10 font-display text-2xl">Pulls by rarity</h2>
          <ul className="mt-4 flex flex-col gap-2">
            {raritySorted.length === 0 && <li className="hud text-faint">Nothing pulled yet.</li>}
            {raritySorted.map((r) => (
              <li key={r.rarity} className="grid grid-cols-[minmax(0,10rem)_1fr_3rem] items-center gap-3">
                <RarityTag rarity={r.rarity} />
                <span className="h-1.5 bg-line">
                  <span
                    className="block h-full"
                    style={{ width: `${(r.count / maxCount) * 100}%`, background: r.rarity === "Reverse Holo" ? "var(--r-rare)" : rarityMeta(r.rarity).color }}
                  />
                </span>
                <span className="hud text-right text-dim">{r.count}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* activity */}
        <section aria-labelledby="recent">
          <h2 id="recent" className="font-display text-2xl">
            Recent rips
          </h2>
          <ol className="mt-4 border-t border-line">
            {d.recent.length === 0 && (
              <li className="hud py-3 text-faint">
                No packs opened yet — <Link href="/" className="link-hud text-poke-yellow">tune in</Link>.
              </li>
            )}
            {d.recent.map((r) => (
              <li key={r.id} className="hud flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line py-3">
                <span className="text-dim">{new Date(r.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                <span className="flex-1 truncate normal-case">{setNames[r.setId] ?? r.setId}</span>
                {r.best && (
                  <span className="truncate normal-case" style={{ color: rarityMeta(r.best.rarity).color }}>
                    {r.best.name} · {fmtUSDT(r.best.value)}
                  </span>
                )}
                <span className="text-dim">{r.price ? `${r.price.toFixed(2)} USDT` : "free"}</span>
              </li>
            ))}
          </ol>

          <h2 className="mt-10 font-display text-2xl">Provably fair</h2>
          <p className="mt-2 text-sm leading-relaxed text-phosphor/80">
            Every pack is drawn from HMAC-SHA256(server seed, client seed : nonce). The server seed is committed by its hash before you buy;
            rotate it to reveal the old seed and re-check any past pack.
          </p>
          <dl className="hud mt-4 grid gap-2 break-all text-dim">
            <div>
              <dt className="text-faint">Server seed hash</dt>
              <dd className="text-phosphor normal-case">{d.fair.serverSeedHash}</dd>
            </div>
            <div>
              <dt className="text-faint">Client seed · next nonce</dt>
              <dd className="text-phosphor normal-case">
                {d.fair.clientSeed} · {d.fair.nonce}
              </dd>
            </div>
            {d.fair.previousServerSeed && (
              <div>
                <dt className="text-faint">Previous server seed (revealed)</dt>
                <dd className="text-phosphor normal-case">{d.fair.previousServerSeed}</dd>
              </div>
            )}
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <input
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              placeholder="New client seed (optional)"
              maxLength={64}
              aria-label="New client seed"
              className="h-11 min-w-[200px] flex-1 border border-line-strong bg-transparent px-3 font-mono text-sm text-phosphor outline-none placeholder:text-faint focus:border-poke-yellow"
            />
            <button type="button" className="btn" onClick={rotate}>
              Rotate seed
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
