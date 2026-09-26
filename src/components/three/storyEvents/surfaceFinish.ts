/** Authored albedo/roughness variation. Uses the existing local metre coordinates;
 * no downloads, displacement, new lights, or extra renderer passes. */
export function authoredSurfaceFinish(surface: string, relief: boolean, constructionCoordinates = false): string {
  const init = "float authoredRoughness = 0.;\n";
  if (["wood", "wet-wood", "painted-wood"].includes(surface)) return init + `
    // Long fibres divert around occasional oval knots, rather than zebra stripes.
    vec2 timberCell = floor(storyPlane / vec2(.7, 2.7));
    float timberSeed = storyHash(vec3(timberCell, 9.4));
    vec2 knotOffset = fract(storyPlane / vec2(.7, 2.7)) - vec2(.3 + timberSeed * .35, .48);
    float knotDistance = length(knotOffset * vec2(2.8, .95));
    float knotMask = (1. - smoothstep(.05, .34, knotDistance)) * step(.67, timberSeed);
    float timberFlow = storyPlane.x * 71. + sin(storyPlane.y * 2.3) * .8 + knotMask * 4.6;
    float timberFilter = 1. - smoothstep(.4, 1.7, fwidth(timberFlow));
    float timberFibre = sin(timberFlow) * .5 + .5;
    float timberAge = storyNoise(vec3(storyPlane.x * 2.6, storyPlane.y * .34, 7.1));
    diffuseColor.rgb *= .91 + timberAge * .16 - knotMask * .19;
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(.86, .79, .68), timberFibre * timberFilter * .16);
    authoredRoughness = (timberAge - .5) * .11 + knotMask * .055;
    ${constructionCoordinates ? `
      // A cut end exposes compact growth rings; long fibres follow each board.
      float cutEnd = smoothstep(.72, .96, abs(vStoryNormal.y));
      float endRadius = length(p.xz + vec2(.045, .073));
      float endFlow = endRadius * 145. + storyNoise(p * 7.) * 1.4;
      float endFilter = 1. - smoothstep(.4, 1.6, fwidth(endFlow));
      float endRings = (.5 + .5 * sin(endFlow)) * endFilter;
      diffuseColor.rgb *= 1. - cutEnd * (.08 + endRings * .16);
      authoredRoughness += cutEnd * .06;
    ` : ""}
  `;
  if (surface === "bark") return init + `
    float barkAge = storyNoise(vec3(p.x * 2.3, p.y * .46, p.z * 2.3));
    float barkScale = storyNoise(p * vec3(12., 2.6, 12.));
    float barkSeam = smoothstep(.58, .83, barkScale);
    float lichen = smoothstep(.64, .84, barkAge) * (1. - barkSeam);
    diffuseColor.rgb *= .91 + barkAge * .19 - barkSeam * .16;
    // Desaturated lichen lives on the lit bark; it is not emissive green paint.
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.1, 1.16, .9), lichen * .36);
    authoredRoughness = barkSeam * .035 + lichen * .035;
  `;
  if (surface === "earth" || surface === "moss" || surface === "ash") return init + `
    float soilBed = storyNoise(p * .48);
    float soilClod = storyNoise(p * 8.3);
    float soilCrevice = smoothstep(.63, .84, soilClod);
    diffuseColor.rgb *= .91 + soilBed * .18 - soilCrevice * .085;
    authoredRoughness = (soilBed - .5) * .09 + soilCrevice * .025;
  `;
  if (surface === "stone" || surface === "plaster") return init + `
    float mineralAge = storyNoise(p * .63);
    float mineralLayers = storyNoise(p * vec3(2.4, 7.8, 2.4));
    float mineralStain = smoothstep(.6, .82, mineralAge);
    diffuseColor.rgb *= .95 + mineralLayers * .07 - mineralStain * .095;
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.045, 1., .91), mineralStain * .35);
    authoredRoughness = mineralStain * .04;
  `;
  if (surface === "metal") return init + `
    float patina = smoothstep(.48, .8, storyNoise(p * 5.7));
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(.63, .73, .66), patina * .45);
    authoredRoughness = patina * .15;
  `;
  if ((surface === "linen" || surface === "velvet") && relief) return init + `
    float clothSlub = storyNoise(vec3(storyPlane.x * 27., storyPlane.y * 2.1, 4.1));
    diffuseColor.rgb *= .965 + clothSlub * .06;
    authoredRoughness = (clothSlub - .5) * .035;
  `;
  return init;
}
