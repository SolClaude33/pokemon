"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useDeferredValue, useMemo, useState } from "react";
import { fmtOneIn, fmtUSDT, type DexCard } from "@/lib/odds";
import { sfx } from "@/lib/audio";
import { RARITY_ORDER, rarityMeta, rarityRank } from "@/lib/rarity";
import { CardModal } from "./CardModal";
import { RarityTag, TcgCard } from "./TcgCard";

type Sort = "number" | "name" | "rarity" | "price" | "odds" | "pack";

const SORTS: { id: Sort; label: string }[] = [
  { id: "rarity", label: "Rarity" },
  { id: "price", label: "Price" },
  { id: "odds", label: "Odds" },
  { id: "name", label: "Name" },
  { id: "pack", label: "Pack" },
  { id: "number", label: "Number" },
];

const PAGE = 60;

const compare: Record<Sort, (a: DexCard, b: DexCard) => number> = {
  number: (a, b) => a.setName.localeCompare(b.setName) || parseInt(a.number) - parseInt(b.number),
  name: (a, b) => a.name.localeCompare(b.name),
  rarity: (a, b) => rarityRank(a.rarity) - rarityRank(b.rarity) || (a.price ?? 0) - (b.price ?? 0),
  price: (a, b) => (a.price ?? 0) - (b.price ?? 0),
  odds: (a, b) => b.odds - a.odds,
  pack: (a, b) => a.setName.localeCompare(b.setName) || rarityRank(a.rarity) - rarityRank(b.rarity),
};

export function DexView({ cards, packs }: { cards: DexCard[]; packs: { id: string; name: string }[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [pack, setPack] = useState(params.get("pack") ?? "all");
  const [rarities, setRarities] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<Sort>("rarity");
  const [desc, setDesc] = useState(true);
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState<DexCard | null>(null);
  const q = useDeferredValue(query.trim().toLowerCase());

  const presentRarities = useMemo(
    () => (RARITY_ORDER as readonly string[]).filter((r) => cards.some((c) => c.rarity === r)),
    [cards],
  );

  const list = useMemo(() => {
    const out = cards.filter(
      (c) =>
        (pack === "all" || c.setId === pack) &&
        (!rarities.size || rarities.has(c.rarity)) &&
        (!q || c.name.toLowerCase().includes(q) || c.number === q),
    );
    out.sort(compare[sort]);
    if (desc) out.reverse();
    return out;
  }, [cards, pack, rarities, q, sort, desc]);

  const setPackParam = (id: string) => {
    setPack(id);
    setLimit(PAGE);
    const sp = new URLSearchParams(params.toString());
    if (id === "all") sp.delete("pack");
    else sp.set("pack", id);
    router.replace(`/dex${sp.size ? `?${sp}` : ""}`, { scroll: false });
  };

  const toggleRarity = (r: string) => {
    sfx.click();
    setRarities((s) => {
      const n = new Set(s);
      if (n.has(r)) n.delete(r);
      else n.add(r);
      setLimit(PAGE);
      return n;
    });
  };

  return (
    <>
      <div className="mt-8 border-y border-line py-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative min-w-[220px] flex-1">
            <span className="sr-only">Search cards</span>
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setLimit(PAGE);
              }}
              placeholder="Search a Pokémon or trainer…"
              className="h-11 w-full border border-line-strong bg-transparent px-3 font-mono text-sm text-phosphor outline-none placeholder:text-faint focus:border-poke-yellow"
            />
          </label>
          <label className="hud flex items-center gap-2 text-dim">
            Pack
            <select
              value={pack}
              onChange={(e) => setPackParam(e.target.value)}
              className="h-11 border border-line-strong bg-[#0b0d11] px-2 font-mono text-xs text-phosphor outline-none focus:border-poke-yellow"
            >
              <option value="all">All packs</option>
              {packs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="hud flex items-center gap-2 text-dim">
            Sort
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="h-11 border border-line-strong bg-[#0b0d11] px-2 font-mono text-xs text-phosphor outline-none focus:border-poke-yellow"
            >
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn btn-ghost hud min-h-11"
            onClick={() => setDesc((d) => !d)}
            aria-label={desc ? "Sorted descending, switch to ascending" : "Sorted ascending, switch to descending"}
          >
            {desc ? "↓ High → low" : "↑ Low → high"}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filter by rarity">
          {presentRarities.map((r) => {
            const on = rarities.has(r);
            const m = rarityMeta(r);
            return (
              <button
                key={r}
                type="button"
                aria-pressed={on}
                onClick={() => toggleRarity(r)}
                className="hud cursor-pointer border px-2.5 py-1.5 transition-colors"
                style={{
                  borderColor: on ? m.color : "var(--line)",
                  color: on ? "#0b0d11" : m.color,
                  background: on ? m.color : "transparent",
                }}
              >
                {m.glyph} {m.short}
              </button>
            );
          })}
          {rarities.size > 0 && (
            <button type="button" className="hud link-hud px-2 text-dim" onClick={() => setRarities(new Set())}>
              Clear
            </button>
          )}
        </div>
      </div>

      <p className="hud mt-6 text-dim" aria-live="polite">
        {list.length.toLocaleString("en-US")} card{list.length === 1 ? "" : "s"}
        {pack !== "all" && ` in ${packs.find((p) => p.id === pack)?.name}`}
      </p>

      {list.length === 0 ? (
        <div className="mx-auto mt-12 max-w-md">
          <p className="gb-dialog" data-more="false">
            No Pokémon matched that search. Try another name or clear the filters.
          </p>
        </div>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {list.slice(0, limit).map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  sfx.select();
                  setOpen(c);
                }}
                className="group block w-full cursor-pointer text-left"
              >
                <span className="block transition-transform duration-300 group-hover:-translate-y-1">
                  <TcgCard img={c.img} name={c.name} rarity={c.rarity} sizes="(max-width: 640px) 45vw, 180px" />
                </span>
                <span className="mt-2 block truncate text-[13px] group-hover:text-poke-yellow">{c.name}</span>
                <RarityTag rarity={c.rarity} className="mt-1" />
                <span className="hud mt-1 flex justify-between gap-2 text-dim">
                  <span className="text-phosphor">{c.price != null ? fmtUSDT(c.price) : "—"}</span>
                  <span>{fmtOneIn(c.odds)}</span>
                </span>
                <span className="hud mt-0.5 block truncate text-faint">
                  {c.setName} · {c.number}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {limit < list.length && (
        <div className="mt-10 flex justify-center">
          <button type="button" className="btn" onClick={() => setLimit((l) => l + PAGE)}>
            Show more · {list.length - limit} left
          </button>
        </div>
      )}

      {open && <CardModal card={open} onClose={() => setOpen(null)} />}
    </>
  );
}
