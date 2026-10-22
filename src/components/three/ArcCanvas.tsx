"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useRef } from "react";
import * as THREE from "three";
import { Pack3D, StudioLights, type PackSpec } from "./Pack3D";

type Props = {
  packs: PackSpec[];
  active: number;
  reducedMotion: boolean;
  onSelect: (i: number) => void;
  onOpen: (i: number) => void;
  onReady: () => void;
};

const RADIUS = 7;
const STEP = 0.36; // radians between packs on the wheel
const PACK_H = 2.4;
const FOV = 32;

/** Keeps the active pack at a fixed share of the viewport on any aspect ratio. */
function fitCamera(camera: THREE.Camera, width: number, height: number, lift: number) {
  const aspect = width / height;
  const tan = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  // short screens give the caption more room
  const byHeight = (PACK_H * 1.06) / (height < 720 ? 0.38 : 0.5);
  const byWidth = (PACK_H * 0.548 * 1.06) / (0.56 * aspect);
  const z = Math.max(byHeight, byWidth) / (2 * tan);
  camera.position.set(0, -2 * z * tan * (height < 720 ? lift + 0.09 : lift), z);
}

function FitCamera({ lift }: { lift: number }) {
  // runs before every render (priority -1), so even the first frame is framed right
  useFrame(({ camera, size }) => fitCamera(camera, size.width, size.height, lift), -1);
  return null;
}

/** Wrapped signed distance on a loop of n items. */
const wrap = (d: number, n: number) => ((((d + n / 2) % n) + n) % n) - n / 2;

function Wheel({ packs, active, reducedMotion, onSelect, onOpen, onReady }: Props) {
  const refs = useRef<(THREE.Group | null)[]>([]);
  // runs once the pack textures resolved (this component suspends until then)
  useEffect(() => {
    // wait two frames so the packs have been drawn in place before revealing
    let id = requestAnimationFrame(() => {
      id = requestAnimationFrame(() => onReady());
    });
    return () => cancelAnimationFrame(id);
  }, [onReady]);
  const cursor = useRef(active);
  const n = packs.length;
  const dim = new THREE.Color();

  useFrame((state, delta) => {
    // ease the wheel toward the active pack along the shortest way round
    const target = cursor.current + wrap(active - cursor.current, n);
    cursor.current = THREE.MathUtils.damp(cursor.current, target, reducedMotion ? 30 : 5, delta);
    const t = state.clock.elapsedTime;

    refs.current.forEach((g, i) => {
      if (!g) return;
      const d = wrap(i - cursor.current, n);
      const ad = Math.abs(d);
      const a = d * STEP;
      g.position.set(RADIUS * Math.sin(a), RADIUS * Math.cos(a) - RADIUS, -ad * 0.9);
      const focus = Math.max(0, 1 - ad);
      const float = reducedMotion ? 0 : focus * Math.sin(t * 1.3) * 0.06;
      g.position.y += float;
      g.rotation.set(
        focus * -state.pointer.y * 0.18,
        -d * 0.42 + focus * (reducedMotion ? 0 : Math.sin(t * 0.7) * 0.18 + state.pointer.x * 0.35),
        -a * 0.85,
      );
      g.scale.setScalar(0.86 + focus * 0.2);
      g.visible = ad < 2.6;
      const shade = THREE.MathUtils.lerp(1, 0.32, Math.min(ad, 2) / 2);
      dim.setScalar(shade);
      g.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.MeshPhysicalMaterial | undefined;
        if (m?.map) m.color.copy(dim);
      });
    });
  });

  return (
    <>
      {packs.map((p, i) => (
        <Pack3D
          key={p.setId}
          ref={(g) => {
            refs.current[i] = g;
          }}
          pack={p}
          onClick={(e) => {
            e.stopPropagation();
            if (i === active) onOpen(i);
            else onSelect(i);
          }}
          onPointerOver={() => (document.body.style.cursor = "pointer")}
          onPointerOut={() => (document.body.style.cursor = "")}
        />
      ))}
    </>
  );
}

export default function ArcCanvas(props: Props) {
  return (
    <Canvas
      className="!absolute inset-0"
      dpr={[1, 1.75]}
      flat
      camera={{ position: [0, 0, 6.4], fov: FOV }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      aria-hidden="true"
    >
      <FitCamera lift={0.1} />
      <StudioLights accent={props.packs[props.active]?.accent} />
      <Suspense fallback={null}>
        <Wheel {...props} />
      </Suspense>
    </Canvas>
  );
}
