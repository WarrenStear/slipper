type WaterShader = { vertexShader: string; fragmentShader: string };

/** Metre-scaled ripple fields survive resizing. Still water crosses two slow
 * wave trains; rivers advect along local Y (world Z) with narrower streaks. */
export function applyWaterShader(shader: WaterShader) {
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", "#include <common>\nvarying vec2 vWaterUv;")
    .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWaterUv=uv;");
  shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>
    varying vec2 vWaterUv;
    uniform vec2 waterSize;
    uniform float waterTime, waterDetail, waterFlow, waterFine, waterCircle, waterDepth;
    uniform vec3 waterSky;
    float waterHeight(vec2 p) {
      float travel=waterTime*waterFlow*.32;
      vec2 q=p-vec2(0.,travel);
      float flowAmount=abs(waterFlow);
      float broad=sin(q.x*.81+q.y*mix(.64,1.55,flowAmount)+waterTime*.12)*.025;
      broad+=sin(q.x*1.24-q.y*.59-waterTime*.09)*.017*(1.-flowAmount*.6);
      float secondary=0.;
      if (waterFine > 0.) secondary=sin(q.x*mix(3.1,6.3,flowAmount)+sin(q.y*.65))*sin(q.y*2.4-waterTime*.21);
      return (broad+secondary*.0035*waterFine)*waterDetail;
    }
    float waterBank() {
      float rectangle=min(min(vWaterUv.x,1.-vWaterUv.x)*waterSize.x,min(vWaterUv.y,1.-vWaterUv.y)*waterSize.y);
      float radial=(1.-length((vWaterUv-.5)*2.))*waterSize.x*.5;
      return smoothstep(0.,1.35,mix(rectangle,radial,waterCircle));
    }`)
    .replace("#include <color_fragment>", `#include <color_fragment>
      float bank=waterBank();
      vec2 waterP=(vWaterUv-.5)*waterSize;
      float depthVariation=sin(waterP.x*.26+sin(waterP.y*.31))*.035;
      diffuseColor.rgb*=mix(.53,1.+depthVariation,bank);
      diffuseColor.rgb*=mix(1.18,.86,waterDepth);`)
    .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
      roughnessFactor=clamp(roughnessFactor+(1.-waterBank())*.23+abs(waterFlow)*.035,.16,.56);`)
    .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
      vec2 waterPoint=(vWaterUv-.5)*waterSize;
      float h=waterHeight(waterPoint);
      vec3 dWater=vec3(dFdx(h),dFdy(h),0.);
      vec3 waterDx=dFdx(-vViewPosition),waterDy=dFdy(-vViewPosition);
      vec3 waterR1=cross(waterDy,normal),waterR2=cross(normal,waterDx);
      float waterDet=dot(waterDx,waterR1);
      normal=normalize(max(abs(waterDet),.00000001)*normal-sign(waterDet)*(dWater.x*waterR1+dWater.y*waterR2));`)
    .replace("#include <opaque_fragment>", `
      float facing=clamp(dot(normal,normalize(vViewPosition)),0.,1.);
      float fresnel=.02+.98*pow(1.-facing,5.);
      float farSky=smoothstep(.15,.95,1.-facing);
      vec3 reflectedSky=waterSky*mix(.055,.33,farSky);
      float sheen=pow(max(0.,sin(waterPoint.x*.72+waterPoint.y*.21+h*19.)),14.);
      reflectedSky+=waterSky*sheen*.035*waterDetail;
      outgoingLight=mix(outgoingLight,reflectedSky,fresnel*.72*mix(.35,1.,waterBank()));
      #include <opaque_fragment>`);
}
