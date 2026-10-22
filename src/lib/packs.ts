// Pack lineup + placeholder economics. Prices, buyback rates, shipping and pull
// rates are business decisions to confirm before launch; the rates below are
// community estimates (The Pokémon Company does not publish pull rates).

export const ECONOMICS = {
  currency: "USDT",
  /** share of TCGplayer market value paid when a card is sold back */
  buybackRate: 0.85,
  /** better rate for cards at or above highValueThreshold */
  highValueRate: 0.9,
  highValueThreshold: 100,
  /** flat fee per shipment, any number of cards */
  shippingFee: 6,
  /** sell-back window after a pull, in hours */
  buybackWindowHours: 72,
  /** PokéMart fee taken from the seller on each sale */
  marketFee: 0.025,
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
  /** what's inside, shown above the odds table */
  contents: string;
  /** what counts as a hit for the headline "chance of a hit" */
  hitLabel: string;
  /** rarities that are flagged as hits elsewhere but too common/cheap to celebrate in this pack */
  minorRarities?: string[];
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

const MODERN_CONTENTS = "4 Common · 3 Uncommon · 2 reverse holo (one can upgrade to a hit) · 1 Rare or better.";

export const PACKS: PackConfig[] = [
  {
    setId: "base1",
    channel: 1,
    // TCGplayer market for a sealed Unlimited booster was ~931 USD (Oct 2026); placeholder price
    price: 999,
    tagline: "1999 Base Set. The original pack — and the holo Charizard everyone still chases.",
    accent: "#ff7a2f",
    contents: "11 cards: 7 Common (energy included) · 3 Uncommon · 1 Rare — about one pack in three upgrades that rare to a holo.",
    hitLabel: "Holo rare",
    slots: [
      { label: "Common", count: 7, fill: "Common" },
      { label: "Uncommon", count: 3, fill: "Uncommon" },
      { label: "Rare / holo", count: 1, fill: "Rare", odds: { "Rare Holo": 1 / 3 } },
    ],
    sources: [{ label: "Bulbapedia — Base Set (TCG)", url: "https://bulbapedia.bulbagarden.net/wiki/Base_Set_(TCG)" }],
  },
  {
    setId: "swsh7",
    channel: 2,
    // TCGplayer market for a sealed booster was ~43 USD (Oct 2026); placeholder price
    price: 45,
    tagline: "2021's legend. Eeveelutions in alt art, Rayquaza — and Moonbreon, about one pack in two thousand.",
    accent: "#5b6cff",
    contents: "10 cards: 5 Common · 3 Uncommon · 1 reverse holo · 1 Rare or better (plus a basic Energy). Every hit lands in the rare slot.",
    hitLabel: "Pokémon V or better",
    minorRarities: ["Rare Holo"],
    slots: [
      { label: "Common", count: 5, fill: "Common" },
      { label: "Uncommon", count: 3, fill: "Uncommon" },
      { label: "Reverse holo", count: 1, fill: REVERSE_KEY },
      {
        label: "Rare slot",
        count: 1,
        fill: "Rare",
        // TCGplayer, 8,000+ packs; the holo/non-holo split of the plain rare is an estimate
        odds: {
          "Rare Holo": 0.25,
          "Rare Holo V": 0.1056,
          "Rare Holo VMAX": 0.056,
          "Full Art": 0.0278,
          "Alt Art V": 0.011,
          "Rare Rainbow": 0.0084,
          "Gold Rare": 0.0091,
          "Alt Art VMAX": 0.003,
        },
      },
    ],
    sources: [
      {
        label: "TCGplayer — 8,000-pack study",
        url: "https://www.tcgplayer.com/content/article/Pok%C3%A9mon-TCG-Evolving-Skies-Pull-Rates/6a743d7b-e5ee-4fd6-9d18-64a636990e8c/",
      },
    ],
  },
  {
    setId: "me2pt5",
    channel: 3,
    price: 12.5,
    tagline: "Every hero, one rip. The set with the god-pack rumours.",
    accent: "#f2b84b",
    contents: MODERN_CONTENTS,
    hitLabel: "Double Rare or better",
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
    channel: 4,
    price: 12.5,
    tagline: "Mega Charizard X burns blue. Chase the gold.",
    accent: "#5ec8ff",
    contents: MODERN_CONTENTS,
    hitLabel: "Double Rare or better",
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
    channel: 5,
    price: 10,
    tagline: "Mega Evolution returns. Lucario and Gardevoir in gold.",
    accent: "#b38cff",
    contents: MODERN_CONTENTS,
    hitLabel: "Double Rare or better",
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
    channel: 6,
    price: 15,
    tagline: "Eevee and all eight evolutions. The SIR rate everyone talks about.",
    accent: "#ff8ad8",
    contents: MODERN_CONTENTS,
    hitLabel: "Double Rare or better",
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
    channel: 7,
    price: 29,
    tagline: "The original 151. Charizard, Mew, and Venusaur in illustration.",
    accent: "#ff5f6d",
    contents: MODERN_CONTENTS,
    hitLabel: "Double Rare or better",
    slots: baseSlots(
      { "Illustration Rare": 1 / 11.8, "Special Illustration Rare": 1 / 32.2, "Hyper Rare": 1 / 51.5 },
      { "Double Rare": 1 / 7.5, "Ultra Rare": 1 / 16 },
    ),
    sources: [{ label: "Card Codex", url: "https://cardcodex.com/pokemon/scarlet-violet/151/151-booster-pack-sv3pt5/" }],
  },
];

export const packSize = (p: Pick<PackConfig, "slots">) => p.slots.reduce((a, s) => a + s.count, 0);

export const packBySetId = (id: string) => PACKS.find((p) => p.setId === id);

export const buybackRateFor = (value: number) =>
  value >= ECONOMICS.highValueThreshold ? ECONOMICS.highValueRate : ECONOMICS.buybackRate;

export const buybackFor = (value: number) =>
  Math.max(0.01, Math.floor(value * buybackRateFor(value) * 100) / 100);
