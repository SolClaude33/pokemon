import type { Metadata } from "next";
import { AdminView } from "@/components/AdminView";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default function AdminPage() {
  return (
    <div className="channel-scroll">
      <div className="mx-auto max-w-6xl px-[clamp(16px,3.4vw,40px)] pt-[clamp(96px,15vh,140px)] pb-[clamp(80px,12vh,120px)]">
        <p className="pixel text-dim">Control room</p>
        <h1 className="poke-title mt-3 text-[clamp(2.2rem,5vw,3.6rem)] leading-none">Admin</h1>
        <AdminView />
      </div>
    </div>
  );
}
