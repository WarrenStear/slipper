import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { DepthTexture, HalfFloatType, ShaderMaterial, UnsignedByteType, UnsignedIntType, Vector2, WebGLRenderTarget } from "three";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";
import { useSceneLook } from "./SceneLookContext";

const VERTEX = "varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}";
// Threshold BEFORE blur so ordinary surfaces and fog cannot bleed into bloom.
const BRIGHT = `uniform sampler2D inputMap;uniform vec2 stepSize;varying vec2 vUv;
vec3 bright(vec2 uv){vec3 c=texture2D(inputMap,uv).rgb;float l=dot(c,vec3(.2126,.7152,.0722));return min(c,vec3(12.))*smoothstep(1.8,3.8,l);}
void main(){gl_FragColor=vec4((bright(vUv+stepSize)+bright(vUv-stepSize)+bright(vUv+stepSize*vec2(1.,-1.))+bright(vUv+stepSize*vec2(-1.,1.)))*.25,1.);}`;
const BLUR = `uniform sampler2D inputMap;uniform vec2 stepSize;varying vec2 vUv;
void main(){vec3 c=texture2D(inputMap,vUv).rgb*.227027;c+=(texture2D(inputMap,vUv+stepSize*1.384615).rgb+texture2D(inputMap,vUv-stepSize*1.384615).rgb)*.316216;c+=(texture2D(inputMap,vUv+stepSize*3.230769).rgb+texture2D(inputMap,vUv-stepSize*3.230769).rgb)*.070270;gl_FragColor=vec4(c,1.);}`;

export const FINISH_FRAGMENT = /* glsl */ `
  uniform sampler2D beauty, depthMap, bloomHalf, bloomQuarter;
  uniform vec2 resolution;
  uniform float cameraNear, cameraFar, contrast, saturation, vignette, bloom, grain;
  varying vec2 vUv;
  #include <packing>
  float linearDepth(vec2 uv) { return -perspectiveDepthToViewZ(texture2D(depthMap,uv).x,cameraNear,cameraFar); }
  float luma(vec3 c){return sqrt(max(0.,dot(c,vec3(.299,.587,.114))));}
  vec3 edgeSmooth(){
    vec2 px=1./resolution;vec3 c=texture2D(beauty,vUv).rgb;
    float nw=luma(texture2D(beauty,vUv+px*vec2(-1.,-1.)).rgb),ne=luma(texture2D(beauty,vUv+px*vec2(1.,-1.)).rgb);
    float sw=luma(texture2D(beauty,vUv+px*vec2(-1.,1.)).rgb),se=luma(texture2D(beauty,vUv+px).rgb),m=luma(c);
    float lo=min(m,min(min(nw,ne),min(sw,se))),hi=max(m,max(max(nw,ne),max(sw,se)));
    if(hi-lo<max(.025,hi*.12))return c;
    vec2 dir=vec2(-((nw+ne)-(sw+se)),(nw+sw)-(ne+se));
    float reduce=max((nw+ne+sw+se)*.03125,.0078125);
    // Limit the outer tap to one pixel. A two-pixel offset produced detached
    // bright edges on the small canonical glyphs and narrow bridge joints.
    dir=clamp(dir/(min(abs(dir.x),abs(dir.y))+reduce),vec2(-2.),vec2(2.))*px;
    vec3 a=.5*(texture2D(beauty,vUv-dir/6.).rgb+texture2D(beauty,vUv+dir/6.).rgb);
    vec3 b=a*.5+.25*(texture2D(beauty,vUv-dir*.5).rgb+texture2D(beauty,vUv+dir*.5).rgb);
    float lb=luma(b);return lb<lo||lb>hi?a:b;
  }
  void main() {
    #ifdef CINEMATIC
      vec3 color=texture2D(beauty,vUv).rgb;
      float centre=linearDepth(vUv),occlusion=0.;
      for(int i=0;i<8;i++) {
        float angle=float(i)*.7853981634;
        vec2 uv=clamp(vUv+vec2(cos(angle),sin(angle))*4./resolution,vec2(.001),vec2(.999));
        float difference=centre-linearDepth(uv);
        occlusion+=smoothstep(.015,.06,difference)*(1.-smoothstep(.08,.38,difference));
      }
      float contact=centre<min(cameraFar*.98,45.)?occlusion*.01375:0.;
      color=color*(1.-contact)+bloom*(texture2D(bloomHalf,vUv).rgb*.65+texture2D(bloomQuarter,vUv).rgb*.35);
      float luminance=dot(color,vec3(.2126,.7152,.0722));
      color=mix(vec3(luminance),color,saturation);
      color=.18*pow(max(color/.18,vec3(0.)),vec3(contrast));
      vec2 edge=(vUv-.5)*2.;color*=1.-vignette*smoothstep(.35,1.45,dot(edge,edge));
    #else
      vec3 color=edgeSmooth();
    #endif
    gl_FragColor=vec4(color,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    float noise=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-.5;
    gl_FragColor.rgb+=noise*grain;
  }
`;

/** High: one FXAA composite. Cinematic: MSAA + two bounded bloom scales + contacts.
 * No normal prepass, SSR, temporal history or camera jitter. */
export function ScenePostProcessing({ bloomIntensity, vignetteIntensity }: { bloomIntensity: number; vignetteIntensity: number }) {
  const presentation = useSceneLook()!;
  const cinematic = presentation.look.budget.finishing;
  const { gl, size } = useThree();
  const resources = useMemo(() => {
    const hdr = gl.extensions.has("EXT_color_buffer_float"), type = hdr ? HalfFloatType : UnsignedByteType;
    const target = new WebGLRenderTarget(1, 1, { type, samples: cinematic ? Math.min(4, gl.capabilities.maxSamples) : 0, depthBuffer: true });
    target.texture.name = cinematic ? "cinematic-bounded-beauty" : "high-fxaa-beauty";
    if (cinematic) target.depthTexture = new DepthTexture(1, 1, UnsignedIntType);
    const levels = cinematic && hdr ? Array.from({ length: 4 }, (_, i) => {
      const level = new WebGLRenderTarget(1, 1, { type, depthBuffer: false }); level.texture.name = `bounded-bloom-${i}`; return level;
    }) : [];
    const material = new ShaderMaterial({ defines: cinematic ? { CINEMATIC: 1 } : {}, depthTest: false, depthWrite: false, uniforms: {
      beauty: { value: target.texture }, depthMap: { value: target.depthTexture ?? target.texture },
      bloomHalf: { value: levels[0]?.texture ?? target.texture }, bloomQuarter: { value: levels[2]?.texture ?? target.texture }, resolution: { value: new Vector2(1, 1) },
      cameraNear: { value: .05 }, cameraFar: { value: 200 }, contrast: { value: 1 }, saturation: { value: 1 },
      vignette: { value: 0 }, bloom: { value: 0 }, grain: { value: 0 },
    }, vertexShader: VERTEX, fragmentShader: FINISH_FRAGMENT });
    const intermediate = (fragmentShader: string) => new ShaderMaterial({ depthTest: false, depthWrite: false, toneMapped: false, uniforms: { inputMap: { value: target.texture }, stepSize: { value: new Vector2() } }, vertexShader: VERTEX, fragmentShader });
    return { metadata: { width: 1, height: 1, bloomTargets: levels.length, samples: target.samples, method: cinematic ? "msaa-bloom-contact" : "fxaa" }, target, levels, material, bright: intermediate(BRIGHT), blur: intermediate(BLUR), quad: new FullScreenQuad(material), hdr };
  }, [gl, cinematic]);
  useEffect(() => () => {
    resources.target.depthTexture?.dispose(); resources.target.dispose(); resources.levels.forEach(t => t.dispose());
    resources.material.dispose(); resources.bright.dispose(); resources.blur.dispose(); resources.quad.dispose();
  }, [resources]);
  useFrame(({ scene, camera }) => {
    const { look } = presentation, { target, material, quad, levels, bright, blur } = resources;
    const scale = Math.min(gl.getPixelRatio(), look.budget.finishingMaxDimension / Math.max(size.width, size.height));
    const w = Math.max(1, Math.round(size.width * scale)), h = Math.max(1, Math.round(size.height * scale));
    if (target.width !== w || target.height !== h) {
      target.setSize(w, h);
      levels.forEach((t, i) => t.setSize(Math.max(1, Math.ceil(w / (i < 2 ? 2 : 4))), Math.max(1, Math.ceil(h / (i < 2 ? 2 : 4)))));
    }
    const u = material.uniforms;
    resources.metadata.width = w; resources.metadata.height = h;
    u.resolution.value.set(w, h);
    if ("near" in camera) { u.cameraNear.value = camera.near; u.cameraFar.value = camera.far; }
    u.contrast.value = look.grade.contrast; u.saturation.value = look.grade.saturation;
    u.vignette.value = Math.min(.14, vignetteIntensity * .6 + look.grade.vignette * .4);
    u.bloom.value = levels.length ? Math.min(.14, bloomIntensity * .12) : 0;
    u.grain.value = cinematic ? look.grade.grain : 0;
    const previous = gl.getRenderTarget(), autoReset = gl.info.autoReset;
    gl.info.autoReset = false; gl.info.reset();
    try {
      gl.setRenderTarget(target); gl.clear(); gl.render(scene, camera);
      if (levels.length) {
        quad.material = bright; bright.uniforms.inputMap.value = target.texture; bright.uniforms.stepSize.value.set(.5 / w, .5 / h);
        gl.setRenderTarget(levels[0]); quad.render(gl);
        quad.material = blur;
        blur.uniforms.inputMap.value = levels[0].texture; blur.uniforms.stepSize.value.set(1 / levels[0].width, 0);
        gl.setRenderTarget(levels[1]); quad.render(gl);
        blur.uniforms.inputMap.value = levels[1].texture; blur.uniforms.stepSize.value.set(0, 1 / levels[0].height);
        gl.setRenderTarget(levels[0]); quad.render(gl);
        blur.uniforms.inputMap.value = levels[0].texture; blur.uniforms.stepSize.value.set(1 / levels[2].width, 0);
        gl.setRenderTarget(levels[3]); quad.render(gl);
        blur.uniforms.inputMap.value = levels[3].texture; blur.uniforms.stepSize.value.set(0, 1 / levels[2].height);
        gl.setRenderTarget(levels[2]); quad.render(gl);
      }
      quad.material = material; gl.setRenderTarget(previous); quad.render(gl);
    } finally { quad.material = material; gl.setRenderTarget(previous); gl.info.autoReset = autoReset; }
  }, 1);
  return <group name="scene-finishing-budget" userData={resources.metadata} />;
}
