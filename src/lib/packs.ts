// Pack lineup + placeholder economics. Prices, buyback rates, shipping and pull
// rates are business decisions to confirm before launch; the rates below are
// community estimates (The Pokémon Company does not publish pull rates).

export const ECONOMICS = {
  currency: "USDC",
  /** share of TCGplayer market value paid when a card is sold back */
  buybackRate: 0.85,
  /** better rate for cards at or above highValueThreshold */
  highValueRate: 0.9,
  highValueThreshold: 100,
  /** flat fee per shipment, any number of cards */
  shippingFee: 6,
  /** sell-back window after a pull, in hours */
  buybackWindowHours: 72,
} as const;

/** Key used in slot tables for a reverse-holo copy of a Common/Uncommon/Rare. */
export const REVERSE_KEY = "REVERSE";

export type Slot = {
  label: string;
  count: number;
  /** what the slot contains when none of the odds hit */
  fill: string;
  /** per-slot probability of each upgrade */
  odds?: Record<string, number>;
};

export type PackConfig = {
  setId: string;
  channel: number;
  price: number;
  tagline: string;
  /** UI tint taken from the pack art */
  accent: string;
  slots: Slot[];
  sources: { label: string; url: string }[];
};

const baseSlots = (hit: Record<string, number>, rare: Record<string, number>): Slot[] => [
  { label: "Common", count: 4, fill: "Common" },
  { label: "Uncommon", count: 3, fill: "Uncommon" },
  { label: "Reverse holo", count: 1, fill: REVERSE_KEY },
  { label: "Reverse / hit", count: 1, fill: REVERSE_KEY, odds: hit },
  { label: "Rare", count: 1, fill: "Rare", odds: rare },
];

export const PACKS: PackConfig[] = [
  {
    setId: "me2pt5",
    channel: 1,
    price: 12.5,
    tagline: "Every hero, one rip. The set with the god-pack rumours.",
    accent: "#f2b84b",
    slots: baseSlots(
      { "Illustration Rare": 1 / 18, "Special Illustration Rare": 1 / 80, "Mega Hyper Rare": 1 / 540 },
      // Mega Attack Rares take the Ultra Rare's place in the rare slot.
      { "Double Rare": 1 / 5, "Mega Attack Rare": 1 / 29, "Ultra Rare": 1 / 50 },
    ),
    sources: [
      { label: "TCGplayer sample via PokeBeach", url: "https://pokebeach.com/forums/goto/post?id=3092782" },
      { label: "Card Codex", url: "https://cardcodex.com/blog/ascended-heroes-pull-rates-explained/" },
      { label: "TCGTalk", url: "https://tcgtalk.com/guides/ascended-heroes-pull-rates-god-pack" },
    ],
  },
  {
    setId: "me2",
    channel: 2,
    price: 12.5,
    tagline: "Mega Charizard X burns blue. Chase the gold.",
    accent: "#5ec8ff",
    slots: baseSlots(
      { "Illustration Rare": 1 / 12, "Special Illustration Rare": 1 / 80, "Mega Hyper Rare": 1 / 1260 },
      { "Double Rare": 1 / 5, "Ultra Rare": 1 / 15 },
    ),
    sources: [
      { label: "Card Codex", url: "https://cardcodex.com/blog/phantasmal-flames-pull-rates/" },
      { label: "TCGTalk", url: "https://tcgtalk.com/guides/phantasmal-flames-pack-opening-value-guide" },
    ],
  },
  {
    setId: "me1",
    channel: 3,
    price: 10,
    tagline: "Mega Evolution returns. Lucario and Gardevoir in gold.",
    accent: "#b38cff",
    slots: baseSlots(
      { "Illustration Rare": 1 / 10, "Special Illustration Rare": 1 / 80, "Mega Hyper Rare": 1 / 1260 },
      { "Double Rare": 1 / 5, "Ultra Rare": 1 / 15 },
    ),
    sources: [
      { label: "Deltia's Gaming", url: "https://deltiasgaming.com/?p=353157" },
      { label: "Bulbapedia — Mega hyper rare", url: "https://bulbapedia.bulbagarden.net/wiki/Mega_hyper_rare_card_(TCG)" },
    ],
  },
  {
    setId: "sv8pt5",
    channel: 4,
    price: 15,
    tagline: "Eevee and all eight evolutions. The SIR rate everyone talks about.",
    accent: "#ff8ad8",
    slots: baseSlots(
      { "ACE SPEC Rare": 1 / 20, "Special Illustration Rare": 1 / 45, "Hyper Rare": 1 / 180 },
      { "Double Rare": 1 / 5, "Ultra Rare": 1 / 13 },
    ),
    sources: [
      { label: "TCGplayer 1,200-pack study via Pokezentrum", url: "https://pokezentrum.de/pokemon-karten-news/pokemon-prismatische-entwicklungen-pull-rates-enthuellt/" },
      { label: "TCGTalk", url: "https://tcgtalk.com/guides/prismatic-evolutions-pack-opening-value-guide" },
    ],
  },
  {
    setId: "sv3pt5",
    channel: 5,
    price: 29,
    tagline: "The original 151. Charizard, Mew, and Venusaur in illustration.",
    accent: "#ff5f6d",
    slots: baseSlots(
      { "Illustration Rare": 1 / 11.8, "Special Illustration Rare": 1 / 32.2, "Hyper Rare": 1 / 51.5 },
      { "Double Rare": 1 / 7.5, "Ultra Rare": 1 / 16 },
    ),
    sources: [{ label: "Card Codex", url: "https://cardcodex.com/pokemon/scarlet-violet/151/151-booster-pack-sv3pt5/" }],
  },
];

export const packBySetId = (id: string) => PACKS.find((p) => p.setId === id);

export const buybackRateFor = (value: number) =>
  value >= ECONOMICS.highValueThreshold ? ECONOMICS.highValueRate : ECONOMICS.buybackRate;

export const buybackFor = (value: number) =>
  Math.max(0.01, Math.floor(value * buybackRateFor(value) * 100) / 100);
