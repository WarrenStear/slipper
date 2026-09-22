import { memo, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { TactileMaterial, type StorySurface } from "../storyEvents/TactileMaterial";
import { createWornTimberGeometry } from "../environmentArt/authoredGeometry";
import { createBasinGeometry, createConstructionGeometry, createUpholsteryGeometry, type ArtVector, type ConstructionPiece } from "./chapterArtGeometry";

export const TimberAssembly = memo(function TimberAssembly({ pieces, color, plaster = false, surface, name }: {
  pieces: readonly ConstructionPiece[]; color: string; plaster?: boolean; surface?: StorySurface; name?: string;
}) {
  const geometry = useMemo(() => createConstructionGeometry(pieces, plaster), [pieces, plaster]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh name={name} geometry={geometry} castShadow receiveShadow>
    <TactileMaterial surface={surface ?? (plaster ? "plaster" : "wood")} color={color} vertexColors roughness={plaster ? .96 : .86} />
  </mesh>;
});

/** Shared unit form for narrow repeated boards: one upload, one opaque draw. */
export const TimberInstances = memo(function TimberInstances({ forms, color, name, surface = "wood" }: {
  forms: readonly { position: ArtVector; scale: ArtVector; rotation?: ArtVector; color?: string }[];
  color: string; name?: string; surface?: StorySurface;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => createWornTimberGeometry([1, 1, 1], 41), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useLayoutEffect(() => {
    if (!mesh.current) return;
    const object = new THREE.Object3D(), tint = new THREE.Color();
    for (const [i, form] of forms.entries()) {
      object.position.set(...form.position); object.scale.set(...form.scale);
      object.rotation.set(...(form.rotation ?? [0, 0, 0])); object.updateMatrix();
      mesh.current.setMatrixAt(i, object.matrix); mesh.current.setColorAt(i, tint.set(form.color ?? "#ffffff"));
    }
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
    mesh.current.computeBoundingBox(); mesh.current.computeBoundingSphere();
  }, [forms]);
  return <instancedMesh name={name} ref={mesh} geometry={geometry} args={[undefined, undefined, forms.length]} receiveShadow>
    <TactileMaterial surface={surface} color={color} roughness={.9} />
  </instancedMesh>;
});

export const Upholstery = memo(function Upholstery({ position, rotation, size, color }: {
  position: ArtVector; rotation?: ArtVector; size: ArtVector; color: string;
}) {
  const [width, height, depth] = size;
  const geometry = useMemo(() => createUpholsteryGeometry([width, height, depth]), [width, height, depth]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} position={position} rotation={rotation} castShadow receiveShadow>
    <TactileMaterial surface="velvet" color={color} roughness={.97} />
  </mesh>;
});

export const StoneBasin = memo(function StoneBasin({ position, radius = 1.68, height = .45, color = "#706756", metal = false }: {
  position: ArtVector; radius?: number; height?: number; color?: string; metal?: boolean;
}) {
  const geometry = useMemo(() => createBasinGeometry(radius, height), [radius, height]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} position={position} receiveShadow>
    <TactileMaterial surface={metal ? "metal" : "stone"} color={color} metalness={metal ? .55 : .03} roughness={metal ? .38 : .84} side={THREE.DoubleSide} />
  </mesh>;
});

export const WindowJoinery = memo(function WindowJoinery({ width, height, color = "#695544" }: {
  width: number; height: number; color?: string;
}) {
  const pieces = useMemo<ConstructionPiece[]>(() => [
    ...[-1, 1].map(side => ({ position: [side * (width / 2 + .055), 0, -.03] as ArtVector, size: [.11, height + .22, .18] as ArtVector })),
    ...[-1, 1].map(side => ({ position: [0, side * (height / 2 + .055), -.03] as ArtVector, size: [width + .11, .11, .18] as ArtVector })),
    { position: [0, 0, -.12], size: [.065, height, .08] },
    { position: [0, .12, -.12], size: [width, .055, .08] },
    { position: [0, -height / 2 - .08, -.08], size: [width + .34, .12, .35] },
  ], [width, height]);
  return <TimberAssembly pieces={pieces} color={color} />;
});

/** Four legs and an apron below the unchanged table top/interaction height. */
export const WritingDesk = memo(function WritingDesk({ width = 2.8, depth = 1.34, height = .78, color = "#5f4938" }: {
  width?: number; depth?: number; height?: number; color?: string;
}) {
  const pieces = useMemo<ConstructionPiece[]>(() => [
    { position: [0, 0, 0], size: [width, .18, depth] },
    ...[-1, 1].flatMap(x => [-1, 1].map(z => ({ position: [x * width * .386, -height * .47, z * depth * .313] as ArtVector, size: [.14, height * .87, .14] as ArtVector }))),
    ...[-1, 1].map(z => ({ position: [0, -.19, z * depth * .313] as ArtVector, size: [width * .8, .24, .09] as ArtVector })),
    ...[-1, 1].map(x => ({ position: [x * width * .386, -.19, 0] as ArtVector, size: [.09, .24, depth * .67] as ArtVector })),
  ], [width, depth, height]);
  return <TimberAssembly name="joined-writing-desk" pieces={pieces} color={color} />;
});

/** Covers and inset paper edges retain individual spines in two material batches. */
export const ShelvedBooks = memo(function ShelvedBooks({ count, spacing = .51, rowHeight = .96, startX = -.98, startY = 1.15, z = .03, scale = 1 }: {
  count: number; spacing?: number; rowHeight?: number; startX?: number; startY?: number; z?: number; scale?: number;
}) {
  const pieces = useMemo(() => {
    const covers: ConstructionPiece[] = [], pages: ConstructionPiece[] = [];
    for (let i = 0; i < count; i++) {
      const x = startX + (i % 4) * spacing, y = startY + Math.floor(i / 4) * rowHeight;
      const h = (.62 + (i % 2) * .12) * scale, w = .34 * scale, d = .46 * scale;
      const color = ["#78594e", "#536260", "#8a744f"][i % 3];
      covers.push({ position: [x - w / 2, y, z], size: [.035 * scale, h, d], color },
        { position: [x + w / 2, y, z], size: [.035 * scale, h, d], color },
        { position: [x, y, z - d / 2], size: [w, h, .035 * scale], color });
      pages.push({ position: [x, y, z + .008], size: [w * .9, h * .92, d * .92] });
    }
    return { covers, pages };
  }, [count, spacing, rowHeight, startX, startY, z, scale]);
  return <group name="clothbound-spines-and-paper-edges">
    <TimberAssembly pieces={pieces.covers} color="#ffffff" surface="linen" />
    <TimberAssembly pieces={pieces.pages} color="#b6ac94" surface="paper" />
  </group>;
});
