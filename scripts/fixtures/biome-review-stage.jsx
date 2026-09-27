// Isolated source-component fixture. Never imported by the application entry.
// It validates GPU rendering/settings, not earned story progression or physics.
import React, { Suspense, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ACESFilmicToneMapping, Vector2 } from 'three';
import { OutdoorLandscape } from '../../src/components/three/environment/OutdoorLandscape';
import { NarrativeWater } from '../../src/components/three/environment/SanctuaryWater';
import { ENVIRONMENT_THEMES } from '../../src/components/three/environment/environmentThemes';
import { landscapeForScene } from '../../src/components/three/environment/landscapeGeography';
import { TactileDetailProvider } from '../../src/components/three/storyEvents/TactileMaterial';
import { SceneLookContext } from '../../src/components/three/artDirection/SceneLookContext';
import { resolveSceneLook } from '../../src/components/three/artDirection/SceneLookRegistry';
import { SceneLighting } from '../../src/components/three/artDirection/SceneLighting';
import { AuthoredLightShafts } from '../../src/components/three/artDirection/VolumetricLightShaft';
import { GroundMist } from '../../src/components/three/artDirection/GroundMist';
import { advanceSceneMotion } from '../../src/components/three/artDirection/sceneMotion';
import { activateCinematicProfile, advanceCinematicProfile } from '../../src/cinematics/emotionalCinematography';
import { BIOME_REVIEW_CASES } from '../biome-review-contract.mjs';

window.__biomeShaderErrors = [];
const matrixHash = array => {
  let hash = 2166136261;
  for (const byte of new Uint8Array(array.buffer, array.byteOffset, array.byteLength)) hash = Math.imul(hash ^ byte, 16777619);
  return (hash >>> 0).toString(16);
};
function Evidence({ config, revision, presentation }) {
  const { camera, gl, scene } = useThree();
  const frames = useRef(0), hookedMeshes = useRef(new WeakSet()), hookedMaterials = useRef(new WeakSet());
  const uniforms = useRef(new WeakMap()), drawn = useRef(new Set()), size = useMemo(() => new Vector2(), []);
  useLayoutEffect(() => {
    frames.current = 0; window.__biomeSnapshot = null;
  }, [revision]);
  useLayoutEffect(() => {
    const spec = landscapeForScene(config.sceneId);
    if (spec) {
      camera.position.set(0, 12, 26);
      // The home river is on the negative bank; aim at the water-bearing side.
      camera.lookAt((spec.riverSide || 1) * (spec.inner + spec.outer) * .5, 2.5, 0);
    } else { camera.position.set(0, 7, 14); camera.lookAt(0, 0, 0); }
    camera.updateProjectionMatrix();
  }, [camera, config.sceneId]);
  useLayoutEffect(() => {
    gl.debug.checkShaderErrors = true;
    const previous = gl.debug.onShaderError;
    gl.debug.onShaderError = (context, program, vertex, fragment) => {
      const error = [context.getProgramInfoLog(program), context.getShaderInfoLog(vertex), context.getShaderInfoLog(fragment)].filter(Boolean).join('\n');
      window.__biomeShaderErrors.push(error || 'Shader linking failed without a diagnostic');
      console.error('Biome shader compilation failed:', error);
    };
    return () => { gl.debug.onShaderError = previous; };
  }, [gl]);
  useFrame((_, delta) => {
    const dt = advanceSceneMotion(presentation, presentation.look, delta, !document.hidden, config.reducedMotion, config.reducedEffects);
    advanceCinematicProfile(presentation.look.emotional, dt);
  }, -3);
  // A positive-priority callback explicitly owns this fixture's one render.
  useFrame(() => {
    drawn.current.clear();
    scene.traverse(object => {
      if (!object.isMesh) return;
      if (!hookedMeshes.current.has(object)) {
        const original = object.onBeforeRender;
        object.onBeforeRender = function (...args) { drawn.current.add(this.name); original.apply(this, args); };
        hookedMeshes.current.add(object);
      }
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (hookedMaterials.current.has(material)) continue;
        // Preserve the real material shader injections and program key.
        const original = material.onBeforeCompile;
        material.onBeforeCompile = function (shader, renderer) {
          original.call(this, shader, renderer); uniforms.current.set(this, shader.uniforms);
        };
        hookedMaterials.current.add(material);
      }
    });
    gl.render(scene, camera);
    frames.current++;
    if (frames.current < 30 || frames.current % 15) return;
    const context = gl.getContext(), batches = [], water = [];
    let terrain = null;
    scene.traverse(object => {
      if (object.name === 'rolling-hills-and-carved-riverbanks') terrain = object.geometry.uuid;
      if (object.isInstancedMesh) {
        const box = object.boundingBox, sphere = object.boundingSphere;
        batches.push({ name: object.name, count: object.count, visible: object.visible,
          geometry: object.geometry.uuid, matrixVersion: object.instanceMatrix.version,
          matrixHash: matrixHash(object.instanceMatrix.array),
          finite: Array.from(object.instanceMatrix.array).every(Number.isFinite),
          bounded: Boolean(box && sphere && [...box.min.toArray(), ...box.max.toArray(), ...sphere.center.toArray(), sphere.radius].every(Number.isFinite) && sphere.radius > 0),
        });
      }
      if (object.name === 'directional-river-water' || object.name === 'still-reflective-water') {
        const values = uniforms.current.get(object.material);
        water.push({ banks: values?.waterRiverBanks?.value, time: values?.waterTime?.value });
      }
    });
    gl.getDrawingBufferSize(size);
    const pixel = new Uint8Array(4), colors = new Set();
    for (let y = 1; y < 10; y++) for (let x = 1; x < 12; x++) {
      context.readPixels(Math.floor(size.x * x / 12), Math.floor(size.y * y / 10), 1, 1, context.RGBA, context.UNSIGNED_BYTE, pixel);
      colors.add(`${pixel[0]},${pixel[1]},${pixel[2]}`);
    }
    window.__biomeSnapshot = {
      config: { ...config }, revision, frames: frames.current,
      webgl2: context instanceof WebGL2RenderingContext, contextLost: context.isContextLost(),
      calls: gl.info.render.calls, triangles: gl.info.render.triangles,
      pixelColors: colors.size, glError: context.getError(), shaderErrors: [...window.__biomeShaderErrors],
      batches, water, terrain, drawn: [...drawn.current], time: { ...presentation.time },
      renderer: context.getParameter(context.RENDERER), geometries: gl.info.memory.geometries,
    };
  }, 1);
  return null;
}
function World({ config, revision }) {
  useLayoutEffect(() => activateCinematicProfile(), []);
  const look = useMemo(() => resolveSceneLook(config.sceneId, config.quality, config.reducedEffects), [config]);
  const frame = useRef({ motion: { ...look.motion }, time: { vegetation: 0, cloth: 0, water: 0, particles: 0, flame: 0 } });
  const presentation = useMemo(() => ({ look, ...frame.current, stillness: 0,
    reducedMotion: config.reducedMotion, reducedEffects: config.reducedEffects, origin: [0, 0, 0], heading: 0,
  }), [look, config.reducedMotion, config.reducedEffects]);
  const sanctuary = config.sceneId === 'blue-moon.sanctuary', water = ENVIRONMENT_THEMES.sanctuary.water;
  return <SceneLookContext.Provider value={presentation}>
    <TactileDetailProvider quality={config.quality} reducedEffects={config.reducedEffects}>
      <color attach="background" args={[look.atmosphere.sky]} />
      <fogExp2 attach="fog" args={[look.atmosphere.fog, look.atmosphere.density]} />
      <SceneLighting /><AuthoredLightShafts /><GroundMist />
      {sanctuary ? <NarrativeWater color={water.color} flow={water.flow} opacity={water.depth} roughness={water.roughness}
        reducedEffects={config.reducedEffects} reducedMotion={config.reducedMotion} />
        : <OutdoorLandscape {...config} collidable={false} />}
      <Evidence config={config} revision={revision} presentation={presentation} />
    </TactileDetailProvider>
  </SceneLookContext.Provider>;
}
function App() {
  const [state, setState] = useState({ sceneId: BIOME_REVIEW_CASES[0].sceneId, quality: 'high', reducedEffects: false, reducedMotion: false, revision: 0 });
  const { revision, ...config } = state;
  const change = patch => setState(previous => ({ ...previous, ...patch, revision: previous.revision + 1 }));
  return <main>
    <header><h1>Biome component review</h1>
      <label>Scene<select aria-label="Scene" value={state.sceneId} onChange={e => change({ sceneId: e.target.value })}>
        {BIOME_REVIEW_CASES.map(item => <option key={item.sceneId} value={item.sceneId}>{item.family}</option>)}
      </select></label>
      <label>Quality<select aria-label="Quality" value={state.quality} onChange={e => change({ quality: e.target.value })}>
        {['low','medium','high','cinematic'].map(value => <option key={value}>{value}</option>)}
      </select></label>
      <label><input type="checkbox" checked={state.reducedEffects} onChange={e => change({ reducedEffects: e.target.checked })} />Reduced effects</label>
      <label><input type="checkbox" checked={state.reducedMotion} onChange={e => change({ reducedMotion: e.target.checked })} />Reduced motion</label>
    </header>
    <section aria-label="Rendered biome">
      <Canvas dpr={1} shadows camera={{ fov: 55, near: .1, far: 160 }} gl={{ antialias: true, preserveDrawingBuffer: true, toneMapping: ACESFilmicToneMapping }}>
        <Suspense fallback={null}><World config={config} revision={revision} /></Suspense>
      </Canvas>
    </section>
  </main>;
}
createRoot(document.getElementById('root')).render(<App />);
