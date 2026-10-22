"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { fmtOneIn, fmtUSDT, type DexCard } from "@/lib/odds";
import { useMounted } from "@/lib/useClient";
import { buybackFor } from "@/lib/packs";
import { rarityMeta } from "@/lib/rarity";
import { RarityTag, TcgCard } from "./TcgCard";

/** Card fields the modal needs; Dex cards carry odds, market listings may not. */
export type ModalCard = Pick<DexCard, "img" | "name" | "rarity" | "setId" | "setName" | "number" | "price"> &
  Partial<Pick<DexCard, "odds" | "supertype" | "packPrice">> & { reverse?: boolean };

/** Full-screen card detail inside the CRT: big tilting card plus odds and value. */
export function CardModal({
  card,
  onClose,
  actions,
  children,
}: {
  card: ModalCard;
  onClose: () => void;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const mounted = useMounted();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted) return null;
  const target = document.getElementById("channel");
  if (!target) return null;
  const hit = rarityMeta(card.rarity).hit;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={card.name}
      className="absolute inset-0 z-30 overflow-y-auto bg-[#05070b]/90 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="mx-auto grid min-h-full max-w-5xl items-center gap-10 px-[clamp(16px,3.4vw,40px)] py-24 md:grid-cols-[minmax(0,360px)_1fr]">
        <div className="fade-up mx-auto w-[min(72vw,360px)]">
          <TcgCard img={card.img} name={card.name} rarity={card.rarity} reverse={card.reverse} glow={hit} tilt eager sizes="360px" />
        </div>
        <div className="fade-up">
          <p className="pixel text-dim">
            {card.setName} · No. {card.number}
          </p>
          <h2 className="poke-title mt-3 text-[clamp(2rem,4.4vw,3.4rem)] leading-none">{card.name}</h2>
          <RarityTag rarity={card.reverse ? "Reverse Holo" : card.rarity} className="mt-4" />
          <dl className="hud mt-8 grid max-w-md grid-cols-2 gap-x-8 gap-y-4">
            <div>
              <dt className="text-faint">[Card value]</dt>
              <dd className="mt-1 text-lg text-phosphor">{card.price != null ? fmtUSDT(card.price) : "—"}</dd>
            </div>
            <div>
              <dt className="text-faint">[Instant buyback]</dt>
              <dd className="mt-1 text-lg text-phosphor">{card.price != null ? fmtUSDT(buybackFor(card.price)) : "—"}</dd>
            </div>
            <div>
              <dt className="text-faint">[Odds per pack]</dt>
              <dd className="mt-1 text-lg text-phosphor">{card.odds != null ? fmtOneIn(card.odds) : "—"}</dd>
            </div>
            <div>
              <dt className="text-faint">[Type]</dt>
              <dd className="mt-1 text-lg text-phosphor">{card.supertype ?? "Card"}</dd>
            </div>
          </dl>
          {children}
          <div className="mt-8 flex flex-wrap gap-3">
            {actions ?? (
              <>
                <Link href={`/packs/${card.setId}`} className="btn btn-primary">
                  Rip {card.setName}
                  {card.packPrice != null && ` · ${card.packPrice.toFixed(2)} USDT`}
                </Link>
                <Link href={`/market?q=${encodeURIComponent(card.name)}`} className="btn">
                  Find on PokéMart
                </Link>
              </>
            )}
            <button ref={closeRef} type="button" onClick={onClose} className="btn btn-ghost hud">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>,
    target,
  );
}
