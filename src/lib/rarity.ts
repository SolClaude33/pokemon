// Rarity names exactly as pokemontcg.io returns them, ordered low → high.
export const RARITY_ORDER = [
  "Common",
  "Uncommon",
  "Rare",
  "Rare Holo",
  "Rare Holo V",
  "Rare Holo VMAX",
  "Double Rare",
  "ACE SPEC Rare",
  "Illustration Rare",
  "Ultra Rare",
  "Mega Attack Rare",
  "Special Illustration Rare",
  "Full Art",
  "Rare Rainbow",
  "Gold Rare",
  "Alt Art V",
  "Hyper Rare",
  "Mega Hyper Rare",
  "Alt Art VMAX",
] as const;

export type Rarity = (typeof RARITY_ORDER)[number] | (string & {});

type RarityMeta = {
  short: string;
  /** symbol printed on the card, drawn as text glyphs */
  glyph: string;
  color: string;
  /** shows animated foil on the card */
  foil: boolean;
  /** treated as a "hit" in the reveal (slower, flash, glow) */
  hit: boolean;
};

const META: Record<string, RarityMeta> = {
  Common: { short: "C", glyph: "●", color: "var(--r-common)", foil: false, hit: false },
  Uncommon: { short: "U", glyph: "◆", color: "var(--r-uncommon)", foil: false, hit: false },
  Rare: { short: "R", glyph: "★", color: "var(--r-rare)", foil: true, hit: false },
  "Rare Holo": { short: "H", glyph: "★", color: "var(--r-holo)", foil: true, hit: true },
  "Rare Holo V": { short: "V", glyph: "★", color: "var(--r-double)", foil: true, hit: true },
  "Rare Holo VMAX": { short: "VMAX", glyph: "★★", color: "var(--r-vmax)", foil: true, hit: true },
  "Full Art": { short: "FA", glyph: "★★", color: "var(--r-ultra)", foil: true, hit: true },
  "Rare Rainbow": { short: "RAIN", glyph: "★★★", color: "var(--r-rainbow)", foil: true, hit: true },
  "Gold Rare": { short: "GOLD", glyph: "★★★", color: "var(--r-hyper)", foil: true, hit: true },
  "Alt Art V": { short: "AA", glyph: "◆★", color: "var(--r-illus)", foil: true, hit: true },
  "Alt Art VMAX": { short: "AA MAX", glyph: "◆★★", color: "var(--r-sir)", foil: true, hit: true },
  "Double Rare": { short: "RR", glyph: "★★", color: "var(--r-double)", foil: true, hit: true },
  "ACE SPEC Rare": { short: "ACE", glyph: "✦", color: "var(--r-ace)", foil: true, hit: true },
  "Illustration Rare": { short: "IR", glyph: "★", color: "var(--r-illus)", foil: true, hit: true },
  "Ultra Rare": { short: "UR", glyph: "★★", color: "var(--r-ultra)", foil: true, hit: true },
  "Mega Attack Rare": { short: "MAR", glyph: "◆★", color: "var(--r-mega)", foil: true, hit: true },
  "Special Illustration Rare": { short: "SIR", glyph: "★★", color: "var(--r-sir)", foil: true, hit: true },
  "Hyper Rare": { short: "HR", glyph: "★★★", color: "var(--r-hyper)", foil: true, hit: true },
  "Mega Hyper Rare": { short: "MHR", glyph: "◆★", color: "var(--r-hyper)", foil: true, hit: true },
};

const FALLBACK: RarityMeta = { short: "?", glyph: "★", color: "var(--r-rare)", foil: true, hit: true };

export const rarityMeta = (r: string): RarityMeta => META[r] ?? FALLBACK;

export const rarityRank = (r: string) => {
  const i = (RARITY_ORDER as readonly string[]).indexOf(r);
  return i === -1 ? RARITY_ORDER.length : i;
};

/** Reverse-holo variant of a C/U/R card pulled from a reverse slot. */
export const REVERSE = "Reverse Holo";
