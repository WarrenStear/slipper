import { memo, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { TactileMaterial, type StorySurface } from "../storyEvents/TactileMaterial";
import { environmentBudget, forestDepthLayout, shorelineLayout, type DressingForm, type EnvironmentQuality } from "./chapterEnvironment";
import { THORNED_HOUSE_ROOM_MODULES, thornedHouseRoomCount, type ThornedHouseStage } from "../../../lib/thornedHouseArchitecture";

type FormsProps = { forms: readonly DressingForm[]; name: string; color: string; kind?: "box" | "branch" | "crown" | "stone" | "tree" | "stem" | "flower"; wood?: boolean; surface?: StorySurface; shadows?: boolean; roughness?: number };
/** Static instance matrices are uploaded only when the authored layout changes. */
export const Forms = memo(function Forms({ forms, name, color, kind = "box", wood = false, surface, shadows = false, roughness = .98 }: FormsProps) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    const dummy = new THREE.Object3D(), tint = new THREE.Color();
    const colored = forms.some(form => form.color !== undefined) || target.instanceColor !== null;
    for (let i = 0; i < forms.length; i++) {
      const form = forms[i];
      dummy.position.set(...form.position); dummy.scale.set(...form.scale);
      dummy.rotation.set(...(form.rotation ?? [0, 0, 0])); dummy.updateMatrix();
      target.setMatrixAt(i, dummy.matrix);
      if (colored) target.setColorAt(i, tint.set(form.color ?? "#ffffff"));
    }
    target.instanceMatrix.needsUpdate = true;
    if (target.instanceColor) target.instanceColor.needsUpdate = true;
    target.computeBoundingSphere(); target.computeBoundingBox();
  }, [forms]);
  return <instancedMesh ref={mesh} name={name} args={[undefined, undefined, forms.length]} receiveShadow castShadow={shadows}>
    {kind === "tree" ? <cylinderGeometry args={[.26, .5, 1, 8]} /> : kind === "stem" ? <cylinderGeometry args={[.025, .035, 1, 5]} /> : kind === "flower" ? <sphereGeometry args={[.11, 7, 5]} /> : kind === "branch" ? <cylinderGeometry args={[.46, .68, 1, 6]} /> : kind === "crown" ? <icosahedronGeometry args={[1, 1]} /> : kind === "stone" ? <icosahedronGeometry args={[1, 0]} /> : <boxGeometry args={[1, 1, 1]} />}
    {(wood || surface) ? <TactileMaterial surface={surface ?? "wood"} color={color} roughness={wood ? .96 : roughness} /> : <meshStandardMaterial color={color} roughness={roughness} />}
  </instancedMesh>;
});

export const ForestDepth = memo(function ForestDepth({ quality, reducedEffects, variant = "blue-moon" }: { quality: EnvironmentQuality; reducedEffects: boolean; variant?: "blue-moon" | "enchanted-wood" }) {
  const enchanted = variant === "enchanted-wood";
  const budget = environmentBudget(quality, reducedEffects);
  const layout = useMemo(() => {
    const trunks: DressingForm[] = [], crowns: DressingForm[] = [], roots: DressingForm[] = [];
    const up = new THREE.Vector3(0, 1, 0), direction = new THREE.Vector3(), quaternion = new THREE.Quaternion(), euler = new THREE.Euler();
    const branch = (a: THREE.Vector3, b: THREE.Vector3, width: number) => {
      direction.subVectors(b, a); const length = direction.length();
      quaternion.setFromUnitVectors(up, direction.normalize()); euler.setFromQuaternion(quaternion);
      trunks.push({ position: a.clone().add(b).multiplyScalar(.5).toArray(), scale: [width, length, width], rotation: [euler.x, euler.y, euler.z] });
    };
    for (const [i, tree] of forestDepthLayout(budget.trees, variant).entries()) {
      const [x, y, z] = tree.base, h = tree.height;
      const a = new THREE.Vector3(x, y, z), b = new THREE.Vector3(x + tree.lean * .4, h * .53, z + .12), c = new THREE.Vector3(x + tree.lean, h, z + .38);
      branch(a, b, tree.width); branch(b, c, tree.width * .6);
      for (let j = 0; j < 3; j++) {
        const angle = i * 2.4 + j * 2.1;
        const end = new THREE.Vector3(c.x + Math.cos(angle) * 2.1, h * (.69 + j * .075), c.z + Math.sin(angle) * 1.8);
        branch(b.clone().lerp(c, .35 + j * .12), end, tree.width * .24);
        crowns.push({ position: [end.x, end.y + .9, end.z], scale: [1.45 + j * .22, 1.7, 1.2 + j * .18], rotation: [.13 * j, angle, .16 * j] });
        roots.push({ position: [x + Math.cos(angle) * .48, -.03, z + Math.sin(angle) * .48], scale: [.9, .12, .25], rotation: [0, -angle, 0] });
      }
    }
    return { trunks, crowns, roots };
  }, [budget.trees, variant]);
  const stones = useMemo(() => shorelineLayout(budget.stones), [budget.stones]);
  const reeds = useMemo(() => shorelineLayout(budget.reeds, true), [budget.reeds]);
  return <group name={enchanted ? "enchanted-layered-forest" : "sanctuary-layered-forest"} userData={{ trees: budget.trees, decorativeOnly: true, drawCallBudget: 5 }}>
    <Forms forms={layout.trunks} name="depth-trunks-and-branches" color={enchanted ? "#4a4b36" : "#344139"} kind="branch" surface="bark" />
    <Forms forms={layout.crowns} name="opaque-depth-canopies" color={enchanted ? "#536346" : "#344d42"} kind="crown" />
    <Forms forms={layout.roots} name="shoreline-roots" color="#3c4034" kind="stone" surface="bark" />
    <Forms forms={stones} name="shoreline-stones" color="#65726f" kind="stone" surface="stone" />
    <Forms forms={reeds} name="shoreline-reeds" color="#64745a" kind="branch" />
  </group>;
});

export const HouseWallDetails = memo(function HouseWallDetails({ stage, detail, reducedEffects }: { stage: ThornedHouseStage; detail: number; reducedEffects: boolean }) {
  const count = thornedHouseRoomCount(detail, reducedEffects);
  const forms = useMemo(() => {
    const trim: DressingForm[] = [], panels: DressingForm[] = [], floor: DressingForm[] = [];
    const compression = stage === "bedroom" ? 1 : stage === "garden" ? .42 : .68;
    for (const [i, room] of THORNED_HOUSE_ROOM_MODULES.slice(0, count).entries()) {
      const width = room.width - compression * i * .22, height = room.height - compression * i * .1;
      const depth = i === 0 ? 1.65 : 1.2;
      for (const side of [-1, 1]) {
        // Match the inner face of the existing wall module; never fill a doorway.
        const x = room.offset * compression + side * (width / 2 - .145);
        panels.push({ position: [x, .65, room.z], scale: [.045, 1.18, depth * .94] });
        for (const y of [.12, 1.25, height - .16]) trim.push({ position: [x - side * .04, y, room.z], scale: [.085, .065, depth] });
        for (const z of [-depth * .38, depth * .38]) trim.push({ position: [x - side * .04, .66, room.z + z], scale: [.06, 1.14, .045] });
      }
    }
    for (let lane = 0; lane < 5; lane++) for (let row = 0; row < 10; row++) {
      floor.push({ position: [(lane - 2) * .62, -.041, -2.8 + row * .92 + lane % 2 * .42], scale: [.605, .025, .9] });
    }
    return { trim, panels, floor };
  }, [stage, count]);
  return <group name="house-domestic-wall-joinery" userData={{ decorativeOnly: true, drawCallBudget: 3 }}>
    <Forms forms={forms.panels} name="worn-wall-panelling" color="#3c3028" wood />
    <Forms forms={forms.trim} name="wall-rails-and-stiles" color="#82664b" wood />
    <Forms forms={forms.floor} name="worn-corridor-floorboards" color="#68513d" wood />
  </group>;
});

/** Sits inside the existing dissolving shell and shares its visibility. */
export const BrokenRoomDetails = memo(function BrokenRoomDetails() {
  const forms = useMemo(() => {
    const result: DressingForm[] = [];
    for (const side of [-1, 1]) {
      for (const y of [.17, 5.9]) result.push({ position: [side * 8.06, y, 0], scale: [.14, .12, 16.6] });
      for (const z of [-7.8, 0, 7.8]) result.push({ position: [side * 8.06, 3, z], scale: [.12, 5.85, .14] });
    }
    for (const y of [.17, 5.9]) result.push({ position: [0, y, -8.24], scale: [16.1, .12, .13] });
    return result;
  }, []);
  return <Forms forms={forms} name="damp-room-edge-joinery" color="#4c443b" wood />;
});
