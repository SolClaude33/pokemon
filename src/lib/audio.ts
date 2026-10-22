"use client";

import { useSyncExternalStore } from "react";

// Chiptune audio synthesized with the Web Audio API in the style of the
// Game Boy's sound chip (two pulse channels, a wave/triangle bass and noise).
// Everything — the music and the effects — is original and generated in code;
// no Pokémon game audio is used.

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

let ctx: AudioContext | null = null;
let musicBus: GainNode;
let sfxBus: GainNode;
let noiseBuffer: AudioBuffer;
const waves = new Map<number, PeriodicWave>();

const MUSIC_LEVEL = 0.07;
const SFX_LEVEL = 0.12;

function ensure() {
  if (ctx) return ctx;
  if (typeof window === "undefined" || !("AudioContext" in window)) return null;
  ctx = new AudioContext();
  const master = ctx.createGain();
  master.gain.value = 0.9;
  // gentle low-pass keeps the square waves from getting harsh
  const tone = ctx.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = 6500;
  master.connect(tone).connect(ctx.destination);
  musicBus = ctx.createGain();
  sfxBus = ctx.createGain();
  musicBus.connect(master);
  sfxBus.connect(master);
  noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  applyPrefs();
  return ctx;
}

/** Pulse wave with a given duty cycle (12.5%, 25%, 50% like the Game Boy). */
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

function applyPrefs() {
  if (!ctx) return;
  const p = readPrefs();
  const t = ctx.currentTime;
  musicBus.gain.setTargetAtTime(p.music ? MUSIC_LEVEL : 0, t, 0.08);
  sfxBus.gain.setTargetAtTime(p.sfx ? SFX_LEVEL : 0, t, 0.02);
  if (p.music) startMusic();
  else setTimeout(stopMusic, 300);
}

type Voice = { type: "pulse"; duty: number } | { type: OscillatorType };

function tone(bus: GainNode, voice: Voice, midi: number, at: number, dur: number, vol = 1, slideTo?: number) {
  const c = ctx!;
  const o = c.createOscillator();
  if (voice.type === "pulse") o.setPeriodicWave(pulse(voice.duty));
  else o.type = voice.type;
  o.frequency.setValueAtTime(hz(midi), at);
  if (slideTo != null) o.frequency.exponentialRampToValueAtTime(hz(slideTo), at + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(vol, at + 0.006);
  g.gain.setValueAtTime(vol, at + Math.max(0.01, dur * 0.6));
  g.gain.exponentialRampToValueAtTime(0.0008, at + dur);
  o.connect(g).connect(bus);
  o.start(at);
  o.stop(at + dur + 0.02);
}

function noise(bus: GainNode, at: number, dur: number, vol: number, filter: BiquadFilterType, freq: number, sweepTo?: number) {
  const c = ctx!;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer;
  const f = c.createBiquadFilter();
  f.type = filter;
  f.frequency.setValueAtTime(freq, at);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, at + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(vol, at);
  g.gain.exponentialRampToValueAtTime(0.0008, at + dur);
  src.connect(f).connect(g).connect(bus);
  src.start(at, Math.random() * 0.5);
  src.stop(at + dur + 0.02);
}

// ─────────────────────────────── sfx ───────────────────────────────

const LEAD: Voice = { type: "pulse", duty: 0.25 };
const THIN: Voice = { type: "pulse", duty: 0.125 };
const SQUARE: Voice = { type: "pulse", duty: 0.5 };

function play(fn: (t: number) => void) {
  const c = ensure();
  if (!c || !readPrefs().sfx) return;
  if (c.state === "suspended") void c.resume();
  fn(c.currentTime + 0.01);
}

export const sfx = {
  /** cursor move / carousel step */
  click: () => play((t) => tone(sfxBus, THIN, 84, t, 0.04, 0.5)),
  /** confirm / open */
  select: () =>
    play((t) => {
      tone(sfxBus, LEAD, 76, t, 0.06, 0.7);
      tone(sfxBus, LEAD, 83, t + 0.06, 0.1, 0.7);
    }),
  /** foil tearing: a noise rip plus a falling zip */
  tear: () =>
    play((t) => {
      noise(sfxBus, t, 0.42, 0.9, "bandpass", 5200, 900);
      tone(sfxBus, SQUARE, 79, t + 0.02, 0.3, 0.35, 55);
      noise(sfxBus, t + 0.32, 0.18, 0.5, "highpass", 3000);
    }),
  /** a card flipping over */
  flip: () =>
    play((t) => {
      noise(sfxBus, t, 0.05, 0.4, "highpass", 4000);
      tone(sfxBus, THIN, 79, t, 0.07, 0.55, 86);
    }),
  /** rising tremolo before a hit is revealed */
  suspense: (ms = 900) =>
    play((t) => {
      const steps = Math.floor(ms / 60);
      for (let i = 0; i < steps; i++) tone(sfxBus, THIN, 64 + i, t + i * 0.06, 0.05, 0.25 + (i / steps) * 0.5);
    }),
  /** fanfare; tier 1 (double rare) to 4 (gold) gets longer and brighter */
  hit: (tier = 1) =>
    play((t) => {
      const runs: number[][] = [
        [72, 76, 79, 84],
        [72, 76, 79, 84, 88],
        [72, 76, 79, 84, 88, 91],
        [72, 76, 79, 84, 88, 91, 96],
      ];
      const notes = runs[Math.min(3, Math.max(0, tier - 1))];
      notes.forEach((m, i) => tone(sfxBus, LEAD, m, t + i * 0.075, 0.11, 0.8));
      const end = t + notes.length * 0.075;
      tone(sfxBus, LEAD, notes[notes.length - 1], end, 0.55, 0.8);
      tone(sfxBus, THIN, notes[notes.length - 1] - 12, end, 0.55, 0.5);
      if (tier >= 3) for (let i = 0; i < 6; i++) tone(sfxBus, THIN, 96 + (i % 3) * 3, end + 0.1 + i * 0.05, 0.05, 0.3);
    }),
  /** coins: buying, selling, buyback credit */
  coin: () =>
    play((t) => {
      tone(sfxBus, SQUARE, 83, t, 0.07, 0.6);
      tone(sfxBus, SQUARE, 88, t + 0.07, 0.3, 0.6);
    }),
  /** something went wrong */
  error: () =>
    play((t) => {
      tone(sfxBus, SQUARE, 55, t, 0.12, 0.6);
      tone(sfxBus, SQUARE, 50, t + 0.12, 0.2, 0.6);
    }),
};

// ─────────────────────────────── music ───────────────────────────────
// Original 16-bar loop, C major, 138 BPM, 16th-note grid. [midi | 0 rest, length in 16ths]

type Seq = [number, number][];

const LEAD_A: Seq = [
  [76, 4], [79, 2], [84, 2], [83, 2], [79, 2], [76, 4],
  [81, 4], [84, 2], [81, 2], [79, 4], [76, 4],
  [77, 2], [81, 2], [84, 4], [86, 2], [84, 2], [81, 4],
  [79, 6], [83, 2], [86, 4], [0, 4],
  [76, 4], [79, 2], [84, 2], [83, 2], [79, 2], [76, 4],
  [81, 4], [84, 2], [81, 2], [79, 4], [76, 4],
  [77, 2], [81, 2], [84, 4], [86, 2], [84, 2], [81, 4],
  [79, 2], [81, 2], [83, 2], [86, 2], [91, 8],
];
const LEAD_B: Seq = [
  [81, 4], [79, 2], [77, 2], [81, 4], [84, 4],
  [83, 4], [81, 2], [79, 2], [86, 8],
  [79, 4], [76, 2], [79, 2], [83, 4], [79, 4],
  [84, 6], [83, 2], [81, 8],
  [77, 2], [79, 2], [81, 2], [84, 2], [89, 4], [88, 4],
  [86, 4], [83, 4], [79, 4], [86, 4],
  [88, 8], [86, 4], [84, 4],
  [84, 8], [0, 8],
];
const LEAD_SEQ = [...LEAD_A, ...LEAD_B];

// chord per bar (root midi, quality) for bass + arpeggio
const CHORDS: [number, "M" | "m"][] = [
  [48, "M"], [45, "m"], [41, "M"], [43, "M"], [48, "M"], [45, "m"], [41, "M"], [43, "M"],
  [41, "M"], [43, "M"], [40, "m"], [45, "m"], [41, "M"], [43, "M"], [48, "M"], [48, "M"],
];

const BPM = 138;
const STEP = 60 / BPM / 4;
const BAR = 16;
const LOOP = CHORDS.length * BAR;

// flatten the lead into a per-step lookup
const leadAt = new Map<number, [number, number]>();
{
  let s = 0;
  for (const [m, len] of LEAD_SEQ) {
    if (m) leadAt.set(s, [m, len]);
    s += len;
  }
}

let musicTimer: ReturnType<typeof setInterval> | null = null;
let nextStep = 0;
let nextTime = 0;

function scheduleStep(step: number, at: number) {
  const bar = Math.floor(step / BAR) % CHORDS.length;
  const inBar = step % BAR;
  const [root, q] = CHORDS[bar];
  const third = q === "M" ? 4 : 3;

  const lead = leadAt.get(step % LOOP);
  if (lead) tone(musicBus, LEAD, lead[0], at, lead[1] * STEP * 0.95, 0.55);

  // 12.5% pulse arpeggio, an octave above the bass
  if (inBar % 2 === 0) {
    const arp = [0, third, 7, 12][(inBar / 2) % 4];
    tone(musicBus, THIN, root + 24 + arp, at, STEP * 1.6, 0.22);
  }

  // triangle bass on eighths: root, root, fifth, root…
  if (inBar % 2 === 0) {
    const pattern = [0, 0, 7, 0, 0, 12, 7, 0];
    tone(musicBus, { type: "triangle" }, root + pattern[inBar / 2], at, STEP * 1.8, 0.9);
  }

  // noise drums: kick 1 & 3, snare 2 & 4, hats on eighths
  if (inBar === 0 || inBar === 8) tone(musicBus, { type: "sine" }, 45, at, 0.12, 0.9, 30);
  if (inBar === 4 || inBar === 12) noise(musicBus, at, 0.12, 0.45, "bandpass", 1800);
  if (inBar % 2 === 1) noise(musicBus, at, 0.03, 0.18, "highpass", 7000);
}

function startMusic() {
  if (!ctx || musicTimer) return;
  nextStep = 0;
  nextTime = ctx.currentTime + 0.15;
  musicTimer = setInterval(() => {
    if (!ctx) return;
    while (nextTime < ctx.currentTime + 0.2) {
      scheduleStep(nextStep, nextTime);
      nextStep++;
      nextTime += STEP;
    }
  }, 40);
}

function stopMusic() {
  if (readPrefs().music || !musicTimer) return;
  clearInterval(musicTimer);
  musicTimer = null;
}

/** Starts the audio context on the first user gesture (browsers block autoplay). */
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
