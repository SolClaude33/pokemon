"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { useReducedMotion, useWebGL } from "@/lib/useClient";
import { PackArt } from "./PackArt";
import type { PackSpec } from "./three/Pack3D";

const PackViewer = dynamic(() => import("./three/PackViewer"), { ssr: false });

/** Pack art that upgrades to a draggable 3D pack once WebGL is ready. */
export function PackHero({ pack }: { pack: PackSpec }) {
  const webgl = useWebGL();
  const reducedMotion = useReducedMotion();
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);

  return (
    <figure className="relative">
      <div className="relative" style={{ aspectRatio: "548 / 1000" }}>
        <div className={`transition-opacity duration-500 ${ready ? "invisible opacity-0" : ""}`}>
          <PackArt src={pack.packImage} alt={`${pack.setName} booster pack`} priority sizes="(max-width: 768px) 62vw, 320px" />
        </div>
        {webgl && <PackViewer pack={pack} reducedMotion={reducedMotion} onReady={onReady} />}
      </div>
      <figcaption className={`hud mt-4 text-center text-faint transition-opacity ${ready ? "opacity-100" : "opacity-0"}`}>
        Drag to turn the pack
      </figcaption>
    </figure>
  );
}
