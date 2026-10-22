import type { Metadata } from "next";
import index from "@/data/sets/index.json";
import { VaultView } from "@/components/VaultView";

export const metadata: Metadata = { title: "Vault" };

const setNames = Object.fromEntries(index.sets.map((s) => [s.id, s.name]));

export default function VaultPage() {
  return (
    <div className="channel-scroll">
      <div className="mx-auto max-w-6xl px-[clamp(16px,3.4vw,40px)] pt-[clamp(96px,15vh,140px)] pb-[clamp(80px,12vh,120px)]">
        <h1 className="poke-title text-[clamp(2.4rem,5vw,4rem)] leading-none">Your vault</h1>
        <VaultView setNames={setNames} />
      </div>
    </div>
  );
}
