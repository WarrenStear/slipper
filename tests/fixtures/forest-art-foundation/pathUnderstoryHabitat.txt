import { Color } from "three";
import { getJourneySceneForEntry } from "../../data/journeyNarrative.ts";
import { ENVIRONMENT_THEMES, environmentThemeForScene, type EnvironmentTheme } from "../../components/three/environment/environmentThemes.ts";
import { terrainScatterRotation, type ScatterRotation } from "../../components/three/environment/terrainScatterRotation.ts";
import { hashString, seededUnit } from "../worldMath.ts";
import { curvedPathPointAt, curvedPathTangentAt, type MazeMorphOptions, type MazePathSegment } from "../terrain/worldPaths.ts";

export const UNDERSTORY_FORMS = ["fern", "grass", "flower", "litter", "deadwood", "wetbank", "charred"] as const;
export const UNDERSTORY_CAPACITY = 28;
type Point = [number, number, number];
type Weights = [number, number, number, number, number, number, number];
type Palette = { leaf: Point; flower: Point; earth: Point; wood: Point };
export type PathHabitat = { weights: Weights; palette: Palette };
export type PathUnderstoryInstance = { position: Point; rotation: ScatterRotation; scale: Point; t: number; offset: number; habitat: PathHabitat };
const clamp = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };
const linear = (color: string) => new Color(color).toArray() as Point;

/** Actual authored scene IDs distinguish Fire from River's shared technical biome. */
export function pathHabitatForScene(sceneId: string): PathHabitat {
  const theme: EnvironmentTheme = environmentThemeForScene(sceneId) ?? ENVIRONMENT_THEMES.woodland;
  const weights: Weights = sceneId === "fire.boundary" ? [0, .07, 0, .55, .3, 0, 1]
    : sceneId.startsWith("river.") ? [.22, .7, .06, .25, .28, 1, 0]
      : theme.id === "sanctuary" ? [.18, .38, .16, .25, .3, .8, 0]
        : theme.id === "meadow" || theme.id === "home" ? [.2, 1, .72, .18, .12, 0, 0]
          : theme.id === "riverbank" ? [.55, .7, .1, .35, .42, .7, 0]
            : theme.id === "upland" || theme.id === "highland" ? [.32, .8, .12, .52, .55, 0, 0]
              : sceneId.startsWith("sunset.") || sceneId.startsWith("thorned.") ? [.4, .22, 0, .9, .85, 0, 0]
                : [.9, .32, sceneId === "enchanted.friendship-meadow" ? .18 : .04, .65, .62, 0, 0];
  return { weights, palette: { leaf: linear(theme.leaf), flower: linear(theme.flower), earth: linear(theme.soil), wood: linear(theme.bark) } };
}

export function blendPathHabitats(source: PathHabitat, target: PathHabitat, progress: number): PathHabitat {
  const t = smooth(progress), mix = (a: number, b: number) => a + (b - a) * t;
  if (t === 0) return source;
  if (t === 1) return target;
  return { weights: source.weights.map((weight, index) => mix(weight, target.weights[index])) as Weights,
    palette: Object.fromEntries(Object.keys(source.palette).map(key => {
      const color = key as keyof Palette;
      return [color, source.palette[color].map((value, index) => mix(value, target.palette[color][index]))];
    })) as Palette };
}

export function pathUnderstoryCount(quality: string) {
  return quality === "low" ? 8 : quality === "medium" ? 16 : quality === "high" ? 24 : UNDERSTORY_CAPACITY;
}

/** Each patch selects a few compatible forms, rather than seven uniform fields. */
export function patchPathHabitat(habitat: PathHabitat, seed: number, index: number, progress: number): PathHabitat {
  const scores = habitat.weights.map((weight, form) => {
    const envelope = .3 + .7 * smooth(.5 + .5 * Math.sin(progress * 18 + form * 2.7 + (index % 2) * 1.3));
    return { form, score: weight * envelope * (.55 + seededUnit(seed, index * 19 + form * 43 + 211)) };
  }).sort((a, b) => b.score - a.score);
  const weights: Weights = [0, 0, 0, 0, 0, 0, 0];
  for (const { form, score } of scores.slice(0, index % 3 === 0 ? 3 : 2)) {
    if (score < .08) continue;
    weights[form] = clamp(habitat.weights[form] * (.65 + seededUnit(seed, index * 13 + form * 31 + 307) * .35));
  }
  return { weights, palette: habitat.palette };
}

/** Terrain samples, route exclusion and exact existing tier populations remain canonical. */
export function createPathUnderstoryInstances(segment: MazePathSegment, quality: string, morph: MazeMorphOptions,
  sampleGroundY: (x: number, z: number) => number): PathUnderstoryInstance[] {
  const count = pathUnderstoryCount(quality), seed = hashString(`${segment.key}:moonlit-understory`);
  const source = pathHabitatForScene(getJourneySceneForEntry(segment.sourceEntry.id)?.id ?? "");
  const target = pathHabitatForScene(getJourneySceneForEntry(segment.targetEntry.id)?.id ?? "");
  return Array.from({ length: count }, (_, index) => {
    const t = Math.max(.025, Math.min(.975, (index + .7) / (count + .4) + (seededUnit(seed, index + 7) - .5) * .032));
    const point = curvedPathPointAt(segment, t, morph), tangent = curvedPathTangentAt(segment, t, morph);
    const side = index % 2 === 0 ? -1 : 1, offset = 2.25 + seededUnit(seed, index + 31) * 1.85;
    const length = Math.max(.0001, Math.hypot(tangent.x, tangent.y));
    const x = point.x - tangent.y / length * offset * side, z = point.y + tangent.x / length * offset * side;
    const scale = .62 + seededUnit(seed, index + 53) * .44, spread = .9 + seededUnit(seed, index + 89) * .28;
    const warmth = seededUnit(seed, index + 97), heading = Math.atan2(tangent.x, tangent.y) + (seededUnit(seed, index + 79) - .5) * 1.18;
    const step = .35, y = sampleGroundY(x, z);
    const slopeX = (sampleGroundY(x + step, z) - sampleGroundY(x - step, z)) / (step * 2);
    const slopeZ = (sampleGroundY(x, z + step) - sampleGroundY(x, z - step)) / (step * 2);
    return { position: [x, y + .018, z], rotation: terrainScatterRotation(slopeX, slopeZ, heading),
      scale: [scale * spread, scale * (.88 + warmth * .16), scale * (1.08 - (spread - .86) * .24)], t, offset,
      habitat: patchPathHabitat(blendPathHabitats(source, target, t), seed, index, t) };
  });
}

/** Compact real forms share one geometry; zero weights collapse absent forms. */
export function createPathUnderstoryBuffers() {
  const positions: number[] = [], colors: number[] = [], forms: number[] = [];
  const triangle = (form: number, color: string, a: Point, b: Point, c: Point) => {
    positions.push(...a, ...b, ...c);
    const rgb = linear(color);
    for (let i = 0; i < 3; i++) { colors.push(...rgb); forms.push(form); }
  };
  const quad = (form: number, color: string, a: Point, b: Point, c: Point, d: Point) => {
    triangle(form, color, a, b, c); triangle(form, color, a, c, d);
  };
  // Three unequal fronds open as a fan; no repeated full radial fern crown.
  for (let frond = 0; frond < 3; frond++) {
    const angle = -.9 + frond * .8, length = .57 + frond * .075, lift = .26 + frond * .045;
    const point = (t: number): Point => [Math.cos(angle) * length * t - .2, .012 + Math.sin(t * Math.PI * .68) * lift, Math.sin(angle) * length * t + .08];
    const sx = -Math.sin(angle), sz = Math.cos(angle);
    for (let part = 0; part < 6; part++) {
      const a = point(part / 6), b = point((part + 1) / 6), w = .012 - part * .0014;
      quad(0, "#687365", [a[0]+sx*w,a[1],a[2]+sz*w], [a[0]-sx*w,a[1],a[2]-sz*w], [b[0]-sx*w,b[1],b[2]-sz*w], [b[0]+sx*w,b[1],b[2]+sz*w]);
      if (part > 0 && part < 5) {
        const leaf = .125 - part * .014;
        triangle(0, part % 2 ? "#d0d9c5" : "#f0f3e8", a, [a[0]+sx*leaf,a[1]+.025,a[2]+sz*leaf], b);
        triangle(0, "#d0d9c5", a, b, [a[0]-sx*leaf,a[1]+.015,a[2]-sz*leaf]);
      }
    }
  }
  const blade = (form: number, x: number, z: number, height: number, bend: number, color: string) => {
    for (let part = 0; part < 3; part++) {
      const a = part / 3, b = (part + 1) / 3, wa = .022 * (1 - a) + .002, wb = .022 * (1 - b) + .002;
      quad(form, color, [x-wa+bend*a*a,.012+height*a,z], [x+wa+bend*a*a,.012+height*a,z],
        [x+wb+bend*b*b,.012+height*b,z+.025*b], [x-wb+bend*b*b,.012+height*b,z+.025*b]);
    }
  };
  for (let i = 0; i < 6; i++) blade(1, -.23 + i * .071, -.2 + i % 2 * .17, .24 + i % 3 * .065, (i % 2 ? -1 : 1) * .08, i % 2 ? "#e0e7cd" : "#b9c4ac");
  for (let flower = 0; flower < 2; flower++) {
    const x = -.18 + flower * .37, z = .21 - flower * .08, y = .17 + flower * .035;
    quad(2, "#627657", [x-.006,.012,z], [x+.006,.012,z], [x+.005,y,z], [x-.005,y,z]);
    for (let petal = 0; petal < 4; petal++) {
      const a = petal * Math.PI / 2;
      triangle(2, "#f1f0e7", [x,y,z], [x+Math.cos(a-.42)*.043,y+.022,z+Math.sin(a-.42)*.043], [x+Math.cos(a+.42)*.043,y+.012,z+Math.sin(a+.42)*.043]);
    }
  }
  for (let leaf = 0; leaf < 5; leaf++) {
    const x = -.34 + leaf * .16, z = Math.sin(leaf * 2.1) * .23;
    quad(3, leaf % 2 ? "#b7a48a" : "#d4bd99", [x-.075,.012,z], [x,.027,z-.048], [x+.1,.015,z+.015], [x,.012,z+.047]);
  }
  const twig = (form: number, x: number, z: number, length: number, width: number, angle: number, color: string) => {
    const dx = Math.cos(angle), dz = Math.sin(angle), sx = -dz * width, sz = dx * width;
    const a: Point = [x-dx*length/2,.014,z-dz*length/2], b: Point = [x+dx*length/2,.018,z+dz*length/2];
    quad(form, color, [a[0]+sx,a[1],a[2]+sz], [b[0]+sx,b[1],b[2]+sz], [b[0],b[1]+width*1.4,b[2]], [a[0],a[1]+width*1.4,a[2]]);
    quad(form, color, [a[0],a[1]+width*1.4,a[2]], [b[0],b[1]+width*1.4,b[2]], [b[0]-sx,b[1],b[2]-sz], [a[0]-sx,a[1],a[2]-sz]);
  };
  twig(4, 0, .09, .86, .039, -.35, "#a89c86"); twig(4, .16, -.11, .34, .022, .8, "#b8aa92");
  for (let reed = 0; reed < 3; reed++) blade(5, -.17 + reed * .16, -.12, .31 + reed * .055, .055, "#93af94");
  for (let stone = 0; stone < 2; stone++) {
    const x = -.22 + stone * .43, z = .2 - stone * .07, r = .11;
    for (let side = 0; side < 4; side++) {
      const a = side * Math.PI / 2, b = (side + 1) * Math.PI / 2;
      triangle(5, "#b8c5c5", [x+Math.cos(a)*r,.012,z+Math.sin(a)*r], [x+Math.cos(b)*r,.012,z+Math.sin(b)*r], [x+.008,.072,z-.012]);
    }
  }
  twig(6, -.12, .02, .61, .025, .28, "#30312d"); twig(6, .16, -.16, .36, .018, -.9, "#454640");
  for (let flake = 0; flake < 3; flake++) {
    const x = -.22 + flake * .21, z = .22 - flake * .11;
    triangle(6, "#77796e", [x-.032,.012,z-.028], [x+.052,.014,z-.012], [x+.016,.024,z+.049]);
  }
  return { positions, colors, forms };
}

type UnderstoryShader = { vertexShader: string };
export function applyPathUnderstoryShader(shader: UnderstoryShader) {
  shader.vertexShader = shader.vertexShader.replace("#include <common>", `#include <common>
    attribute float understoryForm;
    attribute vec4 understoryWeightsA;
    attribute vec3 understoryWeightsB;
    attribute vec3 understoryLeaf;
    attribute vec3 understoryFlower;
    attribute vec3 understoryEarth;
    attribute vec3 understoryWood;
    float understoryWeight(){
      if(understoryForm<.5)return understoryWeightsA.x;
      if(understoryForm<1.5)return understoryWeightsA.y;
      if(understoryForm<2.5)return understoryWeightsA.z;
      if(understoryForm<3.5)return understoryWeightsA.w;
      if(understoryForm<4.5)return understoryWeightsB.x;
      if(understoryForm<5.5)return understoryWeightsB.y;
      return understoryWeightsB.z;
    }
    vec3 understoryTint(){
      if(understoryForm<1.5)return understoryLeaf;
      if(understoryForm<2.5)return understoryFlower;
      if(understoryForm<3.5||understoryForm>4.5&&understoryForm<5.5)return understoryEarth;
      return understoryWood;
    }`).replace("#include <begin_vertex>", `#include <begin_vertex>
      transformed *= understoryWeight();`)
    .replace("#include <color_vertex>", `#include <color_vertex>
      #ifdef USE_COLOR
        vColor *= understoryTint();
      #endif`);
}
