"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/lib/useClient";

const MESSAGES = ["Tuning channel…", "Shuffling 10 cards…", "Checking the odds…", "Sealing the foil…", "Warming up the CRT…"];

type Phase = "loading" | "exiting" | "gone";

// decided once per page load, so effect re-runs (React dev double-invoke) agree
const introDecisions = new Map<string, number>();
function introMin(key: string, full: number) {
  if (!introDecisions.has(key)) {
    let seen = false;
    try {
      seen = !!sessionStorage.getItem(key);
      sessionStorage.setItem(key, "1");
    } catch {}
    introDecisions.set(key, seen ? 0 : full);
  }
  return introDecisions.get(key)!;
}

/**
 * Animated loader: a Poké Ball doing the catch wobble, a Game Boy HP bar for
 * progress and a typewriter dialog. Progress eases toward 90% until `ready`,
 * then fills and the screen collapses like a CRT switching on.
 */
export function LoadingScreen({ ready, minDuration = 0, introKey }: { ready: boolean; minDuration?: number; introKey?: string }) {
  const reducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("loading");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState(0);
  const start = useRef<number | null>(null);
  const readyRef = useRef(ready);
  useEffect(() => {
    readyRef.current = ready;
  }, [ready]);

  // progress + exit, driven by one rAF loop
  useEffect(() => {
    // the full-length intro plays once per session; later visits exit as soon as ready
    const min = introKey ? introMin(introKey, minDuration) : minDuration;
    let raf = 0;
    let finishedAt: number | null = null;
    const tick = (now: number) => {
      start.current ??= now;
      const t = now - start.current;
      const minDone = t >= min;
      if (readyRef.current && minDone) {
        finishedAt ??= now;
        const p = Math.min(1, 0.9 + (now - finishedAt) / 350);
        setProgress(p);
        if (p >= 1) {
          setPhase("exiting");
          return;
        }
      } else {
        setProgress(0.9 * (1 - Math.exp(-t / 1400)));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [minDuration, introKey]);

  useEffect(() => {
    if (phase !== "exiting") return;
    const t = setTimeout(() => setPhase("gone"), reducedMotion ? 200 : 750);
    return () => clearTimeout(t);
  }, [phase, reducedMotion]);

  useEffect(() => {
    const t = setInterval(() => setMessage((m) => (m + 1) % MESSAGES.length), 1600);
    return () => clearInterval(t);
  }, []);

  if (phase === "gone") return null;
  const pct = Math.round(progress * 100);
  const hp = progress > 0.5 ? "var(--ok)" : progress > 0.2 ? "var(--warn)" : "var(--poke-red)";

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Loading ${pct}%`}
      className={`loader absolute inset-0 z-30 flex flex-col items-center justify-center overflow-hidden bg-screen ${phase === "exiting" ? "loader-exit" : ""}`}
      data-reduced={reducedMotion}
    >
      <div className="loader-static" aria-hidden="true" />
      <div className="loader-glow" aria-hidden="true" />

      <svg viewBox="0 0 100 100" className="loader-ball relative h-24 w-24 sm:h-28 sm:w-28" aria-hidden="true">
        <ellipse cx="50" cy="94" rx="26" ry="4" fill="#000" opacity=".45" className="loader-shadow" />
        <g className="loader-ball-body">
          <circle cx="50" cy="50" r="40" fill="#f8f8f0" stroke="#0b0d11" strokeWidth="5" />
          <path d="M10 50a40 40 0 0 1 80 0Z" fill="#ee1515" stroke="#0b0d11" strokeWidth="5" strokeLinejoin="round" />
          <rect x="10" y="46" width="80" height="8" fill="#0b0d11" />
          <circle cx="50" cy="50" r="13" fill="#0b0d11" />
          <circle cx="50" cy="50" r="8" fill="#f8f8f0" className="loader-button" />
          <path d="M24 30c4-7 11-12 19-14" stroke="#fff" strokeOpacity=".75" strokeWidth="4" fill="none" strokeLinecap="round" />
        </g>
      </svg>

      <div className="relative mt-8 w-[min(78vw,360px)]">
        <div className="flex items-center gap-3">
          <span className="pixel text-poke-yellow">HP</span>
          <div className="loader-hp relative h-3 flex-1" aria-hidden="true">
            <div className="h-full transition-[background] duration-500" style={{ width: `${pct}%`, background: hp }} />
          </div>
          <span className="pixel w-12 text-right tabular-nums text-dim">{pct}%</span>
        </div>

        <p className="gb-dialog mt-5" data-more="true">
          <span key={message} className="loader-type" style={{ ["--chars" as string]: MESSAGES[message].length }}>
            {MESSAGES[message]}
          </span>
        </p>
      </div>
    </div>
  );
}
