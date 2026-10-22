// Trainer levels: lifetime USDT spent on packs unlocks cashback on every pack.
// Thresholds and rates are business settings — tune them here.

export type Level = { level: number; name: string; minSpent: number; cashback: number };

export const LEVELS: Level[] = [
  { level: 1, name: "Rookie", minSpent: 0, cashback: 0 },
  { level: 2, name: "Trainer", minSpent: 100, cashback: 0.01 },
  { level: 3, name: "Ace Trainer", minSpent: 500, cashback: 0.015 },
  { level: 4, name: "Gym Leader", minSpent: 2_000, cashback: 0.02 },
  { level: 5, name: "Elite Four", minSpent: 10_000, cashback: 0.03 },
  { level: 6, name: "Champion", minSpent: 50_000, cashback: 0.05 },
];

/** Smallest cashback balance that can be withdrawn. */
export const MIN_CASHBACK_WITHDRAWAL = 5;

export function levelFor(spent: number) {
  let current = LEVELS[0];
  for (const l of LEVELS) if (spent >= l.minSpent) current = l;
  const next = LEVELS.find((l) => l.minSpent > spent) ?? null;
  const progress = next ? (spent - current.minSpent) / (next.minSpent - current.minSpent) : 1;
  return { current, next, progress, toNext: next ? next.minSpent - spent : 0 };
}
