import { boundedDrawCount, FIREFLY_CAPACITY } from "./woodlandRuntimeBudget.ts";

/** Only dark woodland chapters receive this local effect, not a global sparkle field. */
const FIREFLY_SCENES = new Set(["enchanted.rabbit-hole", "enchanted.masked-hearth"]);
const unit = (seed: number) => { const n = Math.sin(seed * 73.13 + 51.9) * 43758.5453; return n - Math.floor(n); };
export function fireflyCount(sceneId: string, quality: string, reducedEffects = false, reducedMotion = false) {
  if (!FIREFLY_SCENES.has(sceneId) || reducedEffects || reducedMotion) return 0;
  return quality === "cinematic" ? FIREFLY_CAPACITY : quality === "high" ? 12 : 0;
}
export function createFireflyField(count: number) {
  const bounded = boundedDrawCount(count, FIREFLY_CAPACITY);
  const positions = new Float32Array(bounded * 3), seeds = new Float32Array(bounded);
  for (let i = 0; i < bounded; i++) {
    const side = i % 2 ? 1 : -1;
    positions.set([side * (9.3 + unit(i + 71) * .6), .65 + unit(i + 89) * 1.8, -4.5 + unit(i + 107) * 12], i * 3);
    seeds[i] = unit(i + 127) * Math.PI * 2;
  }
  return { positions, seeds };
}
export const FIREFLY_VERTEX = `
  attribute float fireflySeed;
  uniform float time, pointScale, pointSizeMin, pointSizeMax;
  varying float pulse, viewDepth;
  void main() {
    vec3 p = position;
    p.x += sin(time * .26 + fireflySeed) * .3;
    p.y += sin(time * .34 + fireflySeed * 1.7) * .18;
    p.z += cos(time * .21 + fireflySeed * .8) * .22;
    vec4 view = modelViewMatrix * vec4(p, 1.);
    viewDepth = -view.z;
    pulse = .58 + .22 * sin(time * .55 + fireflySeed);
    gl_PointSize = clamp(pointScale * (.8 + .2 * sin(fireflySeed)) / max(1., viewDepth), pointSizeMin, pointSizeMax);
    gl_Position = projectionMatrix * view;
  }
`;
export const FIREFLY_FRAGMENT = `
  uniform vec3 tint;
  uniform float opacity, fogDensity;
  varying float pulse, viewDepth;
  void main() {
    float nearFade = smoothstep(1.2, 3., viewDepth);
    float farFade = 1. - smoothstep(20., 34., viewDepth);
    if (opacity <= 0. || nearFade <= 0. || farFade <= 0.) discard;
    vec2 pointOffset = (gl_PointCoord - .5) * 2.;
    float radiusSquared = dot(pointOffset, pointOffset);
    if (radiusSquared >= 1.) discard;
    float radius = sqrt(radiusSquared);
    float halo = pow(max(0., 1. - radius), 2.);
    float core = 1. - smoothstep(.05, .28, radius);
    float fogFade = exp(-fogDensity * fogDensity * viewDepth * viewDepth);
    float alpha = (halo * .55 + core * .45) * opacity * pulse * nearFade * farFade * fogFade;
    gl_FragColor = vec4(tint, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
