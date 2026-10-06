/** The live surface settles even while its bounded capture is skipped/offscreen. */
export function heroReflectionDisturbance(kind: "mirror" | "moonwater", waterMotion: number, stillness: number) {
  return waterMotion === 0 ? 0 : (kind === "mirror" ? .004 : .0015) * (1 - stillness);
}
