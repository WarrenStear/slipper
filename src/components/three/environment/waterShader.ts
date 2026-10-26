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
    uniform float waterRiverBanks;
    uniform vec3 waterSky, waterZenith;
    uniform float waterMoon;
    float waterHeight(vec2 p) {
      float travel=waterTime*waterFlow*.32;
      vec2 q=p-vec2(0.,travel);
      float flowAmount=abs(waterFlow);
      float broad=sin(q.x*.81+q.y*mix(.64,1.55,flowAmount)+waterTime*.12)*.035;
      broad+=sin(q.x*1.24-q.y*.59-waterTime*.09)*.021*(1.-flowAmount*.6);
      // Crossing centimetre-scale ripples also remain on scenery water. The
      // existing comfort clock freezes them; reduced effects halves the slope.
      broad+=sin(q.x*4.4+q.y*2.8+sin(q.y*1.2)-waterTime*.18)*.009;
      broad+=sin(q.x*9.7-q.y*5.6+waterTime*.23)*.0025;
      float secondary=0.;
      if (waterFine > 0.) secondary=sin(q.x*mix(3.1,6.3,flowAmount)+sin(q.y*.65))*sin(q.y*2.4-waterTime*.21);
      return (broad+secondary*.0035*waterFine)*waterDetail;
    }
    float waterBank() {
      float rectangle=min(min(vWaterUv.x,1.-vWaterUv.x)*waterSize.x,min(vWaterUv.y,1.-vWaterUv.y)*waterSize.y);
      float radial=(1.-length((vWaterUv-.5)*2.))*waterSize.x*.5;
      // River ends are open reaches, not artificial shores across the current.
      float sideBanks=min(vWaterUv.x,1.-vWaterUv.x)*waterSize.x;
      float edge=mix(mix(rectangle,radial,waterCircle),sideBanks,waterRiverBanks);
      return smoothstep(0.,mix(1.35,.92,waterRiverBanks),edge);
    }`)
    .replace("#include <color_fragment>", `#include <color_fragment>
      float bank=waterBank();
      vec2 waterP=(vWaterUv-.5)*waterSize;
      float depthVariation=sin(waterP.x*.26+sin(waterP.y*.31))*.035;
      float shoreGrain=.5+.5*sin(waterP.x*8.1+sin(waterP.y*6.2))*sin(waterP.y*11.3);
      diffuseColor.rgb=mix(vec3(.055,.078,.069)*(.82+shoreGrain*.24),diffuseColor.rgb,smoothstep(0.,.72,bank));
      float originalDepth=mix(.82,1.+depthVariation,bank);
      float riverDepth=mix(1.12,.9+depthVariation,bank);
      diffuseColor.rgb*=mix(originalDepth,riverDepth,waterRiverBanks);
      float bankDistance=min(vWaterUv.x,1.-vWaterUv.x)*waterSize.x;
      float shoreBand=smoothstep(.025,.12,bankDistance)*(1.-smoothstep(.12,.32,bankDistance));
      float ripplet=.5+.5*sin(waterP.y*4.2-waterTime*waterFlow*.9);
      float foam=shoreBand*ripplet*waterRiverBanks*waterFine*abs(waterFlow)*.08;
      diffuseColor.rgb=mix(diffuseColor.rgb,waterSky*.24,foam);
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
      vec3 worldNormal=inverseTransformDirection(normal,viewMatrix);
      vec3 worldView=inverseTransformDirection(normalize(vViewPosition),viewMatrix);
      vec3 reflected=reflect(-worldView,worldNormal);
      float skyHeight=pow(smoothstep(-.08,.72,reflected.y),.65);
      vec3 reflectedSky=mix(waterSky,waterZenith,skyHeight)*mix(.62,.88,farSky);
      // Same fixed direction and angular radius as the world sky. Ripples break
      // up the reflection through the perturbed normal, without a capture pass.
      float moonAngle=acos(clamp(dot(reflected,normalize(vec3(.27,.36,.91))),-1.,1.));
      float moonDisc=1.-smoothstep(.035,.051,moonAngle);
      reflectedSky+=vec3(.38,.63,1.)*(moonDisc*.68+exp(-moonAngle*25.)*.04)*waterMoon;
      float sheen=pow(max(0.,sin(waterPoint.x*.72+waterPoint.y*.21+h*19.)),14.);
      reflectedSky+=waterSky*sheen*.045*waterDetail;
      outgoingLight=mix(outgoingLight,reflectedSky,fresnel*.92*mix(.55,1.,waterBank()));
      #include <opaque_fragment>`);
}
