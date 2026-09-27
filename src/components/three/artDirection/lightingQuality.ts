/** A single non-shadowing return is cheaper than adding many local lights.
 * Medium gains a restrained fill; low/reduced-effects retain the original rig. */
export function skyReturnStrength(quality: string, reducedEffects: boolean) {
  if (reducedEffects) return 0;
  if (quality === "medium") return .55;
  return quality === "high" || quality === "cinematic" ? 1 : 0;
}
