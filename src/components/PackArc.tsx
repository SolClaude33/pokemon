"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fmtUSDC } from "@/lib/odds";
import { useMounted, useReducedMotion, useWebGL } from "@/lib/useClient";
import { LoadingScreen } from "./LoadingScreen";
import { PackArt } from "./PackArt";

const ArcCanvas = dynamic(() => import("./three/ArcCanvas"), { ssr: false });

export type ArcPack = {
  setId: string;
  name: string;
  series: string;
  channel: number;
  price: number;
  tagline: string;
  packImage: string;
  logo: string;
  accent: string;
  cards: number;
  ev: number;
  topHit: { name: string; price: number } | null;
};

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Signed distance from the active item, wrapped so the arc loops. */
function offset(i: number, active: number, n: number) {
  let d = i - active;
  if (d > n / 2) d -= n;
  if (d < -n / 2) d += n;
  return d;
}

export function PackArc({ packs }: { packs: ArcPack[] }) {
  const router = useRouter();
  const [active, setActive] = useState(0);
  const [hint, setHint] = useState(true);
  const [ready3d, setReady3d] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const mounted = useMounted();
  const webgl = useWebGL();
  // 3D when possible; the CSS arc only without WebGL or if the scene never loads
  const use3d = webgl && !timedOut;
  const showCss = mounted && !use3d;
  const loading = !mounted || (use3d && !ready3d);
  const reducedMotion = useReducedMotion();
  const touch = useRef<number | null>(null);
  const n = packs.length;
  const onReady = useCallback(() => setReady3d(true), []);
  const specs = useMemo(
    () => packs.map((p) => ({ setId: p.setId, setName: p.name, packImage: p.packImage, logo: p.logo, accent: p.accent, cards: p.cards })),
    [packs],
  );
  const current = packs[active];

  const go = useCallback((delta: number) => {
    setHint(false);
    setActive((a) => (a + delta + n) % n);
  }, [n]);

  useEffect(() => {
    packs.forEach((p) => router.prefetch(`/packs/${p.setId}`));
  }, [packs, router]);

  useEffect(() => {
    if (!webgl || ready3d) return;
    const t = setTimeout(() => setTimedOut(true), 10_000);
    return () => clearTimeout(t);
  }, [webgl, ready3d]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest("input, textarea, select, [role=dialog]")) return;
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "Enter" && !el?.closest("a, button")) router.push(`/packs/${packs[active].setId}`);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, router, packs, active]);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Booster packs on air"
      className="absolute inset-0 overflow-hidden"
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touch.current == null) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
        touch.current = null;
      }}
    >
      {/* accent light behind the active pack */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 transition-[background] duration-[900ms]"
        style={{
          background: `radial-gradient(38% 42% at 50% 40%, color-mix(in oklab, ${current.accent} 22%, transparent), transparent 70%)`,
        }}
      />

      {use3d && (
        <div className={`absolute inset-0 transition-opacity duration-700 ${ready3d ? "opacity-100" : "opacity-0"}`}>
        <ArcCanvas
          packs={specs}
          active={active}
          reducedMotion={reducedMotion}
          onReady={onReady}
          onSelect={(i) => {
            setHint(false);
            setActive(i);
          }}
          onOpen={(i) => router.push(`/packs/${packs[i].setId}`)}
        />
        </div>
      )}

      {/* CSS arc: fallback without WebGL */}
      {showCss && (
      <div className="arc-stage">
        {packs.map((p, i) => {
          const d = offset(i, active, n);
          const ad = Math.abs(d);
          const isActive = d === 0;
          return (
            <div
              key={p.setId}
              className="arc-item"
              data-active={isActive}
              aria-hidden={!isActive}
              style={{
                transform: `translateX(calc(${d} * var(--pack-w) * 1.32)) translateY(calc(${ad * 0.07 + ad * ad * 0.05} * var(--pack-h))) rotate(${d * 9}deg) rotateY(${d * -14}deg) translateZ(${-ad * 80}px) scale(${isActive ? 1.04 : 0.9})`,
                filter: isActive ? "none" : `brightness(${0.44 - ad * 0.12}) saturate(0.6)`,
                opacity: ad > 2 ? 0 : 1,
                zIndex: 10 - ad,
              }}
            >
              {isActive ? (
                <Link href={`/packs/${p.setId}`} aria-label={`Open ${p.name} — ${p.price} USDC`} className="block">
                  <PackArt src={p.packImage} alt={`${p.name} booster pack`} priority />
                </Link>
              ) : (
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => go(d)}
                  className="block w-full cursor-pointer"
                  aria-label={`Show ${p.name}`}
                >
                  <PackArt src={p.packImage} alt="" interactive={false} />
                </button>
              )}
            </div>
          );
        })}
      </div>
      )}

      {/* animated loader: hides the stage until the 3D packs are in their final place */}
      <LoadingScreen ready={!loading} minDuration={4000} introKey="pc:intro" />

      {/* caption under the active pack, Arc-style */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[36%] bg-gradient-to-t from-screen via-screen/85 to-transparent"
      />
      <div className="absolute inset-x-0 bottom-[clamp(52px,8vh,84px)] z-20 flex flex-col items-center px-6 text-center [text-shadow:0_2px_12px_#000]">
        <div key={current.setId} className="fade-up flex flex-col items-center">
          <p className="pixel text-[10px] text-dim">
            CH {pad2(current.channel)} · {current.series}
          </p>
          <h1 className="poke-title mt-2 text-[clamp(1.9rem,3.6vw,2.8rem)] leading-none [text-shadow:none]">{current.name}</h1>
          <p className="hud mt-3 max-w-[38ch] text-phosphor/85">{current.tagline}</p>
          <p className="hud mt-2 flex flex-wrap justify-center gap-x-3 text-dim">
            <span>
              Pack <span className="text-phosphor">{current.price.toFixed(2)} USDC</span>
            </span>
            <span aria-hidden="true">•</span>
            <span>EV {fmtUSDC(current.ev)}</span>
            {current.topHit && (
              <>
                <span aria-hidden="true" className="hidden sm:inline">•</span>
                <span className="hidden sm:inline">
                  Top hit {current.topHit.name} {fmtUSDC(current.topHit.price)}
                </span>
              </>
            )}
          </p>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button type="button" onClick={() => go(-1)} className="btn btn-ghost hud" aria-label="Previous pack">
            ←
          </button>
          <Link href={`/packs/${current.setId}`} className="btn btn-primary">
            Tune in · View odds
          </Link>
          <button type="button" onClick={() => go(1)} className="btn btn-ghost hud" aria-label="Next pack">
            →
          </button>
        </div>
        <p className={`hud mt-3 hidden text-faint transition-opacity duration-700 md:block ${hint ? "opacity-100" : "opacity-0"}`}>
          Use ← → to change channel, Enter to tune in
        </p>
      </div>

      <p className="sr-only" aria-live="polite">
        {current.name}, {current.price} USDC per pack. {active + 1} of {n}.
      </p>
    </section>
  );
}
