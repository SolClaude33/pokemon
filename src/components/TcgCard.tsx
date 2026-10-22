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
  /** tilt toward the pointer in 3D */
  tilt?: boolean;
  className?: string;
};

export function TcgCard({ img, name, rarity, reverse = false, glow = false, sizes = "220px", eager, tilt = false, className = "" }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const meta = rarityMeta(rarity);
  const foil = reverse || meta.foil;

  const move = (e: PointerEvent<HTMLDivElement>) => {
    if ((!foil && !tilt) || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    ref.current.style.setProperty("--px", `${x * 100}%`);
    ref.current.style.setProperty("--py", `${y * 100}%`);
    if (tilt) {
      ref.current.style.setProperty("--rx", `${(0.5 - y) * 16}deg`);
      ref.current.style.setProperty("--ry", `${(x - 0.5) * 20}deg`);
    }
  };

  const leave = () => {
    ref.current?.style.removeProperty("--rx");
    ref.current?.style.removeProperty("--ry");
  };

  return (
    <div
      ref={ref}
      onPointerMove={move}
      onPointerLeave={tilt ? leave : undefined}
      data-foil={foil}
      className={`tcg-card ${glow ? "rarity-glow" : ""} ${className}`}
      style={{
        ["--glow" as string]: meta.color,
        ...(tilt && {
          transform: "perspective(900px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg))",
          transition: "transform 300ms var(--ease-out)",
        }),
      }}
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

/** Original PokéCast card back (not the official one). */
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
        <span className="pixel text-[9px] text-dim">PokéCast</span>
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
