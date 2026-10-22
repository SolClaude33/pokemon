"use client";

import Image from "next/image";
import { useRef, type PointerEvent } from "react";

type Props = {
  src: string;
  alt: string;
  priority?: boolean;
  sizes?: string;
  interactive?: boolean;
  className?: string;
};

/** Booster pack with crimped seals and a foil sheen that follows the pointer. */
export function PackArt({ src, alt, priority, sizes = "(max-width: 640px) 45vw, 260px", interactive = true, className = "" }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (!interactive || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    ref.current.style.setProperty("--sheen-x", `${100 - x * 100}%`);
    ref.current.style.setProperty("--tilt-x", `${(0.5 - y) * 10}deg`);
    ref.current.style.setProperty("--tilt-y", `${(x - 0.5) * 14}deg`);
  };

  const leave = () => {
    ref.current?.style.removeProperty("--tilt-x");
    ref.current?.style.removeProperty("--tilt-y");
  };

  return (
    <div
      ref={ref}
      onPointerMove={move}
      onPointerLeave={leave}
      className={`pack ${className}`}
      style={{
        transform: "rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg))",
        transition: "transform 420ms var(--ease-out)",
      }}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        className="pack-img"
        draggable={false}
      />
      <div className="pack-sheen" aria-hidden="true" />
    </div>
  );
}
