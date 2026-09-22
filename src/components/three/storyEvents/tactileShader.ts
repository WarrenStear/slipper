/** Shader-only surface policy. No scene, input, narrative or persistent state. */
export const STORY_SURFACES = ["wood", "linen", "paper", "bark", "stone", "earth", "wax", "metal", "wet-wood", "charred-wood", "painted-wood", "plaster", "velvet", "ash", "moss"] as const;
export type StorySurface = typeof STORY_SURFACES[number];
export type TactileDetail = "base" | "relief";
export type TactileShader = { vertexShader: string; fragmentShader: string };

/** Reduced effects and low/medium quality retain colour/roughness, not micro-relief. */
export function tactileDetailFor(quality: string, reducedEffects = false): TactileDetail {
  return !reducedEffects && (quality === "high" || quality === "cinematic") ? "relief" : "base";
}

const SURFACE_COORDINATES = `
  vec3 p = vStoryPosition;
  vec3 storyAxis = abs(vStoryNormal);
  // Local face coordinates: hanging XY cloth must not sample a constant Z axis.
  vec2 storyPlane = storyAxis.z >= max(storyAxis.x, storyAxis.y) ? p.xy
    : storyAxis.y >= storyAxis.x ? p.xz : p.zy;
`;
const SURFACE_NOISE = `
  float storyHash(vec3 p) {
    p = fract(p * .1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }
  float storyNoise(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(storyHash(i), storyHash(i + vec3(1,0,0)), f.x),
                   mix(storyHash(i + vec3(0,1,0)), storyHash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(storyHash(i + vec3(0,0,1)), storyHash(i + vec3(1,0,1)), f.x),
                   mix(storyHash(i + vec3(0,1,1)), storyHash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
`;

/** Low-cost broad structure. No normal derivatives, pores or fine weave. */
export const TACTILE_BASE_PATTERNS: Record<StorySurface, string> = {
  wood: `float broad = sin(storyPlane.x * 35.0 + sin(storyPlane.y * 5.0) * .8);
    float grain = .96 + broad * .045 * (1.0 - smoothstep(.3, 1.3, fwidth(storyPlane.x * 35.0)));`,
  bark: `float ridge = sin((p.x + p.z * .67) * 24.0 + sin(p.y * 5.0));
    float grain = .94 + ridge * .07 * (1.0 - smoothstep(.3, 1.3, fwidth((p.x + p.z * .67) * 24.0)));`,
  stone: `float mineral = storyNoise(p * 4.0);
    float grain = .88 + mineral * .22;`,
  earth: `float soil = storyNoise(p * 1.8);
    float grain = .87 + soil * .24;`,
  linen: `float grain = .97;`,
  paper: `float grain = .98;`,
  wax: `float grain = .99 + sin(p.y * 16.0) * .01;`,
  metal: `float grain = .99;`,
  "wet-wood": `float wet = storyNoise(p * 2.4); float grain = .76 + wet * .17;`,
  "charred-wood": `float charcoal = storyNoise(p * 5.0); float grain = .82 + charcoal * .24;`,
  "painted-wood": `float wear = smoothstep(.57, .79, storyNoise(p * 3.8)); float grain = .98 - wear * .18;`,
  plaster: `float trowel = storyNoise(p * 2.7); float grain = .95 + (trowel - .5) * .13;`,
  velvet: `float nap = sin(storyPlane.y * 7.0 + storyNoise(p * 3.0)); float grain = .93 + nap * .045;`,
  ash: `float soot = storyNoise(p * 4.0); float grain = .88 + soot * .17;`,
  moss: `float cushion = storyNoise(p * 4.7); float grain = .86 + cushion * .23;`,
};

/** Analytic height and a separate antialiasing filter; no displaced geometry. */
export const TACTILE_PATTERNS: Record<StorySurface, string> = {
  wood: `float bend = sin(storyPlane.y * 5.0) * .02;
    float broad = sin((storyPlane.x + bend) * 35.0);
    float fine = sin((storyPlane.x + bend) * 190.0 + sin(storyPlane.y * 19.0) * 1.8);
    float detail = 1.0 - smoothstep(.12, .65, fwidth((storyPlane.x + bend) * 190.0));
    float worn = storyNoise(p * 6.0) - .5;
    float grain = .96 + broad * .045 + fine * .03 * detail + worn * .04;
    float storyHeight = (broad * .7 + worn * .3) * .0012;
    float storyReliefFilter = 1.0 - smoothstep(.4, 1.6, fwidth((storyPlane.x + bend) * 35.0));`,
  bark: `float flow = (p.x + p.z * .67) * 24.0 + sin(p.y * 5.0);
    float filtered = 1.0 - smoothstep(.35, 1.5, fwidth(flow));
    float ridges = sin(flow);
    float fissure = smoothstep(.6, .96, ridges) * filtered;
    float fleck = storyNoise(p * 14.0) - .5;
    float grain = .98 + ridges * .045 * filtered - fissure * .12 + fleck * .045 * filtered;
    float storyHeight = ridges * .004 - smoothstep(.6, .96, ridges) * .004;
    float storyReliefFilter = filtered;`,
  stone: `float mineral = storyNoise(p * 4.0);
    float filterPores = 1.0 - smoothstep(.2, 1.1, max(fwidth(p.x * 140.0), fwidth(p.y * 140.0) + fwidth(p.z * 140.0)));
    float pores = sin(p.x * 140.0 + p.y * 83.0) * sin(p.z * 127.0 - p.y * 73.0);
    float grain = .88 + mineral * .22 + pores * .018 * filterPores;
    float storyHeight = mineral * .006;
    float storyReliefFilter = 1.0 - smoothstep(.25, 1.2, length(fwidth(p * 4.0)));`,
  earth: `float soil = storyNoise(p * 1.8);
    float fragments = storyNoise(p * 24.0);
    float filterFragments = 1.0 - smoothstep(.2, 1.2, length(fwidth(p * 24.0)));
    float grain = .87 + soil * .24 + (fragments - .5) * .055 * filterFragments;
    float storyHeight = soil * .008 + fragments * .001;
    float storyReliefFilter = 1.0 - smoothstep(.25, 1.2, length(fwidth(p * 8.0)));`,
  linen: `float warp = sin(storyPlane.x * 650.0), weft = sin(storyPlane.y * 650.0);
    float detail = 1.0 - smoothstep(.25, 1.3, max(fwidth(storyPlane.x * 650.0), fwidth(storyPlane.y * 650.0)));
    float grain = .97 + warp * weft * .032 * detail;
    float storyHeight = warp * weft * .000025;
    float storyReliefFilter = detail;`,
  paper: `float fiber = sin(storyPlane.x * 620.0 + sin(storyPlane.y * 38.0)) * sin(storyPlane.y * 850.0);
    float detail = 1.0 - smoothstep(.25, 1.3, max(fwidth(storyPlane.x * 620.0), fwidth(storyPlane.y * 850.0)));
    float grain = .98 + fiber * .02 * detail;
    float storyHeight = fiber * .000006;
    float storyReliefFilter = detail;`,
  wax: `float drip = sin((p.x + p.z) * 57.0 + sin(p.y * 11.0));
    float detail = 1.0 - smoothstep(.3, 1.3, length(fwidth(p * 57.0)));
    float grain = .99 + sin(p.y * 16.0) * .01 + drip * .012 * detail;
    float storyHeight = drip * .0005;
    float storyReliefFilter = detail;`,
  metal: `float scratch = sin(storyPlane.x * 510.0 + sin(storyPlane.y * 7.0));
    float detail = 1.0 - smoothstep(.3, 1.3, fwidth(storyPlane.x * 510.0));
    float grain = .99 + scratch * .012 * detail;
    float storyHeight = scratch * .000003;
    float storyReliefFilter = detail;`,
  "wet-wood": `float wet = storyNoise(p * 2.4);
    float channel = sin(storyPlane.x * 38.0 + sin(storyPlane.y * 4.0));
    float grain = .82 + wet * .12 + channel * .012;
    float storyHeight = channel * .00012;
    float storyReliefFilter = 1.0 - smoothstep(.3, 1.3, fwidth(storyPlane.x * 38.0));`,
  "charred-wood": `float charcoal = storyNoise(p * 5.0);
    float split = pow(abs(sin(storyPlane.x * 48.0 + storyNoise(p * 7.0))), 12.0);
    float grain = .82 + charcoal * .24 - split * .08;
    float storyHeight = charcoal * .004 - split * .003;
    float storyReliefFilter = 1.0 - smoothstep(.2, 1.1, length(fwidth(p * 48.0)));`,
  "painted-wood": `float wear = smoothstep(.57, .79, storyNoise(p * 3.8));
    float grain = .98 - wear * .18;
    float storyHeight = (1.0 - wear) * .0015 + sin(storyPlane.x * 35.0) * .0002;
    float storyReliefFilter = 1.0 - smoothstep(.25, 1.2, length(fwidth(p * 12.0)));`,
  plaster: `float trowel = storyNoise(p * 2.7);
    float aggregate = storyNoise(p * 42.0);
    float grain = .95 + (trowel - .5) * .13;
    float storyHeight = trowel * .002 + aggregate * .0003;
    float storyReliefFilter = 1.0 - smoothstep(.25, 1.1, length(fwidth(p * 42.0)));`,
  velvet: `float nap = sin(storyPlane.y * 7.0 + storyNoise(p * 3.0));
    float grain = .93 + nap * .045;
    float storyHeight = sin(storyPlane.x * 580.0) * sin(storyPlane.y * 590.0) * .000012;
    float storyReliefFilter = 1.0 - smoothstep(.25, 1.3, length(fwidth(storyPlane * 590.0)));`,
  ash: `float soot = storyNoise(p * 4.0);
    float grain = .88 + soot * .17;
    float storyHeight = soot * .0012 + storyNoise(p * 60.0) * .0003;
    float storyReliefFilter = 1.0 - smoothstep(.25, 1.2, length(fwidth(p * 60.0)));`,
  moss: `float cushion = storyNoise(p * 4.7);
    float grain = .86 + cushion * .23;
    float storyHeight = cushion * .006 + storyNoise(p * 34.0) * .001;
    float storyReliefFilter = 1.0 - smoothstep(.25, 1.2, length(fwidth(p * 34.0)));`,
};

/** Surface identity includes broad roughness variation even on low quality. */
export const TACTILE_ROUGHNESS: Partial<Record<StorySurface, string>> = {
  "wet-wood": "roughnessFactor = clamp(roughnessFactor * (.87 + wet * .1), .7, .9);",
  "charred-wood": "roughnessFactor = clamp(roughnessFactor + .09 + charcoal * .06, .88, 1.0);",
  "painted-wood": "roughnessFactor = clamp(roughnessFactor * .77 + wear * .22, .35, .99);",
  plaster: "roughnessFactor = clamp(roughnessFactor + trowel * .04, .88, 1.0);",
  velvet: "roughnessFactor = clamp(roughnessFactor + .05 - nap * .035, .8, 1.0);",
  ash: "roughnessFactor = clamp(roughnessFactor + .1, .96, 1.0);",
  moss: "roughnessFactor = clamp(roughnessFactor + .06, .9, 1.0);",
};

export const TACTILE_RELIEF_NORMAL = `
  vec3 storyDx = dFdx(-vViewPosition);
  vec3 storyDy = dFdy(-vViewPosition);
  vec3 storyRx = cross(storyDy, normal);
  vec3 storyRy = cross(normal, storyDx);
  float storyDet = dot(storyDx, storyRx) * faceDirection;
  vec3 storyGradient = sign(storyDet) *
    (dFdx(storyHeight) * storyRx + dFdy(storyHeight) * storyRy) / max(abs(storyDet), 1e-8);
  storyGradient -= normal * dot(normal, storyGradient);
  float storyFade = storyReliefFilter * (1.0 - smoothstep(20.0, 48.0, length(vViewPosition)));
  storyGradient *= storyFade * min(1.0, .24 / max(length(storyGradient), 1e-6));
  normal = normalize(normal - storyGradient);
`;

export function tactileProgramKey(surface: StorySurface, detail: TactileDetail) {
  return `sidtw-tactile-${surface}-v5-${detail}`;
}

/** Extend the standard light/shadow/fog/colour pipeline, never replace it. */
export function applyTactileShader(shader: TactileShader, surface: StorySurface, detail: TactileDetail) {
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", "#include <common>\nvarying vec3 vStoryPosition;\nvarying vec3 vStoryNormal;")
    .replace("#include <begin_vertex>", `#include <begin_vertex>
      vStoryPosition = position;
      vStoryNormal = normal;
      #ifdef USE_INSTANCING
        // Local scale keeps grain size consistent across differently sized instances.
        // Translation seeds variation; rotating the camera or object does not slide it.
        vStoryPosition *= vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
        float storySeed = fract(sin(dot(instanceMatrix[3].xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        vStoryPosition += vec3(storySeed * 17.0, storySeed * 3.0, storySeed * 13.0);
      #endif`);
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", `#include <common>\nvarying vec3 vStoryPosition;\nvarying vec3 vStoryNormal;\n${SURFACE_NOISE}`)
    .replace("#include <color_fragment>", `#include <color_fragment>\n${SURFACE_COORDINATES}\n${detail === "relief" ? TACTILE_PATTERNS[surface] : TACTILE_BASE_PATTERNS[surface]}\ndiffuseColor.rgb *= grain;`)
    .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>\n${TACTILE_ROUGHNESS[surface] ?? "roughnessFactor = clamp(roughnessFactor + (1.0 - grain) * .24, .08, 1.0);"}`);
  if (detail === "relief") shader.fragmentShader = shader.fragmentShader
    .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>\n${TACTILE_RELIEF_NORMAL}`);
  return shader;
}
