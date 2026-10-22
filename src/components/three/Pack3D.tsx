"use client";

import { Environment, Lightformer, useTexture } from "@react-three/drei";
import type { ThreeElements } from "@react-three/fiber";
import { forwardRef, useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { crimpAlphaMap, packBackTexture, packFaceGeometry } from "./packAssets";

export type PackSpec = {
  setId: string;
  setName: string;
  packImage: string;
  logo: string;
  accent: string;
};

type Props = { pack: PackSpec; height?: number; thickness?: number } & ThreeElements["group"];

let alphaMap: THREE.Texture | null = null;

/** Sealed booster as a puffy foil pillow: printed front, PokéCast back. */
export const Pack3D = forwardRef<THREE.Group, Props>(function Pack3D({ pack, height = 2.4, thickness = 0.09, ...group }, ref) {
  const front = useTexture(pack.packImage, (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
  });
  const geometry = useMemo(() => packFaceGeometry(height, thickness), [height, thickness]);
  const [back, setBack] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    let alive = true;
    packBackTexture(pack).then((t) => alive && setBack(t));
    return () => {
      alive = false;
    };
  }, [pack]);

  const materials = useMemo(() => {
    alphaMap ??= crimpAlphaMap();
    const foil = {
      alphaMap,
      alphaTest: 0.5,
      roughness: 0.38,
      metalness: 0.05,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
      iridescence: 0.3,
      iridescenceIOR: 1.35,
      iridescenceThicknessRange: [120, 480] as [number, number],
      envMapIntensity: 0.55,
    };
    return {
      front: new THREE.MeshPhysicalMaterial({ ...foil, map: front }),
      // plain foil until the generated back texture is ready
      back: new THREE.MeshPhysicalMaterial(back ? { ...foil, map: back } : { ...foil, color: "#7d8ea8" }),
    };
  }, [front, back]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <group ref={ref} {...group}>
      <mesh geometry={geometry} material={materials.front} />
      <mesh geometry={geometry} material={materials.back} rotation={[0, Math.PI, 0]} />
    </group>
  );
});

/** Studio lighting built from light-formers (no HDR download). */
export function StudioLights({ accent = "#5ec8ff" }: { accent?: string }) {
  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[2.5, 3.5, 5]} intensity={1.1} />
      <directionalLight position={[-4, -1, 2]} intensity={0.35} color={accent} />
      <Environment key={accent} resolution={256} frames={1}>
        <Lightformer form="rect" intensity={2.6} position={[0, 2.5, 4]} scale={[7, 1.4, 1]} />
        <Lightformer form="rect" intensity={1.4} color="#ffcb05" position={[-4, 0, 2]} rotation-y={Math.PI / 3} scale={[3, 6, 1]} />
        <Lightformer form="rect" intensity={1.4} color={accent} position={[4, 0, 2]} rotation-y={-Math.PI / 3} scale={[3, 6, 1]} />
        <Lightformer form="ring" intensity={1.2} color="#ff6fd8" position={[0, -3, 3]} scale={2} />
      </Environment>
    </>
  );
}
