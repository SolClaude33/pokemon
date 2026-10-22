import type { Metadata } from "next";
import index from "@/data/sets/index.json";
import { MissionsView } from "@/components/MissionsView";

export const metadata: Metadata = { title: "Missions" };

const setNames = Object.fromEntries(index.sets.map((s) => [s.id, s.name]));

export default function MissionsPage() {
  return (
    <div className="channel-scroll">
      <div className="mx-auto max-w-6xl px-[clamp(16px,3.4vw,40px)] pt-[clamp(96px,15vh,140px)] pb-[clamp(80px,12vh,120px)]">
        <p className="pixel text-dim">Quests</p>
        <h1 className="poke-title mt-3 text-[clamp(2.4rem,5vw,4rem)] leading-none">Missions</h1>
        <p className="mt-4 max-w-[60ch] text-[15px] leading-relaxed text-phosphor/85">
          Rip packs, chase hits and trade on the PokéMart to complete missions. Rewards are free packs and USDT cashback.
        </p>
        <MissionsView setNames={setNames} />
      </div>
    </div>
  );
}
