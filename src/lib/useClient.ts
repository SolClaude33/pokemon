"use client";

import { useSyncExternalStore } from "react";
import { hasWebGL } from "@/components/three/packAssets";

const noop = () => () => {};

/** false during SSR and hydration, true once running in the browser. */
export const useMounted = () =>
  useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );

/** true in the browser when WebGL is available; false during SSR. */
export const useWebGL = () => useSyncExternalStore(noop, hasWebGL, () => false);

const subscribeMotion = (cb: () => void) => {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

export const useReducedMotion = () =>
  useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
