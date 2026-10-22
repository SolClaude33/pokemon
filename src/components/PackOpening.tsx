"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fmtUSDC, type Pull } from "@/lib/odds";
import { duckMusic, sfx } from "@/lib/audio";
import { buybackFor } from "@/lib/packs";
import { rarityMeta } from "@/lib/rarity";
import { sellBack } from "@/lib/vault";
import { CardBack, RarityTag, TcgCard } from "./TcgCard";

type Phase = "sealed" | "tearing" | "reveal" | "summary" | "done";

type Props = {
  owner: string;
  /** free rip without a wallet */
  demo?: boolean;
  pulls: Pull[];
  packImage: string;
  setName: string;
  price: number;
  onClose: () => void;
  onAgain: () => void;
};

const isHit = (p: Pull) => !p.reverse && rarityMeta(p.rarity).hit;

/** fanfare size: 1 double rare / holo / IR, 2 ultra, 3 SIR, 4 gold */
function hitTier(rarity: string) {
  if (/Hyper/.test(rarity)) return 4;
  if (rarity === "Special Illustration Rare") return 3;
  if (rarity === "Ultra Rare" || rarity === "Mega Attack Rare") return 2;
  return 1;
}

export function PackOpening({ owner, demo = false, pulls, packImage, setName, price, onClose, onAgain }: Props) {
  const [phase, setPhase] = useState<Phase>("sealed");
  const [shown, setShown] = useState(0); // number of cards revealed
  const [suspense, setSuspense] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<{ total: number; count: number } | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const total = useMemo(() => pulls.reduce((a, p) => a + p.value, 0), [pulls]);
  const revealedValue = pulls.slice(0, shown).reduce((a, p) => a + p.value, 0);
  const best = useMemo(() => [...pulls].sort((a, b) => b.value - a.value)[0], [pulls]);

  const tear = useCallback(() => {
    if (phase !== "sealed") return;
    setPhase("tearing");
    sfx.tear();
    setTimeout(() => setPhase("reveal"), 1050);
  }, [phase]);

  const next = useCallback(() => {
    if (phase !== "reveal" || suspense) return;
    if (shown >= pulls.length) {
      sfx.select();
      setPhase("summary");
      return;
    }
    const upcoming = pulls[shown];
    if (isHit(upcoming)) {
      setSuspense(true);
      sfx.suspense(900);
      setTimeout(() => {
        setSuspense(false);
        setShown((s) => s + 1);
        sfx.hit(hitTier(upcoming.rarity));
      }, 900);
    } else {
      sfx.flip();
      setShown((s) => s + 1);
    }
  }, [phase, suspense, shown, pulls]);

  useEffect(() => {
    dialogRef.current?.focus();
  }, [phase]);

  useEffect(() => {
    duckMusic(true);
    return () => duckMusic(false);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && phase !== "tearing") onClose();
      if (e.key === " " || e.key === "Enter" || e.key === "ArrowRight") {
        if ((e.target as HTMLElement).closest("button, a, input")) return;
        e.preventDefault();
        if (phase === "sealed") tear();
        else if (phase === "reveal") next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, tear, next, onClose]);

  const current = shown > 0 ? pulls[shown - 1] : null;
  const upcoming = pulls[shown];
  const selectedValue = pulls.filter((p) => selected.has(p.uid)).reduce((a, p) => a + buybackFor(p.value), 0);

  const toggle = (uid: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(uid)) n.delete(uid);
      else n.add(uid);
      return n;
    });

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Opening ${setName}`}
      tabIndex={-1}
      className="absolute inset-0 z-30 overflow-y-auto bg-[radial-gradient(70%_60%_at_50%_45%,#141822,#07080a_80%)] outline-none"
    >
      <div className="hud absolute inset-x-0 top-0 z-10 flex items-center justify-between px-[clamp(16px,3.4vw,40px)] pt-[clamp(14px,3.2vh,34px)]">
        <span className="flex items-center gap-2 text-signal">
          <span className="rec-dot" aria-hidden="true" /> Live rip · {setName}
        </span>
        {phase !== "tearing" && (
          <button type="button" onClick={onClose} className="link-hud cursor-pointer">
            [ Close ]
          </button>
        )}
      </div>

      {/* SEALED / TEARING */}
      {(phase === "sealed" || phase === "tearing") && (
        <div className="flex min-h-full flex-col items-center justify-center gap-6 px-6 py-24">
          <button
            type="button"
            onClick={tear}
            disabled={phase === "tearing"}
            aria-label="Tear the pack open"
            className="group relative w-[min(62vw,300px)] cursor-pointer disabled:cursor-default"
            style={{ aspectRatio: "548 / 1000", animation: phase === "tearing" ? "shake 420ms linear 1" : undefined }}
          >
            {/* body */}
            <span
              className="absolute inset-0"
              style={{
                clipPath: "inset(13% 0 0 0)",
                animation: phase === "tearing" ? "pack-drop 700ms 520ms var(--ease-in-out) forwards" : undefined,
              }}
            >
              <Image src={packImage} alt="" fill sizes="300px" className="pack-img" loading="eager" />
            </span>
            {/* top seal */}
            <span
              className="absolute inset-0"
              style={{
                clipPath: "polygon(0 0, 100% 0, 100% 12%, 92% 13.4%, 84% 12.2%, 76% 13.6%, 68% 12.4%, 60% 13.5%, 52% 12.3%, 44% 13.6%, 36% 12.4%, 28% 13.5%, 20% 12.3%, 12% 13.5%, 4% 12.4%, 0 13%)",
                animation: phase === "tearing" ? "tear-off 620ms 380ms var(--ease-out) forwards" : undefined,
              }}
            >
              <Image src={packImage} alt="" fill sizes="300px" className="pack-img" loading="eager" />
            </span>
            {phase === "sealed" && (
              <span className="hud pointer-events-none absolute inset-x-[-10%] top-[12.6%] flex items-center gap-2 text-phosphor">
                <span aria-hidden="true">✂</span>
                <span className="h-px flex-1 border-t border-dashed border-phosphor/80 transition-[border-color] group-hover:border-phosphor" />
              </span>
            )}
          </button>
          {phase === "sealed" ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <p className="hud text-dim">{demo ? "Free demo rip" : "Payment confirmed"} · {pulls.length} cards sealed inside</p>
              <button type="button" onClick={tear} className="btn btn-holo">
                Tear open
              </button>
              <p className="hud text-faint">Click the seal or press Space</p>
            </div>
          ) : (
            <p className="hud text-dim" role="status">
              Ripping…
            </p>
          )}
        </div>
      )}

      {/* hit flash */}
      {phase === "reveal" && current && isHit(current) && (
        <span
          key={`flash-${current.uid}`}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            background: `radial-gradient(60% 55% at 40% 45%, ${rarityMeta(current.rarity).color}, transparent 70%)`,
            animation: "flash 1100ms var(--ease-out) forwards",
            mixBlendMode: "screen",
          }}
        />
      )}

      {/* REVEAL */}
      {phase === "reveal" && (
        <div className="grid min-h-full grid-rows-[1fr_auto] px-[clamp(16px,3.4vw,40px)] pt-20 pb-[clamp(64px,10vh,96px)] md:grid-cols-[1fr_minmax(220px,280px)] md:grid-rows-1 md:gap-8">
          <div className="flex flex-col items-center justify-center gap-5">
            <button
              type="button"
              onClick={next}
              className="relative w-[min(60vw,300px,40vh)] cursor-pointer"
              aria-label={shown >= pulls.length ? "Show summary" : `Reveal card ${shown + 1} of ${pulls.length}`}
            >
              {/* remaining stack */}
              {shown < pulls.length && (
                <span className="absolute inset-0 translate-x-3 translate-y-2 rotate-3 opacity-60">
                  <CardBack />
                </span>
              )}
              {current ? (
                <span
                  key={current.uid}
                  className="relative block"
                  style={{ animation: "signal-in 520ms var(--ease-out) both" }}
                >
                  <TcgCard img={current.card.img} name={current.card.name} rarity={current.rarity} reverse={current.reverse} glow={isHit(current)} sizes="300px" eager />
                </span>
              ) : (
                <span className="relative block" style={{ animation: "card-rise 700ms var(--ease-out) both" }}>
                  <CardBack />
                </span>
              )}
              {suspense && upcoming && (
                <span
                  className="absolute inset-0 rounded-[4.6%/3.3%]"
                  style={{
                    animation: "shake 300ms linear 3",
                    boxShadow: `0 0 60px 12px ${rarityMeta(upcoming.rarity).color}`,
                  }}
                >
                  <CardBack />
                </span>
              )}
            </button>

            <div className="min-h-[3.5rem] text-center" aria-live="polite">
              {current && !suspense && (
                <div key={current.uid} className="fade-up">
                  {isHit(current) ? (
                    <p className="gb-dialog mb-3 max-w-[34ch]" data-more="true">
                      Wow! You pulled {current.card.name.toUpperCase()}!
                    </p>
                  ) : (
                    <p className="font-display text-xl">{current.card.name}</p>
                  )}
                  <p className="mt-1 flex items-center justify-center gap-3">
                    <RarityTag rarity={current.rarity} />
                    <span className="hud text-dim">{fmtUSDC(current.value)}</span>
                  </p>
                </div>
              )}
              {suspense && <p className="pixel text-warn">What? Something shiny…</p>}
            </div>

            <div className="flex items-center gap-3">
              <button type="button" onClick={next} className="btn btn-primary" disabled={suspense}>
                {shown >= pulls.length ? "See results" : shown === 0 ? "Reveal first card" : "Next card"}
              </button>
              {shown < pulls.length && (
                <button
                  type="button"
                  onClick={() => {
                    sfx.select();
                    setPhase("summary");
                  }}
                  className="btn btn-ghost hud"
                >
                  Reveal all
                </button>
              )}
            </div>
          </div>

          {/* broadcast log */}
          <aside className="hidden flex-col justify-center md:flex" aria-label="Revealed cards">
            <div className="hud mb-3 flex justify-between text-dim">
              <span>
                {String(shown).padStart(2, "0")} / {pulls.length}
              </span>
              <span>Value {fmtUSDC(revealedValue)}</span>
            </div>
            <ol className="flex flex-col border-t border-line">
              {pulls.map((p, i) => (
                <li key={p.uid} className="hud flex items-center justify-between gap-3 border-b border-line py-2">
                  {i < shown ? (
                    <>
                      <span className="flex min-w-0 items-center gap-2">
                        <span style={{ color: p.reverse ? "var(--r-rare)" : rarityMeta(p.rarity).color }} aria-hidden="true">
                          {p.reverse ? "◐" : rarityMeta(p.rarity).glyph}
                        </span>
                        <span className="truncate normal-case">{p.card.name}</span>
                      </span>
                      <span className="text-dim tabular-nums">{fmtUSDC(p.value)}</span>
                    </>
                  ) : (
                    <span className="text-faint">— {p.slot}</span>
                  )}
                </li>
              ))}
            </ol>
          </aside>
        </div>
      )}

      {/* SUMMARY */}
      {phase === "summary" && (
        <div className="mx-auto max-w-6xl px-[clamp(16px,3.4vw,40px)] pt-20">
          <div className="fade-up flex flex-wrap items-end justify-between gap-6 border-b border-line pb-6">
            <div>
              <p className="pixel text-[10px] text-dim">Rip complete · {setName}</p>
              <h2 className="poke-title mt-3 text-[clamp(2rem,4.4vw,3.2rem)] leading-none">
                {fmtUSDC(total)} <span className="text-dim">pulled</span>
              </h2>
              <p className="hud mt-3 text-dim">
                {demo ? "Free demo rip" : `Paid ${price.toFixed(2)} USDC`} · Best pull {best.card.name} ({fmtUSDC(best.value)})
                {!demo && (
                  <>
                    {" "}·{" "}
                    <span className={total >= price ? "text-ok" : "text-dim"}>
                      {total >= price ? "+" : "−"}
                      {fmtUSDC(Math.abs(total - price))} vs pack
                    </span>
                  </>
                )}
              </p>
            </div>
            <div className="hud flex flex-wrap gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => setSelected(new Set(pulls.filter((p) => p.value < 1).map((p) => p.uid)))}>
                Select under $1
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setSelected(new Set(pulls.map((p) => p.uid)))}>
                Select all
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setSelected(new Set())}>
                Clear
              </button>
            </div>
          </div>

          <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
            {pulls.map((p, i) => {
              const on = selected.has(p.uid);
              return (
                <li key={p.uid} className="fade-up" style={{ animationDelay: `${i * 45}ms` }}>
                  <label className="group block cursor-pointer">
                    <input type="checkbox" className="peer sr-only" checked={on} onChange={() => toggle(p.uid)} />
                    <span className={`block transition-[opacity,transform] duration-300 ${on ? "scale-[0.96] opacity-60" : ""} peer-focus-visible:outline peer-focus-visible:outline-1 peer-focus-visible:outline-dashed peer-focus-visible:outline-offset-4`}>
                      <TcgCard img={p.card.img} name={p.card.name} rarity={p.rarity} reverse={p.reverse} glow={isHit(p)} sizes="(max-width: 640px) 45vw, 200px" />
                    </span>
                    <span className="mt-2 block">
                      <span className="block truncate text-[13px]">{p.card.name}</span>
                      <RarityTag rarity={p.rarity} className="mt-1" />
                      <span className="hud mt-1 flex items-center justify-between text-dim">
                        <span>{fmtUSDC(p.value)}</span>
                        <span className={on ? "text-ok" : "group-hover:text-phosphor"}>
                          {on ? "■" : "□"} Sell {fmtUSDC(buybackFor(p.value))}
                        </span>
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>

          <div className="sticky bottom-0 z-40 -mx-[clamp(16px,3.4vw,40px)] mt-10 border-t border-line bg-[#0b0d11]/95 px-[clamp(16px,3.4vw,40px)] pt-4 pb-[clamp(16px,4vh,36px)] backdrop-blur">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
              <p className="hud text-dim">
                {selected.size ? (
                  <>
                    {selected.size} selected · instant buyback <span className="text-phosphor">{fmtUSDC(selectedValue)}</span>
                  </>
                ) : (
                  "Unselected cards stay in your vault. Ship them home anytime."
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setResult({ total: 0, count: 0 });
                    setPhase("done");
                  }}
                >
                  Keep all in vault
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!selected.size}
                  onClick={() => {
                    setResult(sellBack(owner, [...selected]));
                    sfx.coin();
                    setPhase("done");
                  }}
                >
                  Sell back {selected.size || ""} for {fmtUSDC(selectedValue)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DONE */}
      {phase === "done" && result && (
        <div className="flex min-h-full flex-col items-center justify-center gap-5 px-6 py-24 text-center">
          <p className="pixel text-[10px] text-ok">Transmission received</p>
          <h2 className="poke-title fade-up max-w-[22ch] text-[clamp(2rem,4.4vw,3.2rem)] leading-tight">
            {result.count
              ? `${result.total.toFixed(2)} USDC credited for ${result.count} card${result.count > 1 ? "s" : ""}.`
              : `All ${pulls.length} cards are in your vault.`}
          </h2>
          <p className="hud max-w-[52ch] text-dim">
            {result.count && result.count < pulls.length
              ? `${pulls.length - result.count} card${pulls.length - result.count === 1 ? "" : "s"} kept in your vault. `
              : ""}
            {demo
              ? "This was a free demo rip — connect a wallet on BNB Chain to rip for real."
              : "Demo mode — balances are simulated and no USDC moved on-chain."}
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <button type="button" className="btn btn-holo" onClick={onAgain}>
              {demo ? "Another demo rip" : "Rip another"}
            </button>
            <Link href="/vault" className="btn">
              Open vault
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
