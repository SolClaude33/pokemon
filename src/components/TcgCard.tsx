"use client";

import Image from "next/image";
import { useRef, type PointerEvent } from "react";
import { rarityMeta } from "@/lib/rarity";
import { LogoMark } from "./Logo";

type Props = {
  img: string;
  name: string;
  rarity: string;
  reverse?: boolean;
  glow?: boolean;
  sizes?: string;
  eager?: boolean;
  className?: string;
};

export function TcgCard({ img, name, rarity, reverse = false, glow = false, sizes = "220px", eager, className = "" }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const meta = rarityMeta(rarity);
  const foil = reverse || meta.foil;

  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (!foil || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    ref.current.style.setProperty("--px", `${((e.clientX - r.left) / r.width) * 100}%`);
    ref.current.style.setProperty("--py", `${((e.clientY - r.top) / r.height) * 100}%`);
  };

  return (
    <div
      ref={ref}
      onPointerMove={move}
      data-foil={foil}
      className={`tcg-card ${glow ? "rarity-glow" : ""} ${className}`}
      style={{ ["--glow" as string]: meta.color }}
    >
      <Image
        src={img}
        alt={`${name}${reverse ? " (reverse holo)" : ""}`}
        width={440}
        height={614}
        sizes={sizes}
        loading={eager ? "eager" : "lazy"}
        draggable={false}
      />
    </div>
  );
}

/** Original Holovision card back (not the official one). */
export function CardBack({ className = "" }: { className?: string }) {
  return (
    <div
      className={`tcg-card grid place-items-center ${className}`}
      style={{
        background:
          "repeating-linear-gradient(115deg, rgb(236 230 214 / 0.04) 0 2px, transparent 2px 9px), radial-gradient(80% 60% at 50% 45%, #1b1f29, #0b0d11 75%)",
        boxShadow: "inset 0 0 0 6px #0b0d11, inset 0 0 0 7px rgb(236 230 214 / 0.25), 0 10px 30px -10px rgb(0 0 0 / 0.8)",
      }}
      aria-hidden="true"
    >
      <div className="flex flex-col items-center gap-2">
        <LogoMark size={46} />
        <span className="pixel text-[9px] text-dim">Holovision</span>
      </div>
    </div>
  );
}

export function RarityTag({ rarity, className = "" }: { rarity: string; className?: string }) {
  const m = rarityMeta(rarity === "Reverse Holo" ? "Rare" : rarity);
  return (
    <span className={`hud inline-flex items-center gap-1.5 ${className}`} style={{ color: rarity === "Reverse Holo" ? "var(--r-rare)" : m.color }}>
      <span aria-hidden="true">{rarity === "Reverse Holo" ? "◐" : m.glyph}</span>
      {rarity}
    </span>
  );
}
