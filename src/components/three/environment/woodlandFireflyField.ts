/** Only dark woodland chapters receive this local effect, not a global sparkle field. */
const FIREFLY_SCENES = new Set(["enchanted.rabbit-hole", "enchanted.masked-hearth"]);
const unit = (seed: number) => { const n = Math.sin(seed * 73.13 + 51.9) * 43758.5453; return n - Math.floor(n); };
export function fireflyCount(sceneId: string, quality: string, reducedEffects = false, reducedMotion = false) {
  if (!FIREFLY_SCENES.has(sceneId) || reducedEffects || reducedMotion) return 0;
  return quality === "cinematic" ? 18 : quality === "high" ? 12 : 0;
}
export function createFireflyField(count: number) {
  const bounded = Number.isFinite(count) ? Math.max(0, Math.min(18, Math.floor(count))) : 0;
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
  uniform float time, pointScale;
  varying float pulse, viewDepth;
  void main() {
    vec3 p = position;
    p.x += sin(time * .26 + fireflySeed) * .3;
    p.y += sin(time * .34 + fireflySeed * 1.7) * .18;
    p.z += cos(time * .21 + fireflySeed * .8) * .22;
    vec4 view = modelViewMatrix * vec4(p, 1.);
    viewDepth = -view.z;
    pulse = .58 + .22 * sin(time * .55 + fireflySeed);
    gl_PointSize = clamp(pointScale * (.8 + .2 * sin(fireflySeed)) / max(1., viewDepth), 1., 14.);
    gl_Position = projectionMatrix * view;
  }
`;
export const FIREFLY_FRAGMENT = `
  uniform vec3 tint;
  uniform float opacity, fogDensity;
  varying float pulse, viewDepth;
  void main() {
    float radius = length(gl_PointCoord - .5) * 2.;
    float halo = pow(max(0., 1. - radius), 2.);
    float core = 1. - smoothstep(.05, .28, radius);
    float nearFade = smoothstep(1.2, 3., viewDepth);
    float farFade = 1. - smoothstep(20., 34., viewDepth);
    float fogFade = exp(-fogDensity * fogDensity * viewDepth * viewDepth);
    float alpha = (halo * .55 + core * .45) * opacity * pulse * nearFade * farFade * fogFade;
    gl_FragColor = vec4(tint, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
