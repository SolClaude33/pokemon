"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { Logo } from "./Logo";
import { WalletButton } from "./WalletButton";

const pad = (n: number) => String(n).padStart(2, "0");

// One-second ticker shared by the HUD clocks; the session starts on first subscribe.
let sessionStart: number | null = null;
const subscribeTick = (cb: () => void) => {
  sessionStart ??= Date.now();
  const t = setInterval(cb, 1000);
  return () => clearInterval(t);
};
const tick = () => Math.floor(Date.now() / 1000);

function useClock() {
  const sec = useSyncExternalStore(subscribeTick, tick, () => null);
  if (sec == null) return { clock: "--:--", timer: "00:00:00" };
  const now = new Date(sec * 1000);
  const elapsed = Math.max(0, sec - Math.floor((sessionStart ?? sec * 1000) / 1000));
  return {
    clock: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    timer: `${pad(Math.floor(elapsed / 3600))}:${pad(Math.floor(elapsed / 60) % 60)}:${pad(elapsed % 60)}`,
  };
}

function BootScreen({ onDone }: { onDone: () => void }) {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    try {
      if (sessionStorage.getItem("hv:booted")) {
        onDone();
        return;
      }
    } catch {}
    let p = 0;
    const t = setInterval(() => {
      p = Math.min(100, p + 7 + Math.random() * 16);
      setPct(Math.floor(p));
      if (p >= 100) {
        clearInterval(t);
        setTimeout(onDone, 220);
      }
    }, 70);
    return () => clearInterval(t);
  }, [onDone]);
  return (
    <div className="absolute inset-0 z-30 flex items-end bg-screen px-[clamp(20px,4vw,40px)] pb-[clamp(56px,9vh,84px)]" role="status" aria-label="Loading">
      <div className="w-full">
        <div className="hud mb-3 flex justify-between text-dim">
          <span>Tuning channel</span>
          <span>{pct}</span>
        </div>
        <div className="boot-bar" style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }} />
      </div>
    </div>
  );
}

const NAV_LEFT = [
  { href: "/dex", label: "Dex", short: "Dex" },
  { href: "/market", label: "PokéMart", short: "Mart" },
];
const NAV_RIGHT = [
  { href: "/vault", label: "Vault", short: "Vault" },
  { href: "/how-it-works", label: "How it works", short: "Info" },
];

export function TvShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { clock, timer } = useClock();
  const [bw, setBw] = useState(false);
  const [booting, setBooting] = useState(true);

  const doneBoot = useCallback(() => {
    setBooting(false);
    try {
      sessionStorage.setItem("hv:booted", "1");
    } catch {}
  }, []);

  return (
    <div className="tv">
      <div className="screen" data-bw={bw ? "on" : "off"}>
        <div className="screen-content">
          <main id="channel" className="absolute inset-0">
            {children}
          </main>

          {/* top HUD */}
          <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between px-[clamp(16px,3.4vw,40px)] pt-[clamp(14px,3.2vh,34px)] sm:grid sm:grid-cols-[1fr_auto_1fr]">
            <div className="hud pointer-events-auto hidden items-center gap-5 sm:flex">
              <Link href="/" className="link-hud" aria-current={pathname === "/" ? "page" : undefined}>
                Packs
              </Link>
              {NAV_LEFT.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="link-hud hidden md:inline"
                  aria-current={pathname.startsWith(n.href) ? "page" : undefined}
                >
                  {n.label}
                </Link>
              ))}
              <span className="hidden text-dim tabular-nums xl:inline" aria-label="Time on channel">
                {timer}
              </span>
            </div>
            <Link href="/" className="pointer-events-auto" aria-label="PokéCast home">
              <Logo />
            </Link>
            <nav aria-label="Main" className="hud pointer-events-auto flex items-center justify-end gap-5">
              {NAV_RIGHT.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="link-hud hidden md:inline"
                  aria-current={pathname.startsWith(n.href) ? "page" : undefined}
                >
                  {n.label}
                </Link>
              ))}
              <WalletButton />
            </nav>
          </header>

          {/* bottom HUD */}
          <footer className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between px-[clamp(16px,3.4vw,40px)] pb-[clamp(14px,3.2vh,34px)]">
            <div className="hud pointer-events-auto flex items-center gap-5 text-dim">
              <span className="hidden tabular-nums sm:inline" suppressHydrationWarning>
                {clock}
              </span>
              <button
                type="button"
                className="link-hud cursor-pointer text-dim hover:text-phosphor"
                aria-pressed={bw}
                onClick={() => setBw((v) => !v)}
              >
                B&amp;W [{bw ? "On" : "Off"}]
              </button>
            </div>
            <div className="hud pointer-events-auto flex items-center gap-5 text-dim">
              {[...NAV_LEFT, ...NAV_RIGHT].map((n) => (
                <Link key={n.href} href={n.href} className="link-hud md:hidden" aria-current={pathname.startsWith(n.href) ? "page" : undefined}>
                  {n.short}
                </Link>
              ))}
              <span className="hidden items-center gap-2 sm:flex">
                <span className="rec-dot" aria-hidden="true" />
                Source: BNB Chain
              </span>
            </div>
          </footer>

          {booting && <BootScreen onDone={doneBoot} />}
        </div>

        <div className="crt-overlay crt-mask" aria-hidden="true" />
        <div className="crt-overlay crt-scanlines" aria-hidden="true" />
        <div className="crt-overlay crt-vignette" aria-hidden="true" />
        <div className="crt-overlay crt-glare" aria-hidden="true" />
        <div className="crt-overlay crt-flicker" aria-hidden="true" />
      </div>
    </div>
  );
}
