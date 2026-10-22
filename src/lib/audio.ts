"use client";

import { useSyncExternalStore } from "react";

// Background music is a looping audio file (public/assets/audio/bgm.mp3).
// Sound effects are synthesized with the Web Audio API in the style of the
// Game Boy Pokémon games (pulse + noise channels): menu blips, the Poké Ball
// wobble, a catch "click", shiny sparkles and item-get style jingles. They are
// original sounds evoking that era, not copies of the games' audio.

type Prefs = { music: boolean; sfx: boolean };
const PREFS_KEY = "pc:audio";
const DEFAULT_PREFS: Prefs = { music: true, sfx: true };

let prefs: Prefs | null = null;
const listeners = new Set<() => void>();

function readPrefs(): Prefs {
  if (prefs) return prefs;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    prefs = raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch {
    prefs = DEFAULT_PREFS;
  }
  return prefs!;
}

export function setAudioPrefs(next: Partial<Prefs>) {
  prefs = { ...readPrefs(), ...next };
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {}
  applyPrefs();
  listeners.forEach((l) => l());
}

export function useAudioPrefs() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    readPrefs,
    () => DEFAULT_PREFS,
  );
}

// ─────────────────────────────── graph ───────────────────────────────

const BGM_URL = "/assets/audio/bgm.mp3";
/** bgm.mp3 is normalized to about -20 LUFS; at 0.35 it plays near -29 LUFS, ~14 dB under the source */
const MUSIC_LEVEL = 0.35;
/** music level while a pack is being opened, so the effects stand out */
const DUCKED = 0.13;
const SFX_LEVEL = 0.24;
let ducked = false;

let ctx: AudioContext | null = null;
let musicBus: GainNode;
let sfxBus: GainNode;
let noiseBuffer: AudioBuffer;
const waves = new Map<number, PeriodicWave>();

function ensure() {
  if (ctx) return ctx;
  if (typeof window === "undefined" || !("AudioContext" in window)) return null;
  ctx = new AudioContext();
  musicBus = ctx.createGain();
  musicBus.gain.value = 0;
  musicBus.connect(ctx.destination);
  // effects go through a soft low-pass so the square waves never get shrill
  const tone = ctx.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = 7000;
  sfxBus = ctx.createGain();
  sfxBus.connect(tone).connect(ctx.destination);
  noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  applyPrefs();
  return ctx;
}

function applyPrefs() {
  if (!ctx) return;
  const p = readPrefs();
  const t = ctx.currentTime;
  musicBus.gain.setTargetAtTime(p.music ? (ducked ? DUCKED : MUSIC_LEVEL) : 0, t, 0.25);
  sfxBus.gain.setTargetAtTime(p.sfx ? SFX_LEVEL : 0, t, 0.02);
  if (p.music) void startMusic();
}

// ─────────────────────────────── music ───────────────────────────────

/** Lowers the music while a pack opening is on screen. */
export function duckMusic(on: boolean) {
  ducked = on;
  applyPrefs();
}

let bgm: AudioBuffer | null = null;
let bgmSource: AudioBufferSourceNode | null = null;
let bgmLoading: Promise<void> | null = null;

/** First and last sample above the noise floor, so the loop has no silent gap. */
function audibleRange(buf: AudioBuffer) {
  const d = buf.getChannelData(0);
  const floor = 0.003;
  let a = 0;
  while (a < d.length && Math.abs(d[a]) < floor) a++;
  let b = d.length - 1;
  while (b > a && Math.abs(d[b]) < floor) b--;
  return { start: a / buf.sampleRate, end: (b + 1) / buf.sampleRate };
}

async function startMusic() {
  if (!ctx || bgmSource) return;
  bgmLoading ??= fetch(BGM_URL)
    .then((r) => r.arrayBuffer())
    .then((b) => ctx!.decodeAudioData(b))
    .then((b) => {
      bgm = b;
    })
    .catch(() => {
      bgmLoading = null;
    });
  await bgmLoading;
  if (!bgm || bgmSource || !readPrefs().music) return;
  const { start, end } = audibleRange(bgm);
  const src = ctx.createBufferSource();
  src.buffer = bgm;
  src.loop = true;
  src.loopStart = start;
  src.loopEnd = end;
  src.connect(musicBus);
  src.start(ctx.currentTime + 0.05, start);
  bgmSource = src;
}

// ─────────────────────────────── synth ───────────────────────────────

/** Pulse wave with a Game Boy duty cycle (12.5%, 25% or 50%). */
function pulse(duty: number) {
  if (waves.has(duty)) return waves.get(duty)!;
  const n = 64;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  for (let k = 1; k < n; k++) {
    real[k] = Math.sin(2 * Math.PI * k * duty) / (k * Math.PI);
    imag[k] = (1 - Math.cos(2 * Math.PI * k * duty)) / (k * Math.PI);
  }
  const w = ctx!.createPeriodicWave(real, imag);
  waves.set(duty, w);
  return w;
}

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

type Voice = { duty: number } | { type: OscillatorType };
const SQ50: Voice = { duty: 0.5 };
const SQ25: Voice = { duty: 0.25 };
const SQ12: Voice = { duty: 0.125 };
const TRI: Voice = { type: "triangle" };

/** One note with a short GB-style envelope; optional pitch slide to another note. */
function note(voice: Voice, midi: number, at: number, dur: number, vol = 1, slideTo?: number) {
  const c = ctx!;
  const o = c.createOscillator();
  if ("duty" in voice) o.setPeriodicWave(pulse(voice.duty));
  else o.type = voice.type;
  o.frequency.setValueAtTime(hz(midi), at);
  if (slideTo != null) o.frequency.exponentialRampToValueAtTime(hz(slideTo), at + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(vol, at + 0.004);
  g.gain.setValueAtTime(vol, at + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0008, at + dur);
  o.connect(g).connect(sfxBus);
  o.start(at);
  o.stop(at + dur + 0.02);
}

function hiss(at: number, dur: number, vol: number, type: BiquadFilterType, freq: number, sweepTo?: number) {
  const c = ctx!;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer;
  const f = c.createBiquadFilter();
  f.type = type;
  f.Q.value = 1.2;
  f.frequency.setValueAtTime(freq, at);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, at + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(vol, at);
  g.gain.exponentialRampToValueAtTime(0.0008, at + dur);
  src.connect(f).connect(g).connect(sfxBus);
  src.start(at, Math.random() * 0.5);
  src.stop(at + dur + 0.02);
}

/** Poké Ball wobble: a low knock with a little rattle. */
function knock(at: number, vol = 1) {
  note(TRI, 50, at, 0.11, vol, 38);
  hiss(at, 0.05, 0.35 * vol, "lowpass", 900);
}

/** Shiny-style sparkle: quick twinkles falling from very high notes. */
function sparkle(at: number, count = 8) {
  const run = [100, 96, 103, 98, 105, 101, 108, 103];
  for (let i = 0; i < count; i++) note(SQ12, run[i % run.length], at + i * 0.045, 0.06, 0.35 - i * 0.02);
}

function play(fn: (t: number) => void) {
  const c = ensure();
  if (!c || !readPrefs().sfx) return;
  if (c.state === "suspended") void c.resume();
  fn(c.currentTime + 0.01);
}

// ─────────────────────────────── effects ───────────────────────────────

export const sfx = {
  /** menu cursor moving */
  click: () => play((t) => note(SQ50, 88, t, 0.03, 0.45)),

  /** pressing A on a menu */
  select: () =>
    play((t) => {
      note(SQ50, 84, t, 0.04, 0.6);
      note(SQ50, 91, t + 0.045, 0.07, 0.6);
    }),

  /** ripping the pack open, like a Poké Ball bursting: a hiss sweep, a whoosh and a pop */
  tear: () =>
    play((t) => {
      hiss(t, 0.28, 0.9, "bandpass", 1200, 7000);
      note(SQ25, 60, t, 0.26, 0.45, 84);
      hiss(t + 0.26, 0.3, 0.6, "highpass", 5000, 1500);
      note(SQ50, 96, t + 0.3, 0.05, 0.5);
      note(SQ50, 91, t + 0.36, 0.12, 0.4);
    }),

  /** flipping one card: a soft swish and a menu blip */
  flip: () =>
    play((t) => {
      hiss(t, 0.06, 0.35, "highpass", 3500);
      note(SQ25, 81, t + 0.01, 0.05, 0.5, 88);
    }),

  /** before a hit: the ball wobbles three times, like during a catch */
  suspense: (ms = 900) =>
    play((t) => {
      const gap = ms / 1000 / 3;
      for (let i = 0; i < 3; i++) knock(t + i * gap, 0.9 - i * 0.1);
    }),

  /**
   * The hit lands: a "catch" click, then an item-get style jingle that grows
   * with rarity. 1 holo / double rare / IR, 2 ultra, 3 SIR, 4 gold.
   */
  hit: (tier = 1) =>
    play((t) => {
      // caught! click + bright ping
      hiss(t, 0.03, 0.6, "highpass", 2500);
      note(SQ50, 96, t + 0.02, 0.09, 0.5);
      const s = t + 0.16;
      const jingles: [number, number][][] = [
        [[72, 1], [76, 1], [79, 1], [84, 3]],
        [[72, 1], [76, 1], [79, 1], [84, 2], [83, 1], [84, 4]],
        [[67, 1], [72, 1], [76, 1], [79, 2], [77, 1], [79, 1], [84, 2], [88, 4]],
        [[72, 1], [72, 1], [72, 1], [76, 2], [79, 2], [77, 1], [76, 1], [79, 2], [84, 2], [88, 2], [91, 5]],
      ];
      const tune = jingles[Math.min(3, Math.max(0, tier - 1))];
      const unit = 0.085;
      let at = s;
      for (const [m, len] of tune) {
        note(SQ25, m, at, len * unit * 0.95, 0.65);
        note(SQ12, m - 12, at, len * unit * 0.95, 0.3); // harmony an octave below
        at += len * unit;
      }
      note(TRI, tune[tune.length - 1][0] - 24, s, at - s, 0.6); // held bass under the jingle
      if (tier >= 3) sparkle(at - 0.1, tier === 4 ? 12 : 8);
      if (tier === 4) sparkle(at + 0.35, 8);
    }),

  /** PokéMart register: two bright coins */
  coin: () =>
    play((t) => {
      note(SQ50, 95, t, 0.06, 0.55);
      note(SQ50, 100, t + 0.065, 0.22, 0.55);
      note(SQ12, 100, t + 0.14, 0.18, 0.2);
    }),

  /** bumping into a wall */
  error: () =>
    play((t) => {
      note(SQ50, 43, t, 0.09, 0.7, 40);
      hiss(t, 0.08, 0.4, "lowpass", 600);
    }),
};

/** Starts audio on the first user gesture (browsers block autoplay) and pauses it in background tabs. */
export function initAudioOnGesture() {
  const start = () => {
    const c = ensure();
    if (c?.state === "suspended") void c.resume();
    window.removeEventListener("pointerdown", start);
    window.removeEventListener("keydown", start);
  };
  window.addEventListener("pointerdown", start);
  window.addEventListener("keydown", start);
  const onVis = () => {
    if (!ctx) return;
    if (document.hidden) void ctx.suspend();
    else void ctx.resume();
  };
  document.addEventListener("visibilitychange", onVis);
  return () => {
    window.removeEventListener("pointerdown", start);
    window.removeEventListener("keydown", start);
    document.removeEventListener("visibilitychange", onVis);
  };
}
