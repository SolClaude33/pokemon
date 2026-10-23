"use client";

import { useEffect, useState } from "react";
import { sfx } from "@/lib/audio";
import { TOKEN_CA, TOKEN_CA_URL, X_URL } from "@/lib/site";

/** X (Twitter) link for the top HUD; renders nothing without NEXT_PUBLIC_X_URL. */
export function XLink() {
  if (!X_URL) return null;
  return (
    <a href={X_URL} target="_blank" rel="noopener noreferrer" className="link-hud inline-flex items-center" aria-label="PokéCast on X">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
        <path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.21-6.82-5.97 6.82H1.67l7.73-8.84L1.25 2.25h6.83l4.71 6.23 5.45-6.23Zm-1.16 17.52h1.83L7.08 4.13H5.12l11.96 15.64Z" />
      </svg>
    </a>
  );
}

/** "CA:" chip with copy; renders nothing without NEXT_PUBLIC_CA. */
export function ContractAddress({ className = "inline-flex" }: { className?: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);
  if (!TOKEN_CA) return null;

  const short = TOKEN_CA.length > 16 ? `${TOKEN_CA.slice(0, 6)}…${TOKEN_CA.slice(-4)}` : TOKEN_CA;
  async function copy() {
    try {
      await navigator.clipboard.writeText(TOKEN_CA!);
    } catch {
      // clipboard API blocked (insecure origin, unfocused frame): fall back to a hidden textarea
      const ta = document.createElement("textarea");
      ta.value = TOKEN_CA!;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const done = document.execCommand("copy");
      ta.remove();
      if (!done) return;
    }
    setCopied(true);
    sfx.select();
  }

  return (
    <div className={`hud ca-chip pointer-events-auto ${className}`}>
      <span className="text-poke-yellow">CA:</span>
      {TOKEN_CA_URL ? (
        <a href={TOKEN_CA_URL} target="_blank" rel="noopener noreferrer" className="link-hud normal-case tabular-nums" title={TOKEN_CA}>
          <span className="xl:hidden">{short}</span>
          <span className="hidden xl:inline">{TOKEN_CA}</span>
        </a>
      ) : (
        <span className="normal-case tabular-nums" title={TOKEN_CA}>
          <span className="xl:hidden">{short}</span>
          <span className="hidden xl:inline">{TOKEN_CA}</span>
        </span>
      )}
      <button type="button" onClick={copy} className="link-hud cursor-pointer text-dim hover:text-phosphor" aria-label="Copy contract address">
        [{copied ? "Copied" : "Copy"}]
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? "Contract address copied" : ""}
      </span>
    </div>
  );
}
