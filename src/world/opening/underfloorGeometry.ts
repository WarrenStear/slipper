import { Euler, Quaternion, Vector3 } from "three";
import { createTaperedBranchGeometry, mergeArtGeometries } from "../../components/three/environmentArt/authoredGeometry.ts";
import type { DressingForm } from "../../components/three/environment/chapterEnvironment";

type Point = [number, number, number];

/** The actual centreline of the existing Forms tree, including its slight bend.
 * Child limbs and foliage use that centreline rather than floating beside it. */
function spine(form: DressingForm, t: number): Point {
  return new Vector3(t * t * .13, t - .5, Math.sin(t * 4) * .045)
    .multiply(new Vector3(...form.scale))
    .applyEuler(new Euler(...(form.rotation ?? [0, 0, 0])))
    .add(new Vector3(...form.position)).toArray();
}
function limb(a: Point, b: Point, width: number): DressingForm {
  const start = new Vector3(...a), end = new Vector3(...b), direction = end.clone().sub(start);
  const length = direction.length();
  const rotation = new Euler().setFromQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize()));
  return { position: start.add(end).multiplyScalar(.5).toArray(), scale: [width, length, width * .88], rotation: [rotation.x, rotation.y, rotation.z] };
}

/** Seventeen irregular rooted trees use the same 34 instanced stems, 30 crowns
 * and single merged six-limb geometry. Near fork, middle banks and distant
 * stems leave an uneven sightline to the existing low lantern. */
export function createUnderfloorGeometry() {
  const trunks: DressingForm[] = [], crowns: DressingForm[] = [];
  // x, z, height, width, lean; every row is an authored tree, never a mirrored pair.
  const trees = [
    [-3.6, -2.6, 9.7, 1.15, -.72], [3.8, .8, 10.15, 1.02, .63],
    [-5.9, 5.1, 8.6, .92, .47], [5.2, 8.3, 9.4, .86, -.68],
    [-3.8, 11.8, 7.8, .79, -.48], [-8.1, 14.2, 9.2, .99, .62],
    [6.6, 20.3, 8.4, .88, .54], [3.7, 22.2, 7.3, .64, -.43],
    [-6.2, 28.1, 9.7, .96, -.66], [8.9, 30.3, 10.2, 1.03, -.52],
    [-3.2, 37.4, 8.7, .74, .41], [5.9, 39.8, 9.6, .83, .59],
    [-9.2, 46.3, 10.5, 1.08, -.51], [2.9, 51.1, 8.1, .72, -.38],
    [-5.8, 53.2, 9.3, .89, .57], [8.2, 59.7, 10.4, .97, .46],
    [-2.8, 63.1, 8.9, .78, -.39],
  ];
  const main: DressingForm[] = [], forks: DressingForm[] = [];
  trees.forEach(([x, z, height, width, lean], i) => {
    const side = Math.sign(x), stem = limb([x, -.3, z], [x + lean, height, z + .3 + (i % 3) * .16], width);
    const birth = spine(stem, .58 + (i % 4) * .055);
    const fork = limb(birth, [birth[0] - side * (1.3 + (i % 3) * .32), height * (.87 + (i % 2) * .06), birth[2] + .75 + (i % 3) * .34], width * .46);
    main.push(stem); forks.push(fork); trunks.push(stem, fork);
    if (i < 2) return; // Bare overhead boughs frame, rather than plug, the near aperture.
    for (const [j, support] of [stem, fork].entries()) {
      const tip = spine(support, 1), breadth = .85 + (i % 3) * .17;
      crowns.push({ position: [tip[0], tip[1] - .18, tip[2]], scale: [breadth, .82 + (i % 2) * .19, breadth * .86], rotation: [.08 * side, i * 1.37 + j * .8, -.07 * side] });
    }
  });
  const left = spine(main[0], .94), leftFork = spine(forks[0], .91);
  const right = spine(main[1], .94), rightFork = spine(forks[1], .91);
  const middle = spine(main[4], .75), far = spine(main[7], .8);
  const branches = mergeArtGeometries([
    createTaperedBranchGeometry([left, [left[0] + .25, 10.35, left[2] + .5], [-2.7, 10.6, .4], [-1.3, 10.45, 1.2]], .29, 31),
    createTaperedBranchGeometry([leftFork, [leftFork[0] + .55, 9.65, leftFork[2] + .5], [-.7, 9.55, 2.2]], .13, 32),
    createTaperedBranchGeometry([right, [right[0] - .35, 10.7, right[2] + .5], [2.5, 10.8, 3.2], [1.2, 10.55, 4.1]], .26, 72),
    createTaperedBranchGeometry([rightFork, [rightFork[0] - .6, 9.9, rightFork[2] + .5], [.5, 9.7, 4.8]], .12, 73),
    createTaperedBranchGeometry([middle, [middle[0] - .7, middle[1] + .55, middle[2] + 1.1], [middle[0] - 1.35, middle[1] + .75, middle[2] + 1.8]], .15, 13),
    createTaperedBranchGeometry([far, [far[0] + .65, far[1] + .55, far[2] + 1.1], [far[0] + 1.15, far[1] + .75, far[2] + 1.8]], .12, 14),
  ]);
  return { trunks, crowns, branches };
}
