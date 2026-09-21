import { memo, useEffect, useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** One recognisable Swan across the existing cue actor and sanctuary prop.
 * This component owns appearance only: +Z is forward, as in the actor registry. */
export const SwanModel = memo(function SwanModel() {
  const shape = useMemo(() => {
    const pieces: THREE.BufferGeometry[] = [];
    function oval(position: [number, number, number], scale: [number, number, number], tilt = 0) {
      const part = new THREE.SphereGeometry(1, 16, 10);
      part.scale(...scale); part.rotateX(tilt); part.translate(...position);
      pieces.push(part);
    }
    oval([0, .28, -.04], [.35, .27, .64]);
    const neck = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, .34, .37), new THREE.Vector3(0, .56, .56),
      new THREE.Vector3(0, .87, .46), new THREE.Vector3(0, 1.18, .50),
      new THREE.Vector3(0, 1.30, .69), new THREE.Vector3(0, 1.28, .83),
    ]);
    pieces.push(new THREE.TubeGeometry(neck, 28, .073, 8, false));
    oval([0, 1.285, .82], [.112, .112, .175], -.08);
    oval([0, .27, -.63], [.18, .10, .29], -.18);
    // Layered wing feathers are merged once, rather than adding draw calls.
    for (const side of [-1, 1]) for (let i = 0; i < 5; i++) {
      oval([side * (.22 + i * .018), .36 + i * .038, -.08 - i * .042],
        [.09, .055, .42 - i * .025], -.12 - i * .07);
    }
    const merged = mergeGeometries(pieces);
    for (const piece of pieces) piece.dispose();
    if (!merged) throw new Error("Unable to compose Swan presentation geometry.");
    return merged;
  }, []);
  useEffect(() => () => shape.dispose(), [shape]);
  return <group name="sculpted-story-swan">
    <mesh geometry={shape} castShadow receiveShadow>
      <meshStandardMaterial color="#e0ded2" roughness={.78} />
    </mesh>
    <mesh position={[0, 1.25, 1.013]} rotation={[Math.PI / 2 + .15, 0, 0]}>
      <coneGeometry args={[.057, .22, 8]} /><meshStandardMaterial color="#ac7854" roughness={.75} />
    </mesh>
    <mesh position={[0, 1.29, .954]} scale={[.049, .045, .035]}>
      <sphereGeometry args={[1, 10, 6]} /><meshStandardMaterial color="#252b29" roughness={.75} />
    </mesh>
    {[-1, 1].map(side => <mesh key={side} position={[side * .095, 1.305, .869]}>
      <sphereGeometry args={[.012, 8, 6]} /><meshStandardMaterial color="#171e1c" roughness={.4} />
    </mesh>)}
  </group>;
});
