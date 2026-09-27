type SurfaceShader = { vertexShader: string; fragmentShader: string };

/** Broad soil/moss/rock transitions use metre coordinates. No texture uploads,
 * additional passes, displacement, or change to the terrain/collider buffers. */
export function applyBiomeGroundShader(shader: SurfaceShader, relief: boolean) {
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", "#include <common>\nvarying vec3 vBiomePosition,vBiomeNormal;")
    .replace("#include <begin_vertex>", "#include <begin_vertex>\nvBiomePosition=position;vBiomeNormal=normal;");
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", `#include <common>
      varying vec3 vBiomePosition,vBiomeNormal;
      uniform vec3 biomeMoss,biomeRock;
      uniform vec4 biomeChannel;
      float biomeHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float biomeNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(biomeHash(i),biomeHash(i+vec2(1.,0.)),f.x),mix(biomeHash(i+vec2(0.,1.)),biomeHash(i+vec2(1.,1.)),f.x),f.y);}
      float biomeWetness(){
        float z=vBiomePosition.z;
        float centre=biomeChannel.y+sin(z*.16+biomeChannel.z*.1)*1.6+sin(z*.31)*.45;
        float width=1.28+.28*sin(z*.17+biomeChannel.z);
        float distance=abs(abs(vBiomePosition.x)-centre);
        float bank=(1.-smoothstep(width,width+1.6,distance));
        float riverSide=step(.5,abs(biomeChannel.x))*step(.5,vBiomePosition.x*biomeChannel.x);
        return bank*riverSide;
      }`)
    .replace("#include <color_fragment>", `#include <color_fragment>
      float biomePatch=biomeNoise(vBiomePosition.xz*.31);
      float biomeSlope=1.-clamp(normalize(vBiomeNormal).y,0.,1.);
      float biomeWet=biomeWetness();
      float biomeMossCover=(1.-smoothstep(.06,.34,biomeSlope))*smoothstep(.31,.74,biomePatch);
      float biomeRockCover=smoothstep(.15,.43,biomeSlope)*.8;
      biomeRockCover=max(biomeRockCover,smoothstep(biomeChannel.w*.65,biomeChannel.w,vBiomePosition.y)*.35);
      diffuseColor.rgb=mix(diffuseColor.rgb,biomeMoss,biomeMossCover*.8);
      diffuseColor.rgb=mix(diffuseColor.rgb,biomeRock,biomeRockCover);
      diffuseColor.rgb*=.88+biomeNoise(vBiomePosition.xz*2.1)*.18;
      diffuseColor.rgb*=1.-biomeWet*.24;`)
    .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
      roughnessFactor=clamp(roughnessFactor-biomeWetness()*.25,.62,.98);`);
  if (relief) shader.fragmentShader = shader.fragmentShader.replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
      float biomeRelief=biomeNoise(vBiomePosition.xz*9.)*.006;
      float biomeFilter=1.-smoothstep(.25,1.5,length(fwidth(vBiomePosition.xz*9.)));
      vec2 biomeDerivative=vec2(dFdx(biomeRelief),dFdy(biomeRelief))*biomeFilter;
      vec3 biomeDx=dFdx(-vViewPosition),biomeDy=dFdy(-vViewPosition);
      vec3 biomeR1=cross(biomeDy,normal),biomeR2=cross(normal,biomeDx);
      float biomeDet=dot(biomeDx,biomeR1);
      normal=normalize(max(abs(biomeDet),.00000001)*normal-sign(biomeDet)*(biomeDerivative.x*biomeR1+biomeDerivative.y*biomeR2));`);
  return shader;
}
