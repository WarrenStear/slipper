import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, PerspectiveCamera, PlaneGeometry, ShaderMaterial, UnsignedByteType, type WebGLRenderer } from "three";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { useSceneLook } from "../artDirection/SceneLookContext";
import { heroReflectionDisturbance } from "./reflectionMotion";

const capturing = new WeakSet<WebGLRenderer>();
/** Exactly one eligible hero surface per scene; lower tiers keep their skin. */
export function HeroReflectionSurface({ kind, size, position = [0, 0, 0], rotation = [0, 0, 0] }: {
  kind: "moonwater" | "mirror"; size: [number, number]; position?: [number, number, number]; rotation?: [number, number, number];
}) {
  const presentation = useSceneLook();
  const allowed = presentation && presentation.look.reflection.mode === kind && presentation.look.budget.reflectionSize > 0;
  return allowed ? <CapturedSurface kind={kind} size={size} position={position} rotation={rotation} /> : null;
}

function CapturedSurface({ kind, size, position, rotation }: Required<Parameters<typeof HeroReflectionSurface>[0]>) {
  const presentation = useSceneLook()!;
  const current = useRef(presentation);
  current.current = presentation;
  const frame = useRef(0), capturedFrame = useRef(-100);
  const resources = useMemo(() => {
    const geometry = new PlaneGeometry(size[0], size[1]);
    const mirror = new Reflector(geometry, { textureWidth: presentation.look.budget.reflectionSize, textureHeight: presentation.look.budget.reflectionSize, multisample: 0, clipBias: .003 });
    mirror.name = `hero-reflection:${kind}`;
    const material = mirror.material as ShaderMaterial;
    material.uniforms.uTime = { value: 0 }; material.uniforms.uDisturbance = { value: 0 };
    material.uniforms.uClarity = { value: 0 };
    material.uniforms.uWater = { value: kind === "moonwater" ? 1 : 0 };
    material.uniforms.color.value = new Color(kind === "moonwater" ? "#07131b" : "#202c31");
    material.vertexShader = material.vertexShader.replace("varying vec4 vUv;", "varying vec4 vUv;varying vec3 vSurfaceView;varying vec3 vSurfaceNormal;").replace("vUv = textureMatrix", "vSurfaceView=-(modelViewMatrix*vec4(position,1.)).xyz;vSurfaceNormal=normalMatrix*normal;vUv = textureMatrix");
    material.fragmentShader = `uniform vec3 color;uniform sampler2D tDiffuse;uniform float uTime,uDisturbance,uWater,uClarity;varying vec4 vUv;varying vec3 vSurfaceView;varying vec3 vSurfaceNormal;
      void main(){vec4 uv=vUv;uv.xy+=vec2(sin(uv.y*32.+uTime),cos(uv.x*27.-uTime*.7))*uDisturbance*uv.w;
      vec3 reflected=texture2DProj(tDiffuse,uv).rgb;
      float grazing=pow(1.-abs(dot(normalize(vSurfaceNormal),normalize(vSurfaceView))),3.);
      float reflectance=uWater>.5?mix(.14,.78,grazing):mix(.74,.92,uClarity);
      gl_FragColor=vec4(mix(color,reflected,reflectance),1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`;
    const render = mirror.onBeforeRender.bind(mirror);
    const camera = new PerspectiveCamera();
    mirror.onBeforeRender = (renderer, scene, sourceCamera, ...rest) => {
      const presentation = current.current;
      if (capturing.has(renderer) || frame.current - capturedFrame.current < presentation.look.budget.reflectionEveryFrames || document.hidden) return;
      if (sourceCamera.position.distanceToSquared(mirror.getWorldPosition(camera.position)) > 48 * 48) return;
      // Only perspective world cameras participate; never recurse from a shadow view.
      if (!(sourceCamera instanceof PerspectiveCamera)) return;
      camera.copy(sourceCamera); camera.far = Math.min(sourceCamera.far, presentation.look.budget.reflectionFar); camera.updateProjectionMatrix();
      if (!renderer.extensions.has("EXT_color_buffer_float")) mirror.getRenderTarget().texture.type = UnsignedByteType;
      const previousTarget = renderer.getRenderTarget(), xr = renderer.xr.enabled, shadows = renderer.shadowMap.autoUpdate;
      capturing.add(renderer);
      try { render(renderer, scene, camera, ...rest); capturedFrame.current = frame.current; }
      finally { capturing.delete(renderer); mirror.visible = true; renderer.setRenderTarget(previousTarget); renderer.xr.enabled = xr; renderer.shadowMap.autoUpdate = shadows; }
    };
    // R3F applies dispose={null} to the primitive itself. Retain the original
    // disposer before mounting so our owned target and material still release.
    return { mirror, geometry, dispose: mirror.dispose.bind(mirror) };
  }, [kind, size[0], size[1], presentation.look.budget.reflectionSize]);
  useEffect(() => () => { resources.dispose(); resources.geometry.dispose(); }, [resources]);
  useFrame(() => {
    frame.current++;
    // Surface animation consumes the shared frame independently of capture
    // cadence or visibility. Returning to a settled mirror cannot show a stale
    // disturbance, and skipped captures never own a second motion clock.
    const presentation = current.current;
    const material = resources.mirror.material as ShaderMaterial;
    material.uniforms.uTime.value = presentation.time.water;
    material.uniforms.uClarity.value = Math.min(1, Math.max(0, presentation.stillness));
    material.uniforms.uDisturbance.value = heroReflectionDisturbance(kind, presentation.motion.water, presentation.stillness);
  }, -2);
  return <primitive object={resources.mirror} position={position} rotation={rotation} dispose={null} userData={{ secondaryView: true, resolution: presentation.look.budget.reflectionSize, maxCaptures: 1 }} />;
}
