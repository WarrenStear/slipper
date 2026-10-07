import { Color, FogExp2, HalfFloatType, UnsignedByteType, Scene, WebGLRenderTarget,
  type Camera, type Group, type Mesh, type WebGLRenderer } from 'three';

/** One existing private scene/target; resolution is supplied by SceneLook. */
export function createUnderfloorCaptureResources(resolution: number) {
  const scene = new Scene(); scene.background = new Color('#081216'); scene.fog = new FogExp2('#101e23', .042);
  const target = new WebGLRenderTarget(resolution, resolution, { type: HalfFloatType, depthBuffer: true });
  target.texture.name = 'bounded-underfloor-world';
  return { scene, target };
}
export type UnderfloorCaptureResources = ReturnType<typeof createUnderfloorCaptureResources>;

/** Apply the original physical parent transform and renderer restoration.
 * The target owns its storage; source/material textures remain borrowed. */
export function captureUnderfloorFrame(gl: WebGLRenderer, camera: Camera,
  resources: UnderfloorCaptureResources, root: Group, surface: Mesh, valid: { current: boolean }) {
  surface.parent?.updateWorldMatrix(true, false);
  root.matrix.copy(surface.parent?.matrixWorld ?? surface.matrixWorld);
  root.matrixWorldNeedsUpdate = true;
  if (!gl.extensions.has('EXT_color_buffer_float')) resources.target.texture.type = UnsignedByteType;
  const previous = gl.getRenderTarget(), xr = gl.xr.enabled, shadows = gl.shadowMap.autoUpdate;
  try {
    gl.xr.enabled = false; gl.shadowMap.autoUpdate = false; gl.setRenderTarget(resources.target); gl.clear();
    gl.render(resources.scene, camera); valid.current = true;
  } finally {
    gl.setRenderTarget(previous); gl.xr.enabled = xr; gl.shadowMap.autoUpdate = shadows;
  }
}
