import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as THREE from "three";
import { memoryStarPosition, memoryGroundPosition } from "../src/lib/journeyMemoryProjection.ts";
import {
  JOURNEY_ENTRY_CONTEXT,
  JOURNEY_RITUAL_IDS,
  journeyChapters,
  journeyScenes,
} from "../src/data/journeyBlueprint.ts";
import {
  JOURNEY_CHAPTER_IDS,
  JOURNEY_HISTORY_LIMIT,
  JOURNEY_SCENE_IDS,
} from "../src/lib/storyJourneyState.ts";
import { sanitizeJourneySnapshot } from "../src/lib/journeySnapshot.ts";
import {
  buildStoryConstellationModel,
  isCompleteStoryConstellation,
  STORY_CONSTELLATION_ENTRY_COUNT,
} from "../src/lib/lanternNarrative.ts";

function constellationState(overrides = {}) {
  return {
    activeEntryId: "fragment-001",
    history: [],
    witnessedEntryIds: [],
    completedRitualIds: [],
    completedChapterIds: [],
    completedSceneIds: [],
    resonances: { wolf: 0, swan: 0, seer: 0 },
    releasedWords: [],
    landmarkStates: {},
    ...overrides,
  };
}

test("the initial constellation is one dim present point with no invented route", () => {
  const model = buildStoryConstellationModel(constellationState());

  assert.equal(model.isNearlyEmpty, true);
  assert.equal(model.nodes.length, 1);
  assert.equal(model.nodes[0].entryId, "fragment-001");
  assert.equal(model.nodes[0].witnessed, false);
  assert.equal(model.nodes[0].stage, "present");
  assert.equal(model.edges.length, 0);
  assert.deepEqual(model.routeEntryIds, ["fragment-001"]);
  assert.deepEqual(model.progress, {
    witnessedEntries: 0,
    completedRituals: 0,
    completedScenes: 0,
    completedChapters: 0,
    routeSteps: 0,
  });
});

test("travel edges reproduce actual history, including repeated crossings", () => {
  const model = buildStoryConstellationModel(constellationState({
    activeEntryId: "fragment-010",
    history: ["fragment-001", "fragment-008", "fragment-003", "fragment-008"],
    witnessedEntryIds: ["fragment-001"],
  }));

  assert.deepEqual(model.routeEntryIds, [
    "fragment-001",
    "fragment-008",
    "fragment-003",
    "fragment-008",
    "fragment-010",
  ]);
  assert.equal(model.nodes.length, 4);
  assert.equal(model.progress.routeSteps, 4);
  assert.equal(model.edges.length, 3);
  const repeated = model.edges.find((edge) =>
    new Set([edge.sourceEntryId, edge.targetEntryId]).has("fragment-003") &&
    new Set([edge.sourceEntryId, edge.targetEntryId]).has("fragment-008")
  );
  assert.ok(repeated);
  assert.equal(repeated.kind, "travel");
  assert.equal(repeated.traversalCount, 2);
});

test("ritual, resonance, release, and landmark state alter explicit model fields", () => {
  const model = buildStoryConstellationModel(constellationState({
    history: ["fragment-001"],
    activeEntryId: "fragment-002",
    witnessedEntryIds: ["fragment-001", "fragment-002"],
    completedRitualIds: ["ritual.accept-lantern"],
    completedSceneIds: ["broken-floor.confession"],
    resonances: { wolf: 60, swan: 30, seer: 90 },
    releasedWords: ["fear", "hope"],
    landmarkStates: { "landmark.first-wood-lantern": "awakened" },
  }));

  const ritualNode = model.nodes.find((node) => node.entryId === "fragment-001");
  assert.ok(ritualNode);
  assert.deepEqual(ritualNode.completedRitualIds, ["ritual.accept-lantern"]);
  assert.equal(ritualNode.landmarkState, "awakened");
  assert.equal(ritualNode.stage, "scene-complete");
  assert.deepEqual(model.resonance, { wolf: 60, swan: 30, seer: 90, energy: 0.6 });
  assert.equal(model.releasedWordCount, 2);
  assert.equal(model.releaseBloom, 2 / 7);
  assert.deepEqual(model.landmarkMemory, {
    activeCount: 1,
    transformedCount: 0,
    releasedCount: 0,
    strength: 0.24,
  });
  assert.equal(model.progress.completedRituals, 1);
  assert.equal(model.progress.completedScenes, 1);
  assert.equal(model.edges.some((edge) => edge.evidence.scene), true);
});

test("symbolic resonance, released words, and the protected Nest remain explicit visual data", () => {
  const nest = journeyChapters.find((chapter) => chapter.id === "nest");
  assert.ok(nest);
  const model = buildStoryConstellationModel(constellationState({
    activeEntryId: nest.entryIds.at(-1),
    history: nest.entryIds.slice(0, -1),
    witnessedEntryIds: nest.entryIds,
    completedChapterIds: ["nest"],
    resonances: { wolf: 62, swan: 48, seer: 77 },
    releasedWords: ["fear", "hope"],
  }));

  assert.deepEqual(
    model.resonanceNodes.map(({ id, label, strength, visible }) => ({ id, label, strength, visible })),
    [
      { id: "wolf", label: "Wolf", strength: 62, visible: true },
      { id: "swan", label: "Swan", strength: 48, visible: true },
      { id: "seer", label: "Seer", strength: 77, visible: true },
    ],
  );
  assert.ok(model.resonanceNodes.every((node) => node.intensity > 0.34));
  assert.deepEqual(model.releasedWords, ["fear", "hope"]);
  assert.deepEqual(model.protectedNest, {
    visible: true,
    protected: true,
    entryIds: nest.entryIds,
  });
});

test("the completed blueprint forms one connected 66-node authored constellation", () => {
  const entryIds = Object.keys(JOURNEY_ENTRY_CONTEXT);
  const model = buildStoryConstellationModel(constellationState({
    activeEntryId: entryIds.at(-1),
    witnessedEntryIds: entryIds,
    completedRitualIds: JOURNEY_RITUAL_IDS,
    completedChapterIds: JOURNEY_CHAPTER_IDS,
    completedSceneIds: JOURNEY_SCENE_IDS,
    resonances: { wolf: 74, swan: 81, seer: 69 },
    releasedWords: ["fear", "waiting", "permission"],
    landmarkStates: {
      "landmark.first-wood-lantern": "transformed",
      "landmark.mirror": "transformed",
      "landmark.fire-river": "released",
      "landmark.crowned-gate": "released",
    },
  }));

  assert.equal(STORY_CONSTELLATION_ENTRY_COUNT, 66);
  assert.equal(model.nodes.length, 66);
  assert.equal(model.chapters.length, 12);
  assert.equal(model.edges.length, 65, "the completed authored structure is a spanning route");
  assert.ok(model.nodes.every((node) => node.stage === "chapter-complete"));
  assert.equal(isCompleteStoryConstellation(model), true);

  const adjacency = new Map(model.nodes.map((node) => [node.entryId, []]));
  for (const edge of model.edges) {
    adjacency.get(edge.sourceEntryId).push(edge.targetEntryId);
    adjacency.get(edge.targetEntryId).push(edge.sourceEntryId);
  }
  const reached = new Set([model.nodes[0].entryId]);
  const queue = [model.nodes[0].entryId];
  while (queue.length > 0) {
    const current = queue.shift();
    for (const neighbor of adjacency.get(current)) {
      if (reached.has(neighbor)) continue;
      reached.add(neighbor);
      queue.push(neighbor);
    }
  }
  assert.equal(reached.size, 66);
  assert.equal(journeyChapters.length, 12);
  assert.equal(journeyScenes.length, 32);
});

test("a sanitized full journey plus revisits remains visible as the route actually walked", () => {
  const entryIds = Object.keys(JOURNEY_ENTRY_CONTEXT);
  const completeRouteWithRevisits = [
    ...entryIds,
    entryIds[7],
    entryIds[23],
    entryIds[7],
  ];
  const sanitized = sanitizeJourneySnapshot({
    schemaVersion: 2,
    activeEntryId: completeRouteWithRevisits.at(-1),
    history: completeRouteWithRevisits.slice(0, -1),
    visitedEntryIds: entryIds,
    witnessedEntryIds: entryIds,
    completedChapterIds: JOURNEY_CHAPTER_IDS,
    completedSceneIds: JOURNEY_SCENE_IDS,
  }, entryIds[0], entryIds);
  const model = buildStoryConstellationModel(constellationState(sanitized));

  assert.equal(JOURNEY_HISTORY_LIMIT, 512);
  assert.deepEqual(
    [...sanitized.history, sanitized.activeEntryId],
    completeRouteWithRevisits,
  );
  assert.deepEqual(model.routeEntryIds, completeRouteWithRevisits);
  assert.equal(model.progress.routeSteps, completeRouteWithRevisits.length - 1);
  assert.equal(model.nodes.length, 66);
  assert.equal(model.nodes.find((node) => node.entryId === entryIds[7])?.visitCount, 3);
});

test("the UI consumes the authored story model and does not classify archive keywords", () => {
  const source = readFileSync(
    new URL("../src/components/ui/ConstellationMap.tsx", import.meta.url),
    "utf8",
  );
  const finalTableau = readFileSync(
    new URL("../src/components/three/chapters/IntegratedFinalTableau.tsx", import.meta.url),
    "utf8",
  );
  const memorySource = readFileSync(new URL("../src/components/ui/ConstellationMap.tsx", import.meta.url), "utf8");
  assert.match(source, /deriveConstellationMemory\(\{ \.\.\.journeyState, activeEntryId \}\)/);
  assert.match(memorySource, /const canonical = buildStoryConstellationModel\(state\)/);
  assert.match(memorySource, /canonical\.nodes\.filter\(node => witnessed\.has\(node\.entryId\)\)/);
  assert.match(memorySource, /canonical\.edges\.filter\(edge => witnessed\.has\(edge\.sourceEntryId\) && witnessed\.has\(edge\.targetEntryId\)\)/);
  assert.match(source, /storyModel\.nodes\.map\(renderStoryNode\)/);
  assert.match(source, /storyModel\.edges\.map/);
  assert.match(source, /state\.witnessedEntryIds/);
  assert.match(source, /state\.completedRitualIds/);
  assert.match(source, /state\.completedChapterIds/);
  assert.match(source, /state\.completedSceneIds/);
  assert.match(source, /state\.resonances/);
  assert.match(source, /state\.releasedWords/);
  assert.match(source, /state\.landmarkStates/);
  assert.doesNotMatch(source, /entrySignal|classifyEntry|buildMazePathSegments/);
  assert.doesNotMatch(source, /entry\.tags|emotionalTone|sceneKind/);
  assert.match(source, /data-keyboard-landmark/);
  assert.match(source, /data-resonance-node=\{node\.id\}/);
  assert.match(source, /data-released-word=\{word\.word\}/);
  assert.match(source, /data-protected-nest=/);
  assert.match(finalTableau, /buildStoryConstellationModel/);
  // The archive retains detailed symbolic history; the in-world sky uses only
  // real witnessed locations and route edges, without extra symbolic satellites.
  assert.match(finalTableau, /witnessedNodes\.map\(\(node\) => memoryStarPosition\(node\.entryId\)\)/);
  assert.match(finalTableau, /for \(const entryId of model\.routeEntryIds\)/);
  assert.match(finalTableau, /if \(!witnessed\.has\(entryId\)\) \{ segment = null; continue; \}/);
  assert.match(finalTableau, /segment\.push\(memoryStarPosition\(entryId\)\)/);
  assert.doesNotMatch(finalTableau, /RESONANCE_SKY_OFFSETS|ConstellationProtectedNest|ReleasedWordConstellation/);
  assert.match(finalTableau, /name="constellation-formation-reveal"/);
  assert.match(finalTableau, /const formationReady = \(lanternPlaced && \(!eventDriven \|\| reverseComplete\)\) \|\| storyCompleted/);
  assert.match(finalTableau, /formationReady=\{formationReady\}/);
  assert.match(finalTableau, /formationMode: reducedMotion \? "immediate" : "gradual"/);
  assert.match(finalTableau, /beginsAfter: "lantern-placement-or-story-completion"/);
  assert.match(
    finalTableau,
    /THREE\.MathUtils\.damp\([\s\S]{0,120}formationProgressRef\.current,[\s\S]{0,80}target/,
  );
});

// Exercise the real TSX render branches and frame callback without a WebGL
// context. React/R3F host hooks are bounded stubs; all model/geometry/math code is real.
const finaleModuleCode = ts.transpileModule(readFileSync(new URL(
  "../src/components/three/chapters/IntegratedFinalTableau.tsx", import.meta.url,
), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;

function finaleFixture(overrides = {}, props = {}) {
  const entryIds = journeyChapters.flatMap(chapter => chapter.entryIds);
  const state = {
    ...constellationState({ activeEntryId: entryIds.at(-1), history: entryIds, witnessedEntryIds: entryIds }),
    worldFlags: { "story-events.started": true, "lantern.placed-and-lit": true },
    storyObjectStates: { "epilogue.reverse-light": "running" },
    storyPlacementStates: { "lantern.master": "window" },
    storyCompleted: false,
    ...overrides,
  };
  const frames = [], cleanups = [], exports = {};
  const hostElement = (type, props) => ({ type, props });
  const imports = {
    "react/jsx-runtime": { jsx: hostElement, jsxs: hostElement },
    react: {
      memo: component => component,
      useMemo: create => create(),
      useRef: current => ({ current }),
      useEffect: effect => { const cleanup = effect(); if (cleanup) cleanups.push(cleanup); },
    },
    "@react-three/fiber": { useFrame: callback => frames.push(callback) },
    three: THREE,
    "../../../data/journeyNarrative.ts": { JOURNEY_ENTRY_CONTEXT, journeyChapters },
    "../../../lib/lanternNarrative.ts": { buildStoryConstellationModel },
    "../../../lib/journeyMemoryProjection": { memoryStarPosition },
    "../../../stores/useJourneyStore": { useJourneyStore: select => select(state) },
    "../artDirection/LegacyChapterLight": { LegacyChapterLight: "LegacyChapterLight" },
    "../environment/WoodlandDetails": { FinalWoodlandDetails: "FinalWoodlandDetails" },
    "../environment/ChapterLightRig": { ChapterLightRig: "ChapterLightRig" },
    "../storyEvents/ReverseMemoryLights": { ReverseMemoryLights: "ReverseMemoryLights" },
    "./ChapterPrimitives": { LanternProp: "LanternProp", SceneGround: "SceneGround", qualityStep: () => 2 },
  };
  runInNewContext(finaleModuleCode, {
    exports,
    require: id => { assert.ok(id in imports, `unmocked finale host dependency: ${id}`); return imports[id]; },
  });
  const tree = exports.IntegratedFinalTableau({
    qualityProfile: { quality: "high" }, reducedEffects: false, reducedMotion: false, ...props,
  });
  return { tree, frames, cleanups };
}

function sceneElements(tree) {
  if (!tree || typeof tree !== "object") return [];
  return [tree, ...[tree.props?.children].flat().flatMap(sceneElements)];
}

function constellationElement(tree) {
  return sceneElements(tree).find(element => element.type?.name === "WitnessedMemoryConstellation");
}

test("the real finale render keeps remembered places until its existing formation gate opens", () => {
  const cases = [
    { state: {}, ready: false, reverse: true },
    { state: { storyObjectStates: { "epilogue.reverse-light": "complete" } }, ready: true, reverse: false },
    { state: { worldFlags: { "story-events.started": true }, storyObjectStates: { "epilogue.reverse-light": "complete" } }, ready: false, reverse: true },
    { state: { worldFlags: {}, completedRitualIds: ["ritual.place-lantern"] }, ready: true, reverse: false },
    { state: { worldFlags: {}, storyCompleted: true, storyObjectStates: {} }, ready: true, reverse: false },
  ];
  for (const { state, ready, reverse } of cases) {
    const { tree } = finaleFixture(state);
    assert.equal(constellationElement(tree).props.formationReady, ready);
    assert.equal(sceneElements(tree).some(element => element.type === "ReverseMemoryLights"), reverse);
  }
  for (const placement of ["reading-nook", "fountain", "window", "threshold"]) {
    const { tree } = finaleFixture({ storyPlacementStates: { "lantern.master": placement } });
    const placed = sceneElements(tree).find(element => element.props?.name === "placed-lit-lantern-continuity");
    const lantern = sceneElements(placed).find(element => element.type === "LanternProp");
    const ground = sceneElements(tree).find(element => element.type === "SceneGround");
    assert.equal(placed.props.userData.placementId, placement);
    assert.equal(placed.props.position[1] + lantern.props.position[1], ground.props.y, "every continuity light rests on the actual ground plane");
    assert.equal(lantern.props.light, false, "the continuity prop adds no competing light source");
  }
});

test("the rendered sky contains only real witnessed positions and route crossings, with bounded buffers", () => {
  const ids = journeyChapters.flatMap(chapter => chapter.entryIds);
  const history = [ids[0], ids[5], ids[1], ids[5], ids[9]];
  const fixture = finaleFixture({ activeEntryId: ids[9], history, witnessedEntryIds: history });
  const constellation = constellationElement(fixture.tree);
  const sky = constellation.type(constellation.props);
  const elements = sceneElements(sky);
  const points = elements.filter(element => element.type === "points");
  const lines = elements.find(element => element.type === "lineSegments");
  assert.equal(points.length, 2, "one witnessed batch and one keystone accent batch, no symbolic stars");
  const witnessed = constellation.props.model.nodes.filter(node => node.witnessed);
  const expected = new Float32Array(witnessed.flatMap(node => memoryStarPosition(node.entryId)));
  assert.deepEqual(points[0].props.geometry.getAttribute("position").array, expected);
  assert.equal(points[0].props.geometry.getAttribute("position").count, new Set(history).size);
  const route = constellation.props.model.routeEntryIds.map(memoryStarPosition);
  const segments = route.slice(1).flatMap((point, index) => [...route[index], ...point]);
  assert.deepEqual(lines.props.geometry.getAttribute("position").array, new Float32Array(segments));
  assert.equal(lines.props.geometry.getAttribute("position").count, (history.length - 1) * 2);
  const geometries = [...points.map(point => point.props.geometry), lines.props.geometry];
  let disposed = 0;
  geometries.forEach(geometry => geometry.addEventListener("dispose", () => disposed++));
  fixture.cleanups.forEach(cleanup => cleanup());
  assert.equal(disposed, 3, "all retained sky buffers have an explicit cleanup owner");
});

test("the actual formation callback keeps gradual timing, capped frame delta and reduced-motion completion", () => {
  for (const reducedMotion of [false, true]) {
    let completions = 0;
    const fixture = finaleFixture({ storyObjectStates: { "epilogue.reverse-light": "complete" } }, {
      reducedMotion, onFinalConstellationFormationComplete: () => completions++,
    });
    const constellation = constellationElement(fixture.tree);
    const sky = constellation.type(constellation.props);
    const formation = sceneElements(sky).find(element => element.props?.name === "constellation-formation-reveal");
    const group = new THREE.Group();
    formation.props.ref.current = group;
    assert.equal(fixture.frames.length, 1);
    const advance = fixture.frames[0];
    advance({}, 100);
    assert.equal(completions, reducedMotion ? 1 : 0, "a stalled frame must not skip the gradual reveal");
    if (!reducedMotion) {
      for (let i = 0; i < 60; i++) advance({}, 1 / 60);
      assert.equal(completions, 0, "normal reveal is not shortened to one second");
      for (let i = 0; i < 240; i++) advance({}, 1 / 60);
    }
    assert.equal(completions, 1);
    assert.equal(group.userData.formationComplete, true);
    assert.ok(group.userData.formationProgress >= .995);
    for (let i = 0; i < 60; i++) advance({}, 1 / 60);
    assert.equal(completions, 1, "the parent receives one completion callback for this formation");
    fixture.cleanups.forEach(cleanup => cleanup());
  }
});

test("the actual sky hierarchy composes the unchanged route visibly on desktop and mobile without warping", () => {
  const fixture = finaleFixture({ storyObjectStates: { "epilogue.reverse-light": "complete" } }, { reducedMotion: true });
  const constellation = constellationElement(fixture.tree);
  const sky = constellation.type(constellation.props);
  let routeMatrix, routePositions;
  function visit(element, parentMatrix = new THREE.Matrix4()) {
    if (!element || typeof element !== "object") return;
    const props = element.props ?? {}, object = new THREE.Object3D();
    if (props.position) object.position.fromArray(props.position);
    if (props.rotation) object.rotation.set(...props.rotation);
    if (typeof props.scale === "number") object.scale.setScalar(props.scale);
    else if (props.scale) object.scale.fromArray(props.scale);
    object.updateMatrix();
    const worldMatrix = parentMatrix.clone().multiply(object.matrix);
    if (props.name === "constellation-actual-walked-route") {
      routeMatrix = worldMatrix;
      routePositions = props.geometry.getAttribute("position");
    }
    [props.children].flat().forEach(child => visit(child, worldMatrix));
  }
  visit(sky);
  assert.ok(routeMatrix && routePositions, "measure the real rendered route and its full transform hierarchy");
  const original = Array.from({ length: routePositions.count }, (_, index) => new THREE.Vector3().fromBufferAttribute(routePositions, index));
  const presented = original.map(point => point.clone().applyMatrix4(routeMatrix));
  const lengths = [0, 1, 2].map(axis => new THREE.Vector3().setFromMatrixColumn(routeMatrix, axis).length());
  assert.ok(lengths[0] >= 1.5 && lengths[0] <= 1.6, "bounded presentation scale");
  lengths.forEach(length => assert.ok(Math.abs(length - lengths[0]) < 1e-12, "every spatial axis has the same scale"));
  const center = new THREE.Vector3(0, 9.6, -20);
  assert.ok(center.clone().applyMatrix4(routeMatrix).distanceTo(center) < 1e-12, "the route rotates around its existing formation center");
  for (let index = 1; index < original.length; index += 2) {
    assert.ok(Math.abs(presented[index].distanceTo(presented[index - 1]) - original[index].distanceTo(original[index - 1]) * lengths[0]) < 1e-10, "each actual route segment preserves its proportions");
  }
  for (const [width, height] of [[1100, 720], [393, 851], [851, 393]]) {
    const camera = new THREE.PerspectiveCamera(65, width / height, .05, 180);
    camera.position.set(0, 1.65, 6.5);
    camera.lookAt(0, 4.8, -15);
    camera.updateMatrixWorld();
    const projected = presented.map(point => point.clone().project(camera));
    assert.ok(projected.every(point => Math.abs(point.x) < .9 && Math.abs(point.y) < .9 && Math.abs(point.z) < 1), `${width}×${height}: complete route remains inside the camera with a margin`);
    const xSpan = (Math.max(...projected.map(point => point.x)) - Math.min(...projected.map(point => point.x))) * width / 2;
    const ySpan = (Math.max(...projected.map(point => point.y)) - Math.min(...projected.map(point => point.y))) * height / 2;
    assert.ok(xSpan / ySpan > .5 && xSpan / ySpan < .7, "the actual narrow map reads as a diagonal sky route, not a vertical strip");
    assert.ok(xSpan > height * .17 && ySpan > height * .29, "the sky route occupies the freed focal space");
  }
  fixture.cleanups.forEach(cleanup => cleanup());
});

test("the actual finale route never bridges an unwitnessed memory between earned places", () => {
  const ids = journeyChapters.flatMap(chapter => chapter.entryIds);
  const history = [ids[0], ids[1], ids[2], ids[3], ids[4], ids[0]];
  const fixture = finaleFixture({ activeEntryId: ids[0], history, witnessedEntryIds: [ids[0], ids[2], ids[3]] });
  const owner = constellationElement(fixture.tree), sky = owner.type(owner.props);
  const elements = sceneElements(sky), points = elements.filter(element => element.type === "points");
  const line = elements.find(element => element.type === "lineSegments");
  assert.equal(points[0].props.geometry.getAttribute("position").count, 3);
  assert.deepEqual(line.props.geometry.getAttribute("position").array, new Float32Array([
    ...memoryStarPosition(ids[2]), ...memoryStarPosition(ids[3]),
  ]));
  assert.equal(elements.find(element => element.props?.name === "witnessed-memory-constellation").props.userData.routeStepCount, 1);
  fixture.cleanups.forEach(cleanup => cleanup());
});

test("the same actual sky buffers begin on the remembered forest geography and rise with the existing clock", () => {
  const fixture = finaleFixture({ storyObjectStates: { "epilogue.reverse-light": "complete" } });
  const owner = constellationElement(fixture.tree), sky = owner.type(owner.props), elements = sceneElements(sky);
  const formation = elements.find(element => element.props?.name === "constellation-formation-reveal");
  const points = elements.find(element => element.type === "points");
  const array = points.props.geometry.getAttribute("position"), original = Array.from(array.array);
  const group = new THREE.Group();formation.props.ref.current = group;
  const center = new THREE.Vector3(0, 9.6, -20), advance = fixture.frames[0];
  advance({}, 0);group.updateMatrix();
  for(const node of owner.props.model.nodes.filter(node => node.witnessed)) {
    const skyPoint = new THREE.Vector3(...memoryStarPosition(node.entryId));
    const ground = new THREE.Vector3(...memoryGroundPosition(node.entryId));
    const presented = skyPoint.clone().sub(center).applyMatrix4(group.matrix);
    assert.ok(Math.abs(presented.x-ground.x)<1e-10);
    assert.ok(Math.abs(presented.z-ground.z)<1e-10);
    assert.ok(Math.abs(presented.y-(.35+skyPoint.z+20))<1e-10,"authored altitude remains a small local depth variation");
  }
  const firstHeight=group.position.y;
  for(let i=0;i<54;i++)advance({},1/60);
  assert.ok(group.position.y>firstHeight&&group.position.y<9.6);
  assert.ok(group.rotation.x<0&&group.rotation.x>-Math.PI/2);
  assert.deepEqual(Array.from(array.array),original,"the reveal updates the existing group, not point-buffer uploads");
  assert.equal(array.version,0);assert.equal(fixture.frames.length,1);
  fixture.cleanups.forEach(cleanup => cleanup());
});
