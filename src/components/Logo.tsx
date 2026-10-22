import { useId } from "react";

const BARS = ["#ece6d6", "#f9f871", "#6dffb3", "#5ec8ff", "#ff6fd8", "#ff5f6d", "#a78bfa"];

/** CRT screen filled with slanted foil "color bars" — the Holovision mark. */
export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      width={size}
      height={(size * 24) / 30}
      viewBox="0 0 30 24"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath id={`crt-${id}`}>
          <path d="M5 1.5h20c2.2 0 3.6 1.2 3.9 3.4.4 3.4.4 10.8 0 14.2-.3 2.2-1.7 3.4-3.9 3.4H5c-2.2 0-3.6-1.2-3.9-3.4-.4-3.4-.4-10.8 0-14.2C1.4 2.7 2.8 1.5 5 1.5Z" />
        </clipPath>
      </defs>
      <g clipPath={`url(#crt-${id})`}>
        <rect width="30" height="24" fill="#0b0d11" />
        <g transform="skewX(-14) translate(3 0)">
          {BARS.map((c, i) => (
            <rect key={c} x={i * 4.4} y="0" width="4.45" height="24" fill={c} />
          ))}
        </g>
        <rect y="17" width="30" height="7" fill="#0b0d11" opacity="0.88" />
        <rect x="3" y="19" width="9" height="2" fill="#ece6d6" />
        <rect x="14" y="19" width="3" height="2" fill="#ff4433" />
      </g>
      <path
        d="M5 1.5h20c2.2 0 3.6 1.2 3.9 3.4.4 3.4.4 10.8 0 14.2-.3 2.2-1.7 3.4-3.9 3.4H5c-2.2 0-3.6-1.2-3.9-3.4-.4-3.4-.4-10.8 0-14.2C1.4 2.7 2.8 1.5 5 1.5Z"
        fill="none"
        stroke="#ece6d6"
        strokeWidth="1.2"
      />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex flex-col items-center gap-1">
      <span className="inline-flex items-center gap-2">
        <LogoMark size={compact ? 24 : 30} />
        <span
          className="font-display text-[1.35rem] leading-none font-bold tracking-[-0.02em] italic sm:text-[1.6rem]"
          style={{ fontVariationSettings: '"opsz" 72' }}
        >
          Holovision
        </span>
      </span>
      {!compact && (
        <span className="hud hidden w-full justify-between gap-3 text-[9px] text-dim sm:flex">
          <span>Real packs</span>
          <span>Live odds</span>
        </span>
      )}
    </span>
  );
}
