/** A lost drawing buffer is an event, not a React render exception.
 * Observe the actual canvas and notify its owner once. Removing the listener
 * before renderer teardown prevents normal disposal from opening recovery. */
export function observeWebGLContextLoss(
  canvas: EventTarget,
  onLost: () => void,
  isContextLost: () => boolean = () => false,
): () => void {
  let active = true;
  let notified = false;
  const handleLoss = (event?: Event) => {
    if (!active) return;
    event?.preventDefault();
    if (notified) return;
    notified = true;
    onLost();
  };
  const cleanup = () => {
    if (!active) return;
    active = false;
    canvas.removeEventListener("webglcontextlost", handleLoss);
  };
  canvas.addEventListener("webglcontextlost", handleLoss);
  try {
    // The context may already have been lost while React was mounting.
    if (isContextLost()) handleLoss();
  } catch (error) {
    cleanup();
    throw error;
  }
  return cleanup;
}


/** GPU loss is synchronous, whereas React's unmount is not.
 * Stop Three's own animation callback and R3F's frameloop immediately so a
 * queued frame never compiles shaders against a lost WebGL context.
 */
export function pauseLostWebGLRenderer(
  renderer: { setAnimationLoop: (callback: null) => void },
  setFrameloop: (mode: "never") => void,
  onLost: () => void,
) {
  try {
    // Renderer teardown can itself be underway when the browser sends loss.
    renderer.setAnimationLoop(null);
  } catch {
    // The R3F state and recovery UI still need to be paused and mounted.
  }
  setFrameloop("never");
  onLost();
}
