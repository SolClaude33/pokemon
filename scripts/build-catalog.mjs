// Builds the card catalog from pokemontcg.io + TCGplayer and downloads/optimizes images.
// Usage: node scripts/build-catalog.mjs [--skip-images]
// Requires ffmpeg on PATH. Writes:
//   src/data/sets/<setId>.json        card pool (rarity + TCGplayer market price snapshot)
//   src/data/sets/index.json          set metadata
//   assets-src/{cards,packs,sets}/    originals (not served)
//   public/assets/{cards,packs,sets}/ optimized webp (served at /assets/...)
import { mkdir, writeFile, access, readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const run = promisify(execFile);
const ROOT = path.resolve(import.meta.dirname, "..");
const SKIP_IMAGES = process.argv.includes("--skip-images");

// tcgplayerPackId = TCGplayer product id of the English booster pack (used for pack art + sealed price).
// tcgplayerSet = TCGplayer set slug, used to backfill prices pokemontcg.io lacks.
const SETS = [
  { id: "me2pt5", tcgplayerPackId: 672434, tcgplayerSet: "me-ascended-heroes" },
  { id: "me2", tcgplayerPackId: 654144 },
  { id: "me1", tcgplayerPackId: 644352 },
  { id: "sv8pt5", tcgplayerPackId: 593294 },
  { id: "sv3pt5", tcgplayerPackId: 504467 },
  // 1999 Base Set (Unlimited) — home of the famous holo Charizard #4/102
  // exclude: cards never found in boosters (Machamp holo only came in starter decks)
  // basic energy has no rarity symbol but fills the common slots of 1999 boosters
  { id: "base1", tcgplayerPackId: 138130, exclude: ["8"], name: "Base Set", energyAsCommon: true },
  // 2021 Evolving Skies — Moonbreon. Rarities split into the subrarities TCGplayer measured.
  { id: "swsh7", tcgplayerPackId: 244337, relabel: evolvingSkiesRarity },
];

const API = "https://api.pokemontcg.io/v2";

// Evolving Skies: the API calls every full art "Rare Ultra" and every VMAX secret
// "Rare Rainbow"; the alternate arts are the second card of each pair.
const ES_ALT_V = new Set(["167", "175", "180", "182", "184", "186", "189", "192", "194", "196", "198"]);
const ES_ALT_VMAX = new Set(["205", "209", "212", "215", "218", "220"]);
function evolvingSkiesRarity(c) {
  if (c.rarity === "Rare Ultra") return ES_ALT_V.has(c.number) ? "Alt Art V" : "Full Art";
  if (c.rarity === "Rare Rainbow") return ES_ALT_VMAX.has(c.number) ? "Alt Art VMAX" : "Rare Rainbow";
  if (c.rarity === "Rare Secret") return "Gold Rare";
  return c.rarity;
}

// The API returns a few new rarities as raw enum keys.
const RARITY_NAMES = { MEGA_ATTACK_RARE: "Mega Attack Rare" };

// pokemontcg.io intermittently answers 500/502, so retry often with a short jittered delay.
async function fetchRetry(url, init = {}, tries = 25) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(120_000) });
      if (res.ok) return res;
      if (res.status === 404) break;
      if (i % 5 === 4) console.warn(`  ${res.status} x${i + 1} ${url}`);
    } catch (err) {
      console.warn(`  ${err.name} ${url}`);
    }
    await new Promise((r) => setTimeout(r, 1200 + Math.random() * 1500 + i * 300));
  }
  throw new Error(`failed: ${url}`);
}

const exists = (p) => access(p).then(() => true, () => false);

// Raw API pages are cached in assets-src/api so reruns resume instead of refetching.
async function cachedJson(url, file) {
  const dest = path.join(ROOT, "assets-src/api", file);
  if (await exists(dest)) return JSON.parse(await readFile(dest, "utf8"));
  const json = await (await fetchRetry(url)).json();
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, JSON.stringify(json));
  return json;
}

async function download(url, dest) {
  if (await exists(dest)) return;
  await mkdir(path.dirname(dest), { recursive: true });
  const res = await fetchRetry(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
}

async function toWebp(src, dest, width, quality = 78) {
  if (await exists(dest)) return;
  await mkdir(path.dirname(dest), { recursive: true });
  await run("ffmpeg", ["-v", "error", "-y", "-i", src, "-vf", `scale=${width}:-2`, "-c:v", "libwebp", "-quality", String(quality), dest]);
}

async function pool(items, size, fn) {
  let i = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (i < items.length) await fn(items[i++]);
    }),
  );
}

// Pick the market price that matches how the card is printed in a pack.
function prices(tcg) {
  const p = tcg?.prices ?? {};
  const val = (k) => p[k]?.market ?? p[k]?.mid ?? null;
  const base = val("normal") ?? val("holofoil") ?? val("1stEditionHolofoil") ?? null;
  const holo = val("holofoil");
  const reverse = val("reverseHolofoil");
  return { price: base ?? holo ?? reverse, reversePrice: reverse, updatedAt: tcg?.updatedAt ?? null };
}

async function tcgplayerPack(productId) {
  const res = await fetchRetry(`https://mp-search-api.tcgplayer.com/v2/product/${productId}/details`, {
    headers: { "User-Agent": "Mozilla/5.0" },
  }).catch(() => null);
  if (!res) return null;
  const d = await res.json();
  return { name: d.productName, marketPrice: d.marketPrice ?? null };
}

// Market price by card number ("196/217" → "196") from TCGplayer's search API.
async function tcgplayerSetPrices(slug) {
  const prices = new Map();
  for (let from = 0; ; from += 50) {
    const res = await fetchRetry("https://mp-search-api.tcgplayer.com/v1/search/request?q=&isList=false", {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
      body: JSON.stringify({
        algorithm: "",
        from,
        size: 50,
        filters: { term: { productLineName: ["pokemon"], setName: [slug], productTypeName: ["Cards"] } },
      }),
    });
    const r = (await res.json()).results[0];
    for (const p of r.results) {
      const num = String(p.customAttributes?.number ?? "").split("/")[0].replace(/^0+/, "");
      if (num && p.marketPrice != null && !prices.has(num)) prices.set(num, p.marketPrice);
    }
    if (from + 50 >= r.totalResults || !r.results.length) break;
  }
  return prices;
}

const index = [];
for (const s of SETS) {
  console.log(`\n== ${s.id}`);
  const select = "id,name,number,rarity,supertype,images,tcgplayer,set";
  const cards = [];
  for (let page = 1; ; page++) {
    const r = await cachedJson(
      `${API}/cards?q=set.id:${s.id}&pageSize=25&page=${page}&select=${select}`,
      `${s.id}-p${page}.json`,
    );
    cards.push(...r.data);
    if (cards.length >= r.totalCount || r.data.length === 0) break;
  }
  const set = cards[0].set;
  console.log(`  ${cards.length} cards`);

  const out = cards
    .map((c) => (!c.rarity && s.energyAsCommon && c.supertype === "Energy" ? { ...c, rarity: "Common" } : c))
    .map((c) => (s.relabel ? { ...c, rarity: s.relabel(c) } : c))
    .filter((c) => c.rarity && !s.exclude?.includes(c.number))
    .map((c) => {
      const { price, reversePrice, updatedAt } = prices(c.tcgplayer);
      return {
        id: c.id,
        number: c.number,
        name: c.name,
        rarity: RARITY_NAMES[c.rarity] ?? c.rarity,
        supertype: c.supertype,
        price,
        reversePrice,
        priceUpdatedAt: updatedAt,
        img: `/assets/cards/${s.id}/${c.number}.webp`,
        _src: c.images.large,
      };
    })
    .sort((a, b) => parseInt(a.number) - parseInt(b.number) || a.number.localeCompare(b.number));

  if (s.tcgplayerSet && out.some((c) => c.price == null)) {
    const backfill = await tcgplayerSetPrices(s.tcgplayerSet);
    const today = new Date().toISOString().slice(0, 10).replaceAll("-", "/");
    for (const c of out) {
      const p = backfill.get(c.number.replace(/^0+/, ""));
      if (c.price == null && p != null) Object.assign(c, { price: p, priceUpdatedAt: today });
    }
    console.log(`  TCGplayer backfill: ${out.filter((c) => c.price != null).length}/${out.length} priced`);
  }

  if (!SKIP_IMAGES) {
    let done = 0;
    await pool(out, 6, async (c) => {
      const out = path.join(ROOT, "public", c.img);
      if (await exists(out)) return; // already optimized; originals may have been cleaned up
      const src = path.join(ROOT, "assets-src/cards", s.id, `${c.number}.png`);
      await download(c._src, src);
      await toWebp(src, out, 440);
      if (++done % 25 === 0) console.log(`  images ${done}/${out.length}`);
    });

    const packSrc = path.join(ROOT, "assets-src/packs", `${s.id}.jpg`);
    await download(`https://tcgplayer-cdn.tcgplayer.com/product/${s.tcgplayerPackId}_in_1000x1000.jpg`, packSrc);
    await toWebp(packSrc, path.join(ROOT, "public/assets/packs", `${s.id}.webp`), 548, 82);

    const logoSrc = path.join(ROOT, "assets-src/sets", `${s.id}-logo.png`);
    await download(set.images?.logo ?? `https://images.pokemontcg.io/${s.id}/logo.png`, logoSrc);
    await toWebp(logoSrc, path.join(ROOT, "public/assets/sets", `${s.id}-logo.webp`), 480, 85);
  }

  const pack = await tcgplayerPack(s.tcgplayerPackId);
  const meta = {
    id: s.id,
    name: s.name ?? set.name,
    series: set.series,
    releaseDate: set.releaseDate,
    printedTotal: set.printedTotal,
    total: set.total,
    cardCount: out.length,
    logo: `/assets/sets/${s.id}-logo.webp`,
    packImage: `/assets/packs/${s.id}.webp`,
    packMarketPrice: pack?.marketPrice ?? null,
    tcgplayerPackId: s.tcgplayerPackId,
    rarities: [...new Set(out.map((c) => c.rarity))],
  };
  index.push(meta);
  await mkdir(path.join(ROOT, "src/data/sets"), { recursive: true });
  await writeFile(
    path.join(ROOT, "src/data/sets", `${s.id}.json`),
    JSON.stringify(out.map((c) => ({ ...c, _src: undefined }))),
  );
  console.log(`  rarities: ${meta.rarities.join(", ")} | pack $${meta.packMarketPrice}`);
}

const generatedAt = new Date().toISOString();
await writeFile(path.join(ROOT, "src/data/sets/index.json"), JSON.stringify({ generatedAt, sets: index }, null, 2));
console.log(`\nDone. ${index.length} sets written.`);
