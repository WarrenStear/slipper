import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export type ThornThicketDetail = "base" | "detail";
type Point3 = readonly [number, number, number];

// Thorn pressure is a woodland silhouette, not architectural masonry. These
// planted tangles fit inside the existing one-metre instanced worker envelope.
// Their origin and Rapier collider remain unchanged; no path is blocked by
// newly added geometry beyond the already reserved instance footprint.
const GROWTH: readonly { readonly points: readonly Point3[]; readonly radius: number; readonly tone: string }[] = [
  { points: [[-.30,-.49,-.34],[-.28,-.20,-.22],[-.15,.09,-.05],[.12,.47,.13]], radius:.068,tone:"#a4a18d" },
  { points: [[.26,-.49,-.25],[.21,-.24,-.15],[-.06,.10,.16],[-.20,.44,.28]], radius:.073,tone:"#8f8976" },
  { points: [[-.24,-.49,.30],[-.11,-.21,.21],[.13,.10,-.05],[.30,.31,-.26]], radius:.058,tone:"#958e79" },
  { points: [[.24,-.49,.34],[.08,-.24,.19],[-.20,.07,-.12],[-.34,.36,-.32]], radius:.056,tone:"#a39b85" },
  { points: [[-.30,-.33,.16],[-.09,-.03,-.31],[.12,.22,-.23],[.28,.38,.07]], radius:.052,tone:"#848473" },
  { points: [[.28,-.35,-.10],[.10,-.12,.29],[-.18,.23,.16],[-.22,.43,-.15]], radius:.048,tone:"#a6a18c" },
  { points: [[-.17,-.48,-.08],[.17,-.15,-.04],[.26,.04,.26],[.16,.45,.21]], radius:.045,tone:"#7a806f" },
  { points: [[.12,-.48,.04],[-.22,-.18,.08],[-.28,.18,-.23],[.09,.42,-.31]], radius:.043,tone:"#9e9985" },
];

function paint(geometry: THREE.BufferGeometry, colour: string) {
  const p = geometry.getAttribute("position");
  const shade = new THREE.Color(colour);
  const colors = new Float32Array(p.count * 3);
  for (let index = 0; index < p.count; index++) {
    const variation = .89 + (index % 7) * .017;
    colors.set([shade.r * variation, shade.g * variation, shade.b * variation], index * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}

/** Curved branches taper continuously to their tips; no orthogonal box walls. */
function vine(points: readonly Point3[], radius: number, steps: number) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  const sides = 5;
  const geometry = new THREE.TubeGeometry(curve, steps, 1, sides, false);
  const positions = geometry.getAttribute("position");
  for (let row = 0; row <= steps; row++) {
    const centre = curve.getPointAt(row / steps);
    const t = row / steps;
    const section = radius * (.94 - .74 * t);
    for (let side = 0; side <= sides; side++) {
      const index = row * (sides + 1) + side;
      positions.setXYZ(index,
        centre.x + (positions.getX(index) - centre.x) * section,
        centre.y + (positions.getY(index) - centre.y) * section,
        centre.z + (positions.getZ(index) - centre.z) * section);
    }
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

/** One opaque instanced thicket replaces each rectangular woodland ruin box.
 * Base and detail tiers retain the same six primary vine placements.
 * Rendered vertex colours use the existing instance and woodland palette.
 */
export function createThornThicketGeometry(detail: ThornThicketDetail = "base") {
  const full = detail === "detail", growthCount = full ? GROWTH.length : 6;
  const parts: THREE.BufferGeometry[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  for (let index = 0; index < growthCount; index++) {
    const growth = GROWTH[index];
    const twig = vine(growth.points, growth.radius, full ? 12 : 8);
    parts.push(paint(twig, growth.tone));
    const curve = new THREE.CatmullRomCurve3(growth.points.map(p => new THREE.Vector3(...p)));
    for (let thorn = 0; thorn < (full ? 3 : 2); thorn++) {
      const t = .3 + thorn * .22;
      const anchor = curve.getPointAt(t);
      const direction = new THREE.Vector3(
        (index + thorn) % 2 ? -.73 : .73, .46,
        (index + thorn) % 3 ? .42 : -.42).normalize();
      const spike = new THREE.ConeGeometry(full ? .058 : .053, .14, 4, 1);
      spike.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, direction));
      spike.translate(anchor.x + direction.x * .065, anchor.y + direction.y * .065, anchor.z + direction.z * .065);
      parts.push(paint(spike, "#b6a88b"));
    }
  }
  const merged = mergeGeometries(parts, false);
  parts.forEach(g => g.dispose());
  if (!merged) throw new Error("Cannot merge thorn thicket geometry");
  merged.name = "thorned-woodland-living-tangle-" + detail;
  merged.userData = { decorativeOnly: true, detail, primaryBranches: 6, livingTangle: true };
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}
