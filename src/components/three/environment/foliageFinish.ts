import type { TactileShader } from "../storyEvents/tactileShader.ts";

/** A leaf-mass finish, not transparent shells or an additional lighting owner.
 * Coordinates already supplied by the shared tactile shader stay object-anchored. */
export function applyFoliageFinish(shader: TactileShader, relief: boolean) {
  shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
    float foliageClump = storyNoise(vStoryPosition * 3.7);
    float foliageUnderside = smoothstep(-.48, .65, vStoryNormal.y);
    float foliageBreakup = ${relief ? 'storyNoise(vStoryPosition * 18. + vec3(1.7, 0., 3.1))' : 'foliageClump'};
    float foliageDetail = 1. - smoothstep(.3, 1.4, length(fwidth(vStoryPosition * 18.)));
    diffuseColor.rgb *= .83 + foliageClump * .21 + foliageUnderside * .09;
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(.89, 1.04, .78), foliageClump * .3);
    diffuseColor.rgb *= 1. - smoothstep(.64, .83, foliageBreakup) * foliageDetail * .14;
  `);
  return shader;
}
