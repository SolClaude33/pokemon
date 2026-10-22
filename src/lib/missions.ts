// Missions: goals measured from real activity (packs opened, hits, USDT spent,
// PokéMart sales). Rewards are free packs or cashback credit. Business settings.

export type MissionGoal =
  | { type: "packs"; count: number; setId?: string }
  | { type: "sets"; count: number }
  | { type: "hits"; count: number }
  | { type: "spent"; amount: number }
  | { type: "sales"; count: number };

export type MissionReward = { type: "pack"; setId: string } | { type: "cashback"; amount: number };

export type Period = "once" | "daily" | "weekly" | "monthly";

export type Mission = {
  id: string;
  title: string;
  description: string;
  period: Period;
  goal: MissionGoal;
  reward: MissionReward;
};

export const MISSIONS: Mission[] = [
  {
    id: "first-rip",
    title: "First broadcast",
    description: "Open your first pack.",
    period: "once",
    goal: { type: "packs", count: 1 },
    reward: { type: "pack", setId: "me1" },
  },
  {
    id: "daily-triple",
    title: "Daily triple",
    description: "Open 3 packs today.",
    period: "daily",
    goal: { type: "packs", count: 3 },
    reward: { type: "cashback", amount: 1 },
  },
  {
    id: "weekly-collector",
    title: "Weekly collector",
    description: "Open 10 packs this week.",
    period: "weekly",
    goal: { type: "packs", count: 10 },
    reward: { type: "pack", setId: "me1" },
  },
  {
    id: "set-hopper",
    title: "Channel hopper",
    description: "Open packs from 4 different sets.",
    period: "once",
    goal: { type: "sets", count: 4 },
    reward: { type: "pack", setId: "me2" },
  },
  {
    id: "hit-hunter",
    title: "Hit hunter",
    description: "Pull 5 hits (Double Rare, V or better) this month.",
    period: "monthly",
    goal: { type: "hits", count: 5 },
    reward: { type: "pack", setId: "me2pt5" },
  },
  {
    id: "back-to-1999",
    title: "Back to 1999",
    description: "Open a vintage Base Set pack.",
    period: "once",
    goal: { type: "packs", count: 1, setId: "base1" },
    reward: { type: "cashback", amount: 25 },
  },
  {
    id: "pokemart-trader",
    title: "PokéMart trader",
    description: "Sell 3 cards on the PokéMart this month.",
    period: "monthly",
    goal: { type: "sales", count: 3 },
    reward: { type: "pack", setId: "me1" },
  },
  {
    id: "high-roller",
    title: "High roller",
    description: "Spend 500 USDT on packs this month.",
    period: "monthly",
    goal: { type: "spent", amount: 500 },
    reward: { type: "pack", setId: "swsh7" },
  },
];

/** Start of the current period (UTC) and a stable key for it. */
export function periodWindow(period: Period, now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (period === "once") return { start: new Date(0), key: "once", resetsAt: null as Date | null };
  if (period === "daily") {
    const end = new Date(d.getTime() + 86_400_000);
    return { start: d, key: d.toISOString().slice(0, 10), resetsAt: end };
  }
  if (period === "weekly") {
    const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
    const start = new Date(d.getTime() - dow * 86_400_000);
    return { start, key: `w${start.toISOString().slice(0, 10)}`, resetsAt: new Date(start.getTime() + 7 * 86_400_000) };
  }
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return { start, key: start.toISOString().slice(0, 7), resetsAt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)) };
}

export const goalTarget = (g: MissionGoal) => (g.type === "spent" ? g.amount : g.count);
