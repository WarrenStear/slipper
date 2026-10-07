export const vertexShader = `varying vec4 projectedFloor; varying vec2 vUv; varying vec3 vFloorView; varying vec3 vFloorNormal;
        void main(){vUv=uv;vec4 viewPosition=modelViewMatrix*vec4(position,1.);vFloorView=-viewPosition.xyz;vFloorNormal=normalMatrix*normal;gl_Position=projectionMatrix*viewPosition;projectedFloor=gl_Position;}`;

export const fragmentShader = `uniform sampler2D forest;uniform sampler2D liveForest;uniform float hasDepth;varying vec4 projectedFloor;uniform sampler2D coverageMask;uniform float apertureOpacity;uniform float stage;uniform float time;varying vec2 vUv;varying vec3 vFloorView;varying vec3 vFloorNormal;
      float woodHash(float n){return fract(sin(n*127.1)*43758.5453);}
      void main(){
        float brushed=texture2D(coverageMask,vUv).r;
        float first=smoothstep(.1,1.,stage);float second=smoothstep(1.1,2.,stage);
        float restored=(1.-smoothstep(.045,.17+second*.1,distance(vUv,vec2(.5,.56))))*first*(.6+second*.4);
        float mask=max(brushed,restored);float reveal=mask*(.42+first*.26+second*.4);
        float ripple=sin(length(vUv-.5)*75.-time*2.)*.0015*second;
        // Palette values below are deliberately dark display-referred colours.
        // Convert them before blending with the sRGB-decoded source photograph.
        vec2 parallaxUv=projectedFloor.xy/projectedFloor.w*.5+.5;
        vec3 branches=hasDepth>.5?texture2D(liveForest,parallaxUv+vec2(ripple*.3)).rgb:texture2D(forest,vUv+vec2(ripple)).rgb*(.64+second*.22);
        // Staggered joinery, long grain and a restrained reflected lamp pool.
        // Geometry, ray UVs, mask strength and progression stay unchanged.
        float board=floor(vUv.x*36.0), seed=woodHash(board);
        vec2 timber=vec2(fract(vUv.x*36.0),fract(vUv.y*(4.5+seed)+seed));
        float grainPhase=vUv.x*1700.0+sin(vUv.y*28.0+seed*6.0)*2.8;
        float grainFade=1.0-smoothstep(.4,1.6,fwidth(grainPhase));
        float grain=sin(grainPhase)*.006*grainFade+sin(vUv.x*310.0+seed*4.0)*.003*(1.-smoothstep(.4,1.6,fwidth(vUv.x*310.0)));
        vec3 room=mix(vec3(.14,.125,.105),vec3(.22,.194,.158),seed)+grain;
        float seamX=smoothstep(.006,.018,min(timber.x,1.0-timber.x));
        float seamY=smoothstep(.004,.012,min(timber.y,1.0-timber.y));
        room*=mix(.57,1.0,seamX*seamY);
        float stain=sin(vUv.x*19.+sin(vUv.y*13.)*1.8)*sin(vUv.y*17.+seed*.7);
        float damp=smoothstep(-.25,.65,stain);
        room*=1.-damp*.19;
        // Patch edges interrupt the grazing reflection instead of a uniform varnish.
        float wetPatch=smoothstep(.08,.58,stain+sin(vUv.x*7.-vUv.y*11.)*.25);
        vec2 lamp=(vUv-vec2(.52,.83))/vec2(.09,.42);
        float lamplight=exp(-dot(lamp,lamp)*1.7);
        float water=sin(vUv.y*660.0+sin(vUv.x*43.0)*2.0)*.5+.5;
        room+=vec3(.16,.108,.051)*lamplight*(.65+.35*water)*first;
        float coolEdge=exp(-pow((vUv.x-.22)*13.0,2.0))*vUv.y*.018;
        room+=vec3(.65,.85,1.0)*coolEdge;
        float fresnel=pow(1.-abs(dot(normalize(vFloorNormal),normalize(vFloorView))),3.);
        room+=vec3(.025,.044,.053)*fresnel*(.2+wetPatch*.8);
        float roomEdge=smoothstep(0.,.13,min(min(vUv.x,1.-vUv.x),min(vUv.y,1.-vUv.y)));
        room*=mix(.7,1.,roomEdge);
        room=sRGBTransferEOTF(vec4(max(room,vec3(0.)),1.)).rgb;
        vec3 color=mix(room,branches,clamp(reveal+smoothstep(2.,3.,stage),0.,1.));
        float edge=mask*(1.-mask);color+=sRGBTransferEOTF(vec4(.09,.12,.13,1.)).rgb*edge;
        gl_FragColor=vec4(color,apertureOpacity);
        #include <colorspace_fragment>
      }`;
