"use client";

import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { Suspense, useEffect, useRef } from "react";
import * as THREE from "three";
import { Pack3D, StudioLights, type PackSpec } from "./Pack3D";

function Spinner({ pack, reducedMotion, onReady }: { pack: PackSpec; reducedMotion: boolean; onReady: () => void }) {
  const ref = useRef<THREE.Group>(null);
  const drag = useRef({ spin: 0, velocity: 0, dragging: false, lastX: 0 });

  useEffect(() => {
    const id = requestAnimationFrame(onReady);
    return () => cancelAnimationFrame(id);
  }, [onReady]);

  useFrame((state, delta) => {
    const g = ref.current;
    const d = drag.current;
    if (!g) return;
    if (!d.dragging) {
      // coast, then settle on whichever face is closest (front or back)
      d.spin += d.velocity;
      d.velocity *= 0.92;
      if (Math.abs(d.velocity) < 0.002) {
        const face = Math.round(d.spin / Math.PI) * Math.PI;
        d.spin = THREE.MathUtils.damp(d.spin, face, 4, delta);
      }
    }
    const t = state.clock.elapsedTime;
    const idle = reducedMotion ? 0 : Math.sin(t * 0.8) * 0.12;
    g.rotation.y = d.spin + idle + state.pointer.x * 0.25;
    g.rotation.x = state.pointer.y * 0.15 + (reducedMotion ? 0 : Math.sin(t * 1.1) * 0.03);
    g.position.y = reducedMotion ? 0 : Math.sin(t * 1.3) * 0.04;
  });

  const down = (e: ThreeEvent<PointerEvent>) => {
    drag.current.dragging = true;
    drag.current.velocity = 0;
    drag.current.lastX = e.clientX;
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const move = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current;
    if (!d.dragging) return;
    const dx = (e.clientX - d.lastX) * 0.012;
    d.spin += dx;
    d.velocity = dx;
    d.lastX = e.clientX;
  };
  const up = () => {
    drag.current.dragging = false;
  };

  return (
    <>
      {/* invisible catcher so the pack can be dragged from anywhere in the frame */}
      <mesh position={[0, 0, -1]} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <planeGeometry args={[12, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <Pack3D ref={ref} pack={pack} height={2.4} />
    </>
  );
}

export default function PackViewer({ pack, reducedMotion, onReady }: { pack: PackSpec; reducedMotion: boolean; onReady: () => void }) {
  return (
    <div className="absolute inset-[-8%] cursor-grab touch-pan-y active:cursor-grabbing">
      <Canvas flat dpr={[1, 2]} camera={{ position: [0, 0, 5.2], fov: 32 }} gl={{ antialias: true, alpha: true }} aria-hidden="true">
        <StudioLights accent={pack.accent} />
        <Suspense fallback={null}>
          <Spinner pack={pack} reducedMotion={reducedMotion} onReady={onReady} />
        </Suspense>
      </Canvas>
    </div>
  );
}
