"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import type { Address } from "viem";
import { initAudioOnGesture, setAudioPrefs, useAudioPrefs } from "@/lib/audio";
import { useResumePayments } from "@/lib/pay";
import { useMe } from "@/lib/session";
import { Logo } from "./Logo";
import { ContractAddress, XLink } from "./SiteLinks";
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

// CRT filter preference (scanlines, RGB mask, vignette, glare), saved per browser.
const CRT_KEY = "pc:crt";
const crtListeners = new Set<() => void>();
const readCrt = () => {
  try {
    return localStorage.getItem(CRT_KEY) !== "off";
  } catch {
    return true;
  }
};
function setCrt(on: boolean) {
  try {
    localStorage.setItem(CRT_KEY, on ? "on" : "off");
  } catch {}
  crtListeners.forEach((l) => l());
}
const useCrt = () =>
  useSyncExternalStore(
    (l) => {
      crtListeners.add(l);
      return () => crtListeners.delete(l);
    },
    readCrt,
    () => true,
  );

const NAV_LEFT = [
  { href: "/dex", label: "Dex", short: "Dex" },
  { href: "/market", label: "PokéMart", short: "Mart" },
  { href: "/missions", label: "Missions", short: "Quests" },
];
const NAV_RIGHT = [
  { href: "/vault", label: "Vault", short: "Vault" },
  { href: "/profile", label: "Profile", short: "Me" },
];

export function TvShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { clock, timer } = useClock();
  const crt = useCrt();
  const audio = useAudioPrefs();
  const me = useMe();
  useResumePayments(me.data?.address as Address | null | undefined);

  useEffect(() => initAudioOnGesture(), []);

  return (
    <div className="tv">
      <div className="screen" data-crt={crt ? "on" : "off"}>
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
            <div className="flex flex-col items-start gap-2 sm:items-center">
              <Link href="/" className="pointer-events-auto" aria-label="PokéCast home">
                <Logo />
              </Link>
              <ContractAddress className="inline-flex lg:hidden" />
            </div>
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
              <XLink />
              <WalletButton />
            </nav>
          </header>

          {/* bottom HUD */}
          <footer className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between px-[clamp(16px,3.4vw,40px)] pb-[clamp(14px,3.2vh,34px)]">
            <ContractAddress className="absolute bottom-[clamp(10px,calc(3.2vh-4px),30px)] left-1/2 hidden -translate-x-1/2 lg:inline-flex" />
            <div className="hud pointer-events-auto flex items-center gap-3 text-dim sm:gap-5">
              <span className="hidden tabular-nums sm:inline" suppressHydrationWarning>
                {clock}
              </span>
              <button
                type="button"
                className="link-hud cursor-pointer text-dim hover:text-phosphor"
                aria-pressed={crt}
                aria-label={crt ? "Turn the TV filter off" : "Turn the TV filter on"}
                onClick={() => setCrt(!crt)}
              >
                TV<span className="hidden sm:inline"> filter</span> [{crt ? "On" : "Off"}]
              </button>
              <button
                type="button"
                className="link-hud cursor-pointer text-dim hover:text-phosphor"
                aria-pressed={audio.music}
                onClick={() => setAudioPrefs({ music: !audio.music })}
              >
                ♪ <span className="hidden sm:inline">Music </span>[{audio.music ? "On" : "Off"}]
              </button>
              <button
                type="button"
                className="link-hud hidden cursor-pointer text-dim hover:text-phosphor sm:inline"
                aria-pressed={audio.sfx}
                onClick={() => setAudioPrefs({ sfx: !audio.sfx })}
              >
                SFX [{audio.sfx ? "On" : "Off"}]
              </button>
            </div>
            <div className="hud pointer-events-auto flex items-center gap-3 text-dim sm:gap-5">
              {[...NAV_LEFT, ...NAV_RIGHT].map((n) => (
                <Link key={n.href} href={n.href} className="link-hud md:hidden" aria-current={pathname.startsWith(n.href) ? "page" : undefined}>
                  {n.short}
                </Link>
              ))}
              <Link href="/how-it-works" className="link-hud hidden md:inline" aria-current={pathname === "/how-it-works" ? "page" : undefined}>
                How it works
              </Link>
              <span className="hidden items-center gap-2 lg:flex">
                <span className="rec-dot" aria-hidden="true" />
                Source: BNB Chain
              </span>
            </div>
          </footer>

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
