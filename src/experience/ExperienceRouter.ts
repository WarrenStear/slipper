/** Capability routing is independent of the world and persisted story state. */
export function requiresAccessibleJourney() {
  if (typeof window === "undefined" || typeof document === "undefined") return true;

  const params = new URLSearchParams(window.location.search);
  if (params.get("accessible") === "1") return true;

  try {
    const canvas = document.createElement("canvas");
    // Three.js r171 requires WebGL2. Release this probe before the real scene
    // allocates a context, including StrictMode's repeated initialization.
    const context = canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true });
    context?.getExtension("WEBGL_lose_context")?.loseContext();
    return !context;
  } catch {
    return true;
  }
}
