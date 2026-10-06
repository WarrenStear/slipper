import React, { Suspense, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import * as THREE from 'three';
import { StorySceneWithMasterLantern } from '../../src/components/three/StorySceneWithMasterLantern.tsx';
import { RENDER_QUALITY_PROFILES, resolveEnvironmentalEffectsProfile } from '../../src/components/three/renderQuality.ts';
import { entries } from '../../src/data/slipperContent.ts';
import { getJourneyScene, getJourneySceneForEntry } from '../../src/data/journeyNarrative.ts';
import { buildMazePathSegments, curvedPathPointAt } from '../../src/world/terrain/worldPaths.ts';
import { terrainElevationAtPoint } from '../../src/world/terrain/terrainSampler.ts';
import { entryWorldPosition } from '../../src/world/terrain/worldPlacement.ts';
import { TERRAIN_BASE_Y, TERRAIN_SEGMENTS } from '../../src/world/terrain/worldConstants.ts';
import { FOREST_CELL_SIZE } from '../../src/world/forest/forestConstants.ts';
import { guidedPathSegment } from '../../src/world/guidance/routeGeometry.ts';
import { pathUnderstoryCount } from '../../src/world/guidance/pathUnderstoryHabitat.ts';
import { forestArchetypeAtWorldPosition, forestReferenceCrownTransform } from '../../src/world/forest/forestInstancePresentation.ts';
import { useJourneyStore } from '../../src/stores/useJourneyStore.ts';
import { useWorldStore } from '../../src/stores/useWorldStore.ts';
import { useSettingsStore } from '../../src/stores/useSettingsStore.ts';
import { FOREST_LIFECYCLE_SCENES as scenes, forestLifecycleProblems, forestResourceCounts, inspectForestMorphRows } from '../forest-lifecycle-contracts.mjs';

// Trusted review seeding and a fixed pose exercise presentation/resource lifetime.
// This fixture does not claim physical walking, authored story progression or FPS.
const worldState = { visitedCount: 4, totalCount: entries.length, traceCount: 0, fireCount: 0,
  waterCount: 0, memoryCount: 0, thresholdCount: 0, crownCount: 0, fireWaterBalance: 0,
  explorationDepth: .12, memoryPressure: .05, symbolicWeight: 0 };
const segments = buildMazePathSegments(entries);
const sampleGroundY = (x, z) => TERRAIN_BASE_Y + terrainElevationAtPoint(x, z, entries, segments, worldState);
const initial = { sceneId: scenes.rabbit, targetSceneId: scenes.meadow,
  quality: 'high', reduced: false, mounted: false, revision: 0 };

function sceneEntry(id) {
  const narrative = getJourneyScene(id);
  if (!narrative || narrative.id !== id) throw new Error(`Review scene is not canonical: ${id}`);
  const entry = entries.find(candidate => candidate.id === narrative.keystoneEntryId);
  if (!entry || getJourneySceneForEntry(entry.id)?.id !== id) throw new Error(`Canonical review keystone is missing or mismatched: ${id}`);
  return entry;
}

function reviewPose(entry, route) {
  if (route) {
    const source = route.sourceEntry.id === entry.id;
    const position = curvedPathPointAt(route, source ? .3 : .7, worldState);
    const ahead = curvedPathPointAt(route, source ? .38 : .62, worldState);
    return { position: [position.x, sampleGroundY(position.x, position.y) + 1.7, position.y],
      focus: [ahead.x, sampleGroundY(ahead.x, ahead.y) + 2.2, ahead.y] };
  }
  const center = entryWorldPosition(entry, entries);
  return { position: [center[0] + 4, sampleGroundY(center[0] + 4, center[2] + 3) + 1.8, center[2] + 3],
    focus: [center[0] - 7, sampleGroundY(center[0] - 7, center[2] - 8) + 5, center[2] - 8] };
}

function trackWorldTextures(renderer) {
  const context = renderer.getContext(), records = new Map(), proxies = new WeakMap();
  let created = 0, deleted = 0;
  const create = context.createTexture.bind(context), remove = context.deleteTexture.bind(context);
  context.createTexture = () => {
    const texture = create();
    if (texture) records.set(texture, { id: ++created, kind: 'other', owners: new Set() });
    return texture;
  };
  context.deleteTexture = texture => {
    if (records.delete(texture)) deleted++;
    return remove(texture);
  };
  const getProperties = renderer.properties.get.bind(renderer.properties);
  const label = (texture, handle, owner) => {
    const record = records.get(handle);
    if (!record || !texture?.isTexture) return;
    const image = texture.source?.data;
    record.owners.add(owner);
    record.uuid = texture.uuid;
    record.width = image?.width;
    record.height = image?.height;
    record.depth = image?.depth;
    // WebGLMorphtargets creates an internal DataArrayTexture, outside the scene.
    if (texture.isDataArrayTexture && image?.depth === 8) record.kind = 'forest-morph-target';
    if (texture.isDataTexture && image?.width === 9 && image?.height === 243
      && image.data instanceof Float32Array) record.kind = 'forest-morph-weights';
  };
  renderer.properties.get = object => {
    const properties = getProperties(object);
    if (!object?.isTexture) return properties;
    if (!proxies.has(properties)) proxies.set(properties, new Proxy(properties, {
      set(target, key, value) {
        Reflect.set(target, key, value);
        if (key === '__webglTexture') label(object, value, 'renderer-allocation');
        return true;
      },
    }));
    return proxies.get(properties);
  };
  window.__forestLabelTexture = (texture, owner) => {
    if (texture?.isTexture) label(texture, getProperties(texture).__webglTexture, owner);
  };
  window.__forestNativeTextures = () => {
    const textures = Array.from(records.values(), record => ({ ...record, owners: Array.from(record.owners) }));
    return { created, deleted, live: records.size,
      kinds: textures.reduce((result, texture) => ({ ...result, [texture.kind]: (result[texture.kind] ?? 0) + 1 }), {}), textures };
  };
  const signature = value => window.__forestFingerprint(new TextEncoder().encode(String(value)));
  const ownerPath = object => {
    const path = [];
    for (let parent = object; parent; parent = parent.parent) path.unshift(parent.name || parent.type);
    return path.join('/');
  };
  const renderBufferDirect = renderer.renderBufferDirect.bind(renderer);
  const rendererGeometries = new Map();
  window.__forestDraws = [];
  renderer.renderBufferDirect = (camera, scene, geometry, material, object, group) => {
    const before = renderer.info.render.calls;
    const result = renderBufferDirect(camera, scene, geometry, material, object, group);
    const properties = getProperties(material), target = renderer.getRenderTarget();
    let allocation = rendererGeometries.get(geometry.uuid);
    if (!allocation) {
      allocation = { uuid: geometry.uuid, type: geometry.type, vertices: geometry.attributes.position?.count,
        indices: geometry.index?.count ?? null, owners: new Set(), disposed: false, uploads: 0 };
      rendererGeometries.set(geometry.uuid, allocation);
      geometry.addEventListener('dispose', () => { allocation.disposed = true; });
    }
    if (!allocation.uploads || allocation.disposed) allocation.uploads++;
    allocation.disposed = false; allocation.owners.add(ownerPath(object));
    const draw = { owner: ownerPath(object), object: object.uuid, geometry: geometry.uuid,
      geometryType: geometry.type, vertices: geometry.attributes.position?.count,
      indices: geometry.index?.count ?? null, instances: object.isInstancedMesh ? object.count : null,
      morphTargets: geometry.morphAttributes.position?.length ?? 0,
      calls: renderer.info.render.calls - before, target: target?.texture?.name || (target ? 'unnamed-target' : 'screen'),
      cameraType: camera.type, cameraFov: camera.fov, material: material.uuid,
      materialType: material.type, side: material.side, transparent: material.transparent,
      program: properties.currentProgram?.id, variants: properties.programs?.size ?? 0,
      customKey: signature(material.customProgramCacheKey()),
      programKeys: Array.from(properties.programs ?? [], ([key, program]) => ({ key: signature(key), id: program.id, usedTimes: program.usedTimes })) };
    window.__forestDraws.push(draw);
    return result;
  };
  window.__forestPrograms = () => renderer.info.programs.map(program => ({ id: program.id,
    key: signature(program.cacheKey), usedTimes: program.usedTimes, name: program.name }));
  window.__forestRendererGeometries = () => Array.from(rendererGeometries.values(), geometry => ({ ...geometry, owners: Array.from(geometry.owners) }));
}

const hashCache = new WeakMap();
const geometryRecords = new Map();
function observeForestGeometry(geometry, owner) {
  if (geometryRecords.has(geometry.uuid)) return;
  const record = { uuid: geometry.uuid, owner, disposed: false };
  geometryRecords.set(geometry.uuid, record);
  geometry.addEventListener('dispose', () => { record.disposed = true; });
}
function uploadedHash(attribute) {
  if (!attribute) return null;
  const previous = hashCache.get(attribute);
  if (previous?.version === attribute.version) return previous.hash;
  const hash = window.__forestFingerprint(attribute.array);
  hashCache.set(attribute, { version: attribute.version, hash });
  return hash;
}
function weightEvidence(mesh) {
  if (!mesh) return null;
  const weights = inspectForestMorphRows(mesh.morphTexture?.source.data, mesh.instanceMatrix.count);
  return { count: mesh.count, capacity: mesh.instanceMatrix.count, matrixVersion: mesh.instanceMatrix.version,
    morphTargets: mesh.geometry.morphAttributes.position?.length ?? 0, weights,
    visible: visibleInHierarchy(mesh), finite: Array.from(mesh.instanceMatrix.array).every(Number.isFinite),
    geometry: mesh.geometry.uuid, morphTexture: mesh.morphTexture?.uuid,
    boundingBox: mesh.boundingBox ? [mesh.boundingBox.min.toArray(), mesh.boundingBox.max.toArray()] : null };
}
function visibleInHierarchy(object) {
  for (let parent = object; parent; parent = parent.parent) if (!parent.visible) return false;
  return true;
}

function Evidence({ config, entry, target, route, pose, profile }) {
  const { camera, gl, scene } = useThree(), frames = useRef(0), settled = useRef({ key: '', samples: 0 });
  const glErrors = useRef([]), revision = useRef(config.revision);
  const rendererName = useMemo(() => {
    const context = gl.getContext(), debug = context.getExtension('WEBGL_debug_renderer_info');
    return context.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : context.RENDERER);
  }, [gl]);
  if (revision.current !== config.revision) {
    revision.current = config.revision; frames.current = 0; settled.current = { key: '', samples: 0 };
  }
  // The production CameraController runs at -1. This review-only pose runs next,
  // before forest/guidance subscribers use the camera to choose their live cell.
  useFrame(() => {
    window.__forestDraws = [];
    camera.position.set(...pose.position); camera.lookAt(...pose.focus);
    camera.fov = 62; camera.near = .05; camera.far = 900; camera.updateProjectionMatrix();
  }, -.5);
  useFrame(() => {
    frames.current++;
    if (frames.current % 8 !== 0) return;
    const observedRevision = config.revision;
    queueMicrotask(() => {
      if (observedRevision !== revision.current) return;
      const context = gl.getContext();
      for (let index = 0; index < 8; index++) {
        const code = context.getError();
        if (code === context.NO_ERROR) break;
        glErrors.current.push(`0x${code.toString(16)}`);
      }
      const trunks = scene.getObjectByName('continuous-forest-trunks'), crowns = scene.getObjectByName('continuous-forest-crowns');
      const understory = scene.getObjectByName('contextual-path-understory'), far = scene.getObjectByName('world-anchored-distant-woodland');
      const authorities = [], farMeshes = [], terrainMeshes = [];
      scene.traverse(object => {
        if (object.name === 'scene-look-authority') authorities.push({ ...object.userData, visible: visibleInHierarchy(object) });
        if (object.isMesh && object.geometry.attributes.position?.count === (TERRAIN_SEGMENTS + 1) ** 2)
          terrainMeshes.push(object);
        if (object.shadow?.map) window.__forestLabelTexture(object.shadow.map.texture, `${object.name}:shadow`);
        if (object.getRenderTarget) window.__forestLabelTexture(object.getRenderTarget().texture, `${object.name}:reflection`);
        window.__forestLabelTexture(object.morphTexture, `${object.name}:instance-morph`);
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          if (!material) continue;
          for (const key of ['map', 'normalMap', 'roughnessMap', 'aoMap']) window.__forestLabelTexture(material[key], `${object.name}:${key}`);
          for (const [key, uniform] of Object.entries(material.uniforms ?? {})) window.__forestLabelTexture(uniform.value, `${object.name}:${key}`);
        }
      });
      far?.traverse(object => { if (object.isInstancedMesh) farMeshes.push(object); });
      for (const mesh of [trunks, crowns, understory, ...farMeshes, ...terrainMeshes])
        if (mesh) observeForestGeometry(mesh.geometry, mesh.name || 'terrain-or-far-woodland');
      const workers = (window.__forestWorkers ?? []).filter(worker => worker.posts.some(post => ['BUILD_FOREST', 'GENERATE_TERRAIN'].includes(post.type)));
      const live = workers.filter(worker => !worker.terminated), forestWorker = live.find(worker => worker.lastPost?.type === 'BUILD_FOREST');
      const terrainWorker = live.find(worker => worker.lastPost?.type === 'GENERATE_TERRAIN');
      const response = forestWorker?.lastResponse, terrainResponse = terrainWorker?.lastResponse;
      const pairProblems = [];
      const trunkEvidence = weightEvidence(trunks), crownEvidence = weightEvidence(crowns);
      if (trunks && crowns && trunkEvidence.weights.valid && crownEvidence.weights.valid) {
        const trunkMatrix = new THREE.Matrix4(), crownMatrix = new THREE.Matrix4(), expected = new THREE.Matrix4();
        const local = forestReferenceCrownTransform();
        for (let index = 0; index < Math.min(trunks.count, crowns.count); index++) {
          trunks.getMatrixAt(index, trunkMatrix); crowns.getMatrixAt(index, crownMatrix);
          const family = forestArchetypeAtWorldPosition(trunkMatrix.elements[12], trunkMatrix.elements[14]);
          if (trunkEvidence.weights.families[index] !== family || crownEvidence.weights.families[index] !== family)
            pairProblems.push(`Instance ${index} lost its paired world-coordinate archetype`);
          expected.multiplyMatrices(trunkMatrix, local);
          if (expected.elements.some((value, element) => !Number.isFinite(crownMatrix.elements[element])
            || Math.abs(value - crownMatrix.elements[element]) > 2e-5)) pairProblems.push(`Instance ${index} canopy support transform is detached`);
        }
      }
      const forestConfig = forestWorker?.lastPost?.config;
      const workersReady = live.length === 2 && response?.requestId === forestWorker?.lastPost?.requestId
        && response?.type === 'FOREST_READY' && terrainResponse?.requestId === terrainWorker?.lastPost?.requestId
        && terrainResponse?.type === 'TERRAIN_READY' && forestConfig?.cellX === Math.floor(camera.position.x / FOREST_CELL_SIZE)
        && forestConfig?.cellZ === Math.floor(camera.position.z / FOREST_CELL_SIZE)
        && forestConfig?.cellRadius === Math.min(4, profile.forestCellRadius)
        && forestConfig?.treesPerCell === Math.min(3, profile.treesPerCell)
        && trunks?.count === response.trunkCount && crowns?.count === response.crownCount
        && trunks?.instanceMatrix.version > 0 && crowns?.instanceMatrix.version > 0;
      const terrainReady = terrainResponse?.positions === (TERRAIN_SEGMENTS + 1) ** 2 * 3
        && terrainMeshes.some(mesh => mesh.geometry.boundingBox?.max.y - mesh.geometry.boundingBox?.min.y > .001
          && uploadedHash(mesh.geometry.attributes.position) === terrainResponse.positionHash);
      const journey = useJourneyStore.getState();
      const journeyPresentation = { sceneId: journey.sceneId, chapterId: journey.chapterId, actId: journey.actId,
        activeEntryId: journey.activeEntryId, storyStarted: journey.storyStarted, storyCompleted: journey.storyCompleted,
        inventory: structuredClone(journey.inventory), worldFlags: { ...journey.worldFlags },
        storyObjectStates: { ...journey.storyObjectStates }, storyPlacementStates: { ...journey.storyPlacementStates },
        completedStoryEventIds: [...journey.completedStoryEventIds], completedRitualIds: [...journey.completedRitualIds],
        landmarkStates: { ...journey.landmarkStates }, witnessedEntryIds: [...journey.witnessedEntryIds] };
      const sample = { ...config, effectiveProfile: { ...profile }, frames: frames.current, renderer: rendererName, entryId: entry.id, targetEntryId: target.id,
        journeyPresentation,
        route: route ? { key: route.key, source: route.sourceEntry.id, target: route.targetEntry.id } : null,
        camera: camera.position.toArray(), quaternion: camera.quaternion.toArray(),
        lens: { fov: camera.fov, aspect: camera.aspect, near: camera.near, far: camera.far },
        projection: camera.projectionMatrix.toArray(), authorities,
        workersReady, terrainReady, liveWorkers: live.length, workers,
        forestGeometries: Array.from(geometryRecords.values(), record => ({ ...record })),
        workerErrors: workers.flatMap(worker => worker.errors), glErrors: [...glErrors.current],
        memory: { ...gl.info.memory }, programs: gl.info.programs.length,
        programInventory: window.__forestPrograms(), drawInventory: [...window.__forestDraws],
        rendererGeometryInventory: window.__forestRendererGeometries(),
        calls: gl.info.render.calls, triangles: gl.info.render.triangles,
        expected: { understoryCount: pathUnderstoryCount(config.quality), farCount: config.quality === 'low' ? 40 : config.quality === 'medium' ? 64 : 96 },
        forest: { trunks: trunkEvidence, crowns: crownEvidence, pairProblems: pairProblems.slice(0, 12),
          rawTrunkHash: response?.trunkHash, uploadedTrunkHash: uploadedHash(trunks?.instanceMatrix),
          rawColorHash: response?.colorHash, uploadedColorHash: uploadedHash(trunks?.instanceColor) },
        understory: understory ? { count: understory.count, capacity: understory.instanceMatrix.count,
          matrixVersion: understory.instanceMatrix.version, visible: visibleInHierarchy(understory),
          attributes: Object.fromEntries(Object.entries(understory.geometry.attributes).map(([name, attribute]) => [name, { count: attribute.count, version: attribute.version }])),
          finite: Object.values(understory.geometry.attributes).every(attribute => Array.from(attribute.array).every(Number.isFinite))
            && Array.from(understory.instanceMatrix.array).every(Number.isFinite) } : null,
        far: far ? { batches: farMeshes.length, counts: farMeshes.map(mesh => mesh.count),
          morphTextures: farMeshes.filter(mesh => mesh.morphTexture).length,
          morphTargets: farMeshes.reduce((count, mesh) => count + (mesh.geometry.morphAttributes.position?.length ?? 0), 0),
          triangles: farMeshes.map(mesh => (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3) } : null,
        native: window.__forestNativeTextures() };
      sample.problems = forestLifecycleProblems(sample);
      const key = JSON.stringify({ resources: forestResourceCounts(sample), ready: workersReady,
        request: forestWorker?.lastPost?.requestId, terrainRequest: terrainWorker?.lastPost?.requestId, problems: sample.problems });
      settled.current = { key, samples: key === settled.current.key ? settled.current.samples + 1 : 1 };
      sample.stableSamples = settled.current.samples;
      sample.ready = frames.current >= 48 && settled.current.samples >= 6 && sample.problems.length === 0;
      window.__forestLifecycle = sample;
    });
  });
  return null;
}

function App() {
  const [config, setConfig] = useState(initial), entry = sceneEntry(config.sceneId), target = sceneEntry(config.targetSceneId);
  const narrative = getJourneySceneForEntry(entry.id), route = guidedPathSegment(segments, entry.id, target.id);
  const pose = useMemo(() => reviewPose(entry, route), [entry, route]);
  const profile = useMemo(() => resolveEnvironmentalEffectsProfile(RENDER_QUALITY_PROFILES[config.quality], config.reduced), [config.quality, config.reduced]);
  window.__forestSet = patch => setConfig(current => ({ ...current, ...patch, revision: current.revision + 1 }));
  useLayoutEffect(() => {
    useJourneyStore.setState({ sceneId: config.sceneId, activeEntryId: entry.id, storyStarted: true, storyCompleted: false,
      worldFlags: { 'story-events.started': true, 'lantern.owned': true }, storyObjectStates: { 'lantern.master': 'carried' },
      inventory: { lantern: true, recoveredKeys: [], symbolicObjects: [] }, landmarkStates: {}, resonances: {}, releasedWords: [],
      history: [], witnessedEntryIds: [], completedSceneIds: [], completedChapterIds: [], completedRitualIds: ['ritual.accept-lantern'],
      completedStoryEventIds: [], storyPlacementStates: {} });
    useWorldStore.setState({ mode: 'explore', controls: 'none', physicsPaused: false });
    useSettingsStore.setState({ drawerOpen: false, cameraAssistance: false, reducedMotion: true,
      reducedEffects: config.reduced, audioEnabled: false });
  }, [config.sceneId, config.reduced, config.mounted, entry.id]);
  const memory = useMemo(() => ({ sceneId: config.sceneId, chapterId: narrative.chapterId,
    completedRitualIds: ['ritual.accept-lantern'], completedActs: [], completedChapterIds: [], completedSceneIds: [],
    landmarkStates: {}, worldFlags: { 'lantern.owned': true }, resonances: {},
    inventory: { lantern: true, recoveredKeys: [], symbolicObjects: [] }, releasedWords: [],
    storyStarted: true, storyCompleted: false }), [config.sceneId, narrative.chapterId]);
  return <Canvas dpr={1} shadows camera={{ fov: 62, near: .05, far: 900 }}
    gl={{ antialias: false, preserveDrawingBuffer: true }} onCreated={({ gl }) => {
      trackWorldTextures(gl); gl.toneMapping = THREE.ACESFilmicToneMapping; gl.outputColorSpace = THREE.SRGBColorSpace;
    }}>
    <Evidence config={config} entry={entry} target={target} route={route} pose={pose} profile={profile} />
    <Suspense fallback={null}>{config.mounted ? <Physics paused>
      <StorySceneWithMasterLantern entryId={entry.id} entries={entries} visuals={[]} controls="none" mode="explore"
        qualityProfile={profile} reducedEffects={config.reduced}
        narrativeWorldState={worldState} storyWorldMemory={memory} navigationTargetEntryId={target.id} narrativeAudioSuppressed />
    </Physics> : null}</Suspense>
  </Canvas>;
}
createRoot(document.getElementById('root')).render(<App />);
