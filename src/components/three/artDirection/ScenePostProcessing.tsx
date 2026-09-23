import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { DepthTexture, HalfFloatType, ShaderMaterial, UnsignedByteType, UnsignedIntType, Vector2, WebGLRenderTarget } from "three";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";
import { useSceneLook } from "./SceneLookContext";

// One scene render and one finishing triangle. No global SSR, bloom pyramid,
// normal prepass, temporal history or camera jitter. AO is deliberately local.
export const FINISH_FRAGMENT = /* glsl */ `
  uniform sampler2D beauty, depthMap;
  uniform vec2 resolution;
  uniform float cameraNear, cameraFar, contrast, saturation, vignette, bloom, grain;
  varying vec2 vUv;
  #include <packing>
  float linearDepth(vec2 uv) { return -perspectiveDepthToViewZ(texture2D(depthMap,uv).x,cameraNear,cameraFar); }
  vec3 highlight(vec3 c) { float l=dot(c,vec3(.2126,.7152,.0722));return c*smoothstep(1.7,3.5,l); }
  void main() {
    vec3 color=texture2D(beauty,vUv).rgb;
    float centre=linearDepth(vUv),occlusion=0.;vec3 glow=vec3(0.);
    for(int i=0;i<8;i++) {
      float angle=float(i)*.7853981634;
      vec2 axis=vec2(cos(angle),sin(angle));
      vec2 uv=clamp(vUv+axis*4./resolution,vec2(.001),vec2(.999));
      float difference=centre-linearDepth(uv);
      occlusion+=smoothstep(.015,.06,difference)*(1.-smoothstep(.08,.38,difference));
      glow+=highlight(texture2D(beauty,clamp(vUv+axis*6./resolution,vec2(.001),vec2(.999))).rgb);
    }
    // Only close contacts, with a maximum 11% attenuation; the sky stays clean.
    float contact=centre<min(cameraFar*.98,45.)?occlusion*.01375:0.;
    color=color*(1.-contact)+glow*(bloom/8.);
    float luminance=dot(color,vec3(.2126,.7152,.0722));
    color=mix(vec3(luminance),color,saturation);
    // Contrast around middle grey without subtracting away the dark forest,
    // timber and mirror detail that carries these scenes.
    color=.18*pow(max(color/ .18,vec3(0.)),vec3(contrast));
    vec2 edge=(vUv-.5)*2.;
    color*=1.-vignette*smoothstep(.35,1.45,dot(edge,edge));
    gl_FragColor=vec4(color,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    // Static sub-code-value dither, never animated noise or a flickering overlay.
    float noise=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-.5;
    gl_FragColor.rgb+=noise*grain;
  }
`;

export function ScenePostProcessing({ bloomIntensity, vignetteIntensity }: { bloomIntensity: number; vignetteIntensity: number }) {
  const presentation = useSceneLook()!;
  const { gl, size } = useThree();
  const resources = useMemo(() => {
    const hdr = gl.extensions.has("EXT_color_buffer_float");
    const target = new WebGLRenderTarget(1, 1, { type: hdr ? HalfFloatType : UnsignedByteType, samples: Math.min(4, gl.capabilities.maxSamples), depthBuffer: true });
    target.texture.name = "cinematic-bounded-beauty";
    target.depthTexture = new DepthTexture(1, 1, UnsignedIntType);
    const material = new ShaderMaterial({ depthTest: false, depthWrite: false, uniforms: {
      beauty: { value: target.texture }, depthMap: { value: target.depthTexture }, resolution: { value: new Vector2(1, 1) },
      cameraNear: { value: .05 }, cameraFar: { value: 200 }, contrast: { value: 1 }, saturation: { value: 1 },
      vignette: { value: 0 }, bloom: { value: 0 }, grain: { value: 0 },
    }, vertexShader: "varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}", fragmentShader: FINISH_FRAGMENT });
    return { target, material, quad: new FullScreenQuad(material), hdr };
  }, [gl]);
  useEffect(() => () => { resources.target.depthTexture?.dispose(); resources.target.dispose(); resources.material.dispose(); resources.quad.dispose(); }, [resources]);
  useFrame(({ scene, camera }) => {
    const { look } = presentation, { target, material, quad } = resources;
    const scale = Math.min(gl.getPixelRatio(), look.budget.finishingMaxDimension / Math.max(size.width, size.height));
    const w = Math.max(1, Math.round(size.width * scale)), h = Math.max(1, Math.round(size.height * scale));
    if (target.width !== w || target.height !== h) target.setSize(w, h);
    const u = material.uniforms;
    u.resolution.value.set(w, h);
    if ("near" in camera) { u.cameraNear.value = camera.near; u.cameraFar.value = camera.far; }
    u.contrast.value = look.grade.contrast; u.saturation.value = look.grade.saturation;
    u.vignette.value = Math.min(.14, vignetteIntensity * .6 + look.grade.vignette * .4);
    u.bloom.value = resources.hdr ? Math.min(.16, bloomIntensity * .12) : 0;
    u.grain.value = look.grade.grain;
    const previous = gl.getRenderTarget(), autoReset = gl.info.autoReset;
    gl.info.autoReset = false; gl.info.reset();
    try {
      gl.setRenderTarget(target); gl.clear(); gl.render(scene, camera);
      gl.setRenderTarget(previous); quad.render(gl);
    } finally { gl.setRenderTarget(previous); gl.info.autoReset = autoReset; }
  }, 1);
  return null;
}
