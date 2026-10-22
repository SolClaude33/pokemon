import * as THREE from "three";

export const PACK_ASPECT = 548 / 1000;
/** fraction of the pack height taken by each crimped seal */
const SEAL = 0.065;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** One face of a pillow-shaped foil pack: flat crimped seals, puffy middle. */
export function packFaceGeometry(height: number, thickness: number) {
  const width = height * PACK_ASPECT;
  const g = new THREE.PlaneGeometry(width, height, 40, 72);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) / width + 0.5;
    const v = pos.getY(i) / height + 0.5;
    const ey = smooth(SEAL, SEAL + 0.14, v) * smooth(SEAL, SEAL + 0.14, 1 - v);
    const ex = Math.sqrt(Math.max(0, 1 - Math.abs(2 * u - 1) ** 3));
    const z = thickness * ex * ey;
    // the foil pulls the long edges in slightly where it puffs out
    pos.setX(i, pos.getX(i) * (1 - 0.035 * ey * (1 - ex)));
    pos.setZ(i, z);
  }
  g.computeVertexNormals();
  return g;
}

/** Alpha map with zig-zag crimp teeth along the top and bottom seals. */
export function crimpAlphaMap() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 1024;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = "#000";
  const teeth = 22;
  const tw = c.width / teeth;
  const th = 9;
  for (const top of [true, false]) {
    ctx.beginPath();
    const y0 = top ? 0 : c.height;
    ctx.moveTo(0, y0);
    for (let i = 0; i <= teeth; i++) {
      ctx.lineTo(i * tw, y0);
      ctx.lineTo(i * tw + tw / 2, top ? th : c.height - th);
    }
    ctx.lineTo(c.width, y0);
    ctx.closePath();
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.needsUpdate = true;
  return t;
}

function cssFont(variable: string, fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return v || fallback;
}

const backCache = new Map<string, THREE.CanvasTexture>();

/** Original pack back: set logo, a Poké Ball watermark, product line and a barcode. */
export async function packBackTexture(opts: { setId: string; logo: string; accent: string; setName: string }) {
  const cached = backCache.get(opts.setId);
  if (cached) return cached;

  const W = 548;
  const H = 1000;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0c1a33");
  bg.addColorStop(0.55, "#132a52");
  bg.addColorStop(1, opts.accent);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // foil diagonal stripes
  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = "#fff";
  for (let x = -H; x < W; x += 22) {
    ctx.beginPath();
    ctx.moveTo(x, H);
    ctx.lineTo(x + H * 0.6, 0);
    ctx.lineTo(x + H * 0.6 + 7, 0);
    ctx.lineTo(x + 7, H);
    ctx.fill();
  }
  ctx.restore();

  // Poké Ball watermark
  ctx.save();
  ctx.translate(W / 2, H * 0.53);
  ctx.globalAlpha = 0.14;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.arc(0, 0, 190, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-190, 0);
  ctx.lineTo(-58, 0);
  ctx.moveTo(58, 0);
  ctx.lineTo(190, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 58, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // seals
  for (const y of [0, H - 62]) {
    const s = ctx.createLinearGradient(0, y, 0, y + 62);
    s.addColorStop(0, "#9aa3ad");
    s.addColorStop(0.5, "#e8edf2");
    s.addColorStop(1, "#8b939c");
    ctx.fillStyle = s;
    ctx.fillRect(0, y, W, 62);
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = "#000";
    for (let x = 0; x < W; x += 6) ctx.fillRect(x, y, 2, 62);
    ctx.globalAlpha = 1;
  }

  try {
    await document.fonts?.ready;
  } catch {}
  const pixel = cssFont("--font-pressstart", "monospace");
  const display = cssFont("--font-lilita", "sans-serif");

  // set logo
  const img = new Image();
  img.src = opts.logo;
  await img.decode().catch(() => undefined);
  if (img.naturalWidth) {
    const lw = 400;
    const lh = (img.naturalHeight / img.naturalWidth) * lw;
    ctx.drawImage(img, (W - lw) / 2, 110, lw, Math.min(lh, 200));
  } else {
    ctx.fillStyle = "#ffcb05";
    ctx.font = `64px ${display}`;
    ctx.textAlign = "center";
    ctx.fillText(opts.setName, W / 2, 210);
  }

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffcb05";
  ctx.strokeStyle = "#1b3f78";
  ctx.lineWidth = 10;
  ctx.lineJoin = "round";
  ctx.font = `76px ${display}`;
  ctx.strokeText("PokéCast", W / 2, H * 0.735);
  ctx.fillText("PokéCast", W / 2, H * 0.735);

  ctx.fillStyle = "#ece6d6";
  ctx.font = `15px ${pixel}`;
  ctx.fillText("REAL SEALED BOOSTER", W / 2, H * 0.78);
  ctx.globalAlpha = 0.7;
  ctx.font = `11px ${pixel}`;
  ctx.fillText("10 CARDS · RIPPED LIVE ON AIR", W / 2, H * 0.805);
  ctx.globalAlpha = 1;

  // barcode
  ctx.fillStyle = "#f8f8f0";
  ctx.fillRect(W - 170, H - 150, 130, 62);
  ctx.fillStyle = "#111";
  let x = W - 162;
  let seed = [...opts.setId].reduce((a, ch) => a + ch.charCodeAt(0), 7);
  while (x < W - 48) {
    seed = (seed * 9301 + 49297) % 233280;
    const w = 1 + (seed % 3);
    ctx.fillRect(x, H - 144, w, 50);
    x += w + 1 + (seed % 2);
  }

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  backCache.set(opts.setId, t);
  return t;
}

let webgl: boolean | null = null;

export function hasWebGL() {
  if (webgl != null) return webgl;
  try {
    const c = document.createElement("canvas");
    webgl = !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    webgl = false;
  }
  return webgl;
}
