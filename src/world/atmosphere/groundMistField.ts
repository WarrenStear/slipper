export type MistPatch = readonly [x: number, y: number, z: number, sx: number, sy: number, sz: number];
const WOOD: readonly MistPatch[] = [[-8, .27, 10, 6, .4, 3.4], [8, .3, 12, 5, .48, 4], [-1, .18, 17, 8, .32, 3]];
const SHORE: readonly MistPatch[] = [[-8.4, .15, 4, 2.4, .3, 5.5], [8.8, .2, 6, 2.1, .35, 4.2]];
const RIVER: readonly MistPatch[] = [[8, .17, 7, 3.5, .3, 6], [10, .15, 14, 4, .3, 5]];
const EMPTY: readonly MistPatch[] = [];
/** The original patch placements are unchanged; only their draw submission changes. */
export function groundMistPatches(id: string): readonly MistPatch[] {
  return id.startsWith("enchanted.") ? WOOD : id.startsWith("blue-moon.") ? SHORE : id.startsWith("river.") ? RIVER : EMPTY;
}
export const GROUND_MIST_VERTEX = `
  varying vec3 local, viewNormal, viewPosition;
  varying float patchPhase;
  void main() {
    local = position;
    // Instances contain translation and positive scale only. Correct the normal
    // for flattened volumes instead of transforming it like a position.
    vec3 instanceScale = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
    vec4 v = modelViewMatrix * instanceMatrix * vec4(position, 1.);
    viewPosition = -v.xyz;
    viewNormal = normalize(normalMatrix * (normal / max(instanceScale, vec3(.0001))));
    patchPhase = dot(instanceMatrix[3].xz, vec2(.137, .219));
    gl_Position = projectionMatrix * v;
  }
`;
export const GROUND_MIST_FRAGMENT = `
  uniform vec3 tint;
  uniform float time, opacity, fogDensity;
  varying vec3 local, viewNormal, viewPosition;
  varying float patchPhase;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
    return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);
  }
  void main() {
    // Fade into the same exponential fog as the opaque scene. Negligible
    // contributions exit before normalisation and the two noise octaves.
    float nearby=smoothstep(.8,3.,length(viewPosition));
    float depth = max(0., viewPosition.z);
    float fogFade = exp(-fogDensity * fogDensity * depth * depth);
    float visibility = opacity * nearby * fogFade;
    if (visibility <= .0005) discard;
    float edge = pow(max(0.,dot(normalize(viewNormal),normalize(viewPosition))),1.8);
    vec2 drift = vec2(time*.018,-time*.012) + vec2(patchPhase, -patchPhase*.7);
    float billow = noise(local.xz*2.3+drift)*.65 + noise(local.xz*5.1-drift*.7)*.35;
    float breakup = smoothstep(.16,.78,billow);
    float base = smoothstep(-1.,-.35,local.y)*(1.-smoothstep(.2,1.,local.y));
    gl_FragColor = vec4(tint,visibility*edge*base*breakup);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
