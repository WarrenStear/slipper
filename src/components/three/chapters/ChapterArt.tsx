import { HeroAssetSlot } from "../actors/HeroAssetSlot";
import { memo, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { TactileMaterial, type StorySurface } from "../storyEvents/TactileMaterial";
import { createWornTimberGeometry } from "../environmentArt/authoredGeometry";
import { createBasinGeometry, createConstructionGeometry, createUpholsteryGeometry, type ArtVector, type ConstructionPiece } from "./chapterArtGeometry";
import { windowJoineryPieces } from "./windowConstruction";

export const TimberAssembly = memo(function TimberAssembly({ pieces, color, plaster = false, surface, name }: {
  pieces: readonly ConstructionPiece[]; color: string; plaster?: boolean; surface?: StorySurface; name?: string;
}) {
  const geometry = useMemo(() => createConstructionGeometry(pieces, plaster), [pieces, plaster]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh name={name} geometry={geometry} castShadow receiveShadow>
    <TactileMaterial surface={surface ?? (plaster ? "plaster" : "wood")} constructionCoordinates={!plaster} color={color} vertexColors roughness={plaster ? .96 : .86} />
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

export const Upholstery = memo(function Upholstery({ position, rotation, size, color, surface = "velvet" }: {
  position: ArtVector; rotation?: ArtVector; size: ArtVector; color: string; surface?: StorySurface;
}) {
  const [width, height, depth] = size;
  const geometry = useMemo(() => createUpholsteryGeometry([width, height, depth]), [width, height, depth]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} position={position} rotation={rotation} castShadow receiveShadow>
    <TactileMaterial surface={surface} color={color} roughness={.97} />
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

export const WindowJoinery = memo(function WindowJoinery({ width, height, color = "#695544", linenRail = false }: {
  width: number; height: number; color?: string; linenRail?: boolean;
}) {
  const pieces = useMemo(() => windowJoineryPieces(width, height, color, linenRail), [width, height, color, linenRail]);
  return <TimberAssembly pieces={pieces} color={linenRail ? "#ffffff" : color} />;
});

/** Four legs and an apron below the unchanged table top/interaction height. */
export const WritingDesk = memo(function WritingDesk({ width = 2.8, depth = 1.34, height = .78, color = "#5f4938" }: {
  width?: number; depth?: number; height?: number; color?: string;
}) {
  const pieces = useMemo<ConstructionPiece[]>(() => [
    ...[-1, 0, 1].map(i => ({ position: [0, 0, i * depth / 3] as ArtVector, size: [width, .15, depth / 3 - .007] as ArtVector })),
    ...[-1, 1].flatMap(x => [-1, 1].map(z => ({ position: [x * width * .386, -(height + .075) / 2, z * depth * .313] as ArtVector, size: [.14, height - .075, .14] as ArtVector }))),
    ...[-1, 1].map(z => ({ position: [0, -.19, z * depth * .313] as ArtVector, size: [width * .8, .24, .09] as ArtVector })),
    ...[-1, 1].map(x => ({ position: [x * width * .386, -.19, 0] as ArtVector, size: [.09, .24, depth * .67] as ArtVector })),
  ], [width, depth, height]);
  return <HeroAssetSlot id="writing-desk"><group name="joined-writing-desk">
    <TimberAssembly pieces={pieces} color={color} />
    <TimberAssembly color="#68513b" pieces={[-1,0,1].map(i=>({position:[i*width*.265,-.19,-depth*.337],size:[width*.25,.2,.065]}))} />
    <TimberAssembly surface="metal" color="#8b7655" pieces={[-1,0,1].map(i=>({position:[i*width*.265,-.19,-depth*.375],size:[.13,.024,.033]}))} />
  </group></HeroAssetSlot>;
});

export const RestingThrow = memo(function RestingThrow({ position, size, color = "#a69b82", rotation = [0, 0, 0], maxDrop = Infinity }: {
  position: ArtVector; size: [number, number]; color?: string; rotation?: ArtVector; maxDrop?: number;
}) {
  const [width, length] = size;
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(width, length, 12, 18), p = g.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), t = (p.getY(i) / length + .5);
      const fold = Math.sin(x / width * 21 + t * 2) * .018 + Math.sin(x / width * 9) * .01;
      const drop = Math.min(maxDrop, Math.pow(Math.max(0, t - .58), 1.35) * length * 1.4);
      p.setXYZ(i, x * (1 - .025 * t), fold - drop, (t - .5) * length * .62);
    }
    g.computeVertexNormals(); return g;
  }, [width, length, maxDrop]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh name="gravity-draped-linen" geometry={geometry} position={position} rotation={rotation} receiveShadow>
    <TactileMaterial surface="linen" color={color} roughness={.98} side={THREE.DoubleSide} />
  </mesh>;
});

/** Covers and inset paper edges retain individual spines in two material batches. */
export const ShelvedBooks = memo(function ShelvedBooks({ count, spacing = .51, rowHeight = .96, startX = -.98, startY = 1.15, z = .03, scale = 1 }: {
  count: number; spacing?: number; rowHeight?: number; startX?: number; startY?: number; z?: number; scale?: number;
}) {
  const pieces = useMemo(() => {
    const covers: ConstructionPiece[] = [], pages: ConstructionPiece[] = [];
    for (let i = 0; i < count; i++) {
      const h = (.49 + (i * 7 % 5) * .058) * scale, w = (.22 + (i * 3 % 4) * .029) * scale, d = (.38 + (i * 3 % 5) * .024) * scale;
      const x = startX + (i % 4) * spacing + Math.sin(i * 4) * .023;
      const y = startY - .27 * scale + Math.floor(i / 4) * rowHeight + h / 2;
      const color = ["#70534a", "#59635c", "#857452", "#665f54", "#494b46"][i % 5];
      covers.push({ position: [x - w / 2, y, z], size: [.035 * scale, h, d], color },
        { position: [x + w / 2, y, z], size: [.035 * scale, h, d], color },
        { position: [x, y, z - d / 2], size: [w, h, .035 * scale], color });
      for (const dy of [-.32, .29]) covers.push({ position: [x, y + dy * h, z - d / 2 - .014], size: [w * .97, .022, .018], color });
      pages.push({ position: [x, y, z + .008], size: [w * .9, h * .92, d * .92] });
    }
    return { covers, pages };
  }, [count, spacing, rowHeight, startX, startY, z, scale]);
  return <group name="clothbound-spines-and-paper-edges">
    <TimberAssembly pieces={pieces.covers} color="#ffffff" surface="linen" />
    <TimberAssembly pieces={pieces.pages} color="#b6ac94" surface="paper" />
  </group>;
});
