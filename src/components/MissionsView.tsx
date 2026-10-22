"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { sfx } from "@/lib/audio";
import type { Mission } from "@/lib/missions";
import { api, useMe } from "@/lib/session";

type MissionState = Mission & { progress: number; target: number; claimed: boolean; resetsAt: string | null };

const PERIOD: Record<Mission["period"], string> = { once: "One-time", daily: "Daily", weekly: "Weekly", monthly: "Monthly" };

function resetIn(iso: string | null) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  const h = Math.floor(ms / 3_600_000);
  return h >= 48 ? `resets in ${Math.floor(h / 24)}d` : `resets in ${Math.max(1, h)}h`;
}

export function MissionsView({ setNames }: { setNames: Record<string, string> }) {
  const me = useMe();
  const { openConnectModal } = useConnectModal();
  const qc = useQueryClient();
  const address = me.data?.address ?? null;
  const data = useQuery<{ missions: MissionState[] }>({ queryKey: ["missions", address], queryFn: () => api("/api/missions") });
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const rewardText = (m: Mission) =>
    m.reward.type === "pack" ? `1 free ${setNames[m.reward.setId] ?? m.reward.setId} pack` : `${m.reward.amount} USDT cashback`;

  const claim = async (m: MissionState) => {
    setBusy(m.id);
    setNotice(null);
    try {
      await api("/api/missions/claim", { missionId: m.id });
      sfx.hit(2);
      setNotice({ tone: "ok", text: `Mission complete! You got ${rewardText(m)}.` });
      qc.invalidateQueries();
    } catch (e) {
      sfx.error();
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "Couldn't claim the reward" });
    } finally {
      setBusy(null);
    }
  };

  const missions = data.data?.missions ?? [];
  const ready = missions.filter((m) => m.progress >= m.target && !m.claimed).length;

  return (
    <>
      {!me.isLoading && !address && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border border-line p-4">
          <p className="hud text-dim">Sign in with your wallet to track progress and claim rewards.</p>
          <button type="button" className="btn btn-primary" onClick={() => openConnectModal?.()}>
            Connect wallet
          </button>
        </div>
      )}
      {address && ready > 0 && (
        <p className="gb-dialog mt-6 max-w-xl" data-more="true">
          {ready} reward{ready > 1 ? "s are" : " is"} waiting to be claimed!
        </p>
      )}
      {notice && (
        <p role={notice.tone === "error" ? "alert" : "status"} className={`hud mt-4 ${notice.tone === "error" ? "text-poke-red" : "text-ok"}`}>
          {notice.text}{" "}
          {notice.tone === "ok" && (
            <Link href="/vault" className="link-hud text-poke-yellow">
              Open vault →
            </Link>
          )}
        </p>
      )}

      {data.isLoading ? (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="skeleton h-40" />
          ))}
        </div>
      ) : data.isError ? (
        <p className="gb-dialog mx-auto mt-12 max-w-md">Couldn&apos;t load missions. Refresh to try again.</p>
      ) : (
        <ul className="mt-8 grid gap-4 md:grid-cols-2">
          {missions.map((m) => {
            const done = m.progress >= m.target;
            const pct = Math.round((m.progress / m.target) * 100);
            const label =
              m.goal.type === "spent" ? `${m.progress.toFixed(2)} / ${m.target} USDT` : `${m.progress} / ${m.target}`;
            return (
              <li
                key={m.id}
                className={`flex flex-col gap-4 border p-5 transition-colors ${m.claimed ? "border-line opacity-60" : done ? "border-poke-yellow" : "border-line"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="pixel text-dim">
                      {PERIOD[m.period]}
                      {m.period !== "once" && ` · ${resetIn(m.resetsAt)}`}
                    </p>
                    <h2 className="mt-2 font-display text-2xl text-poke-yellow">{m.title}</h2>
                    <p className="mt-1 text-sm text-phosphor/85">{m.description}</p>
                  </div>
                  <span className="hud shrink-0 border border-ok/40 px-2 py-1 text-right text-ok">
                    <span className="block text-faint">Reward</span>
                    {rewardText(m)}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <div className="loader-hp relative h-3 flex-1" aria-hidden="true">
                      <div className="h-full" style={{ width: `${pct}%`, background: done ? "var(--ok)" : "var(--poke-yellow)" }} />
                    </div>
                    <span className="hud w-28 text-right tabular-nums text-dim">{label}</span>
                  </div>
                </div>
                <div className="flex justify-end">
                  {m.claimed ? (
                    <span className="hud text-dim">✓ Claimed{m.period !== "once" ? " this period" : ""}</span>
                  ) : done && address ? (
                    <button type="button" className="btn btn-primary" disabled={busy === m.id} onClick={() => claim(m)}>
                      {busy === m.id ? "Claiming…" : "Claim reward"}
                    </button>
                  ) : (
                    <Link href="/" className="btn btn-ghost hud">
                      Rip packs →
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
