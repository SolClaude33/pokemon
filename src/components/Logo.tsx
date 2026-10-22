import { useId } from "react";

/** CRT television showing a Poké Ball on screen — the PokéCast mark. */
export function LogoMark({ size = 30, className }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      width={size}
      height={(size * 30) / 32}
      viewBox="0 0 32 30"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath id={`scr-${id}`}>
          <rect x="4" y="9" width="24" height="17" rx="4.5" />
        </clipPath>
      </defs>
      {/* antenna */}
      <path d="M11 2.5 16 7.5 21 2.5" fill="none" stroke="#ece6d6" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="16" cy="7.6" r="1.1" fill="#ee1515" />
      {/* cabinet */}
      <rect x="1.5" y="7" width="29" height="21.5" rx="6" fill="#1b3f78" stroke="#ece6d6" strokeWidth="1.2" />
      {/* screen + ball */}
      <g clipPath={`url(#scr-${id})`}>
        <rect x="4" y="9" width="24" height="17" fill="#0b0d11" />
        <circle cx="16" cy="17.5" r="7.2" fill="#f8f8f0" />
        <path d="M8.8 17.5a7.2 7.2 0 0 1 14.4 0Z" fill="#ee1515" />
        <rect x="8.6" y="16.7" width="14.8" height="1.6" fill="#0b0d11" />
        <circle cx="16" cy="17.5" r="2.4" fill="#0b0d11" />
        <circle cx="16" cy="17.5" r="1.35" fill="#f8f8f0" />
        <path d="M10.3 13.6c1-1.3 2.3-2.1 3.8-2.5" stroke="#fff" strokeOpacity=".7" strokeWidth="1" fill="none" strokeLinecap="round" />
        {[10, 12, 14, 16, 18, 20, 22, 24].map((y) => (
          <rect key={y} x="4" y={y} width="24" height=".5" fill="#000" opacity=".22" />
        ))}
      </g>
    </svg>
  );
}

/** Arched "PokéCast" wordmark: Pokémon yellow with a blue outline. */
export function Wordmark({ width = 150, className }: { width?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={width} height={(width * 46) / 170} viewBox="0 0 170 46" className={className} role="img" aria-label="PokéCast">
      <defs>
        <path id={`arc-${id}`} d="M6 40 Q85 22 164 40" />
      </defs>
      <text
        fontSize="33"
        fill="#ffcb05"
        stroke="#1b3f78"
        strokeWidth="6"
        strokeLinejoin="round"
        paintOrder="stroke fill"
        style={{ fontFamily: "var(--font-lilita), sans-serif", letterSpacing: "0.5px" }}
      >
        <textPath href={`#arc-${id}`} startOffset="50%" textAnchor="middle" textLength="156" lengthAdjust="spacingAndGlyphs">
          PokéCast
        </textPath>
      </text>
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex flex-col items-center gap-0.5">
      <span className="inline-flex items-end gap-1.5">
        <LogoMark size={compact ? 26 : 32} />
        <Wordmark width={compact ? 112 : 136} />
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
