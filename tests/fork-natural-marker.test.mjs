import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { JOURNEY_ENTRY_PROGRESS, journeyScenes } from "../src/data/journeyBlueprint.ts";
import { createFreshStoryJourneyState } from "../src/lib/storyJourneyState.ts";
import { STORY_OBJECT_DEFINITIONS, isSceneStoryComplete } from "../src/storyEvents/storyEventRegistry.ts";
import { dispatchStoryEventState } from "../src/storyEvents/storyEventState.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = join(root, "tests/fixtures/fork-natural-marker-baseline");
const receipt = JSON.parse(readFileSync(join(fixtures, "provenance.json"), "utf8"));
const require = createRequire(import.meta.url), ts = require("typescript"), THREE = require("three"), jsx = require("react/jsx-runtime");
const stub = new Proxy({}, { get: (_, name) => String(name) });
const source = (name, before = false) => readFileSync(before ? join(fixtures, name) : join(root, receipt.files.find(row => row.fixture === name).path), "utf8");
function evaluate(body, dependencies = {}, cleanups = []) {
  const exports = {};
  const react = { memo: fn => fn, useMemo: fn => fn(), useRef: value => ({ current: value }), useEffect: fn => { const cleanup = fn(); if (cleanup) cleanups.push(cleanup); } };
  const localRequire = name => dependencies[name] ?? (name === "react" ? react : name === "react/jsx-runtime" ? jsx : name === "three" ? THREE : stub);
  const js = ts.transpileModule(body, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  runInNewContext(js, { exports, require: localRequire }, { timeout: 1000 });
  return exports;
}
const load = before => evaluate(source("StoryObjectModel.tsx", before)).StoryObjectModel;
const json = value => JSON.parse(JSON.stringify(value));
const children = tree => (Array.isArray(tree.props.children) ? tree.props.children : [tree.props.children]).filter(Boolean);
const render = (before, props = {}) => load(before)({ kind: "marker", objectId: "fork.mark", ...props });
const actualArt = evaluate(readFileSync(join(root, "src/components/three/environmentArt/authoredGeometry.ts"), "utf8"), {
  "three/examples/jsm/utils/BufferGeometryUtils.js": require("three/examples/jsm/utils/BufferGeometryUtils.js"),
});
const actualChapter = evaluate(readFileSync(join(root, "src/components/three/chapters/chapterArtGeometry.ts"), "utf8"), {
  "../environmentArt/authoredGeometry.ts": actualArt,
  "three/examples/jsm/utils/BufferGeometryUtils.js": require("three/examples/jsm/utils/BufferGeometryUtils.js"),
});
function geometryFor(element) {
  if (element.type === "TimberAssembly") return actualChapter.createConstructionGeometry(element.props.pieces);
  assert.equal(element.type, "TimberPiece");
  return actualArt.createWornTimberGeometry(element.props.size, element.props.seed);
}
function meshesFor(tree) {
  const group = new THREE.Group(); group.rotation.set(...tree.props.rotation); if (tree.props.position) group.position.fromArray(tree.props.position);
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  for (const element of children(tree)) {
    const mesh = new THREE.Mesh(geometryFor(element), material);
    if (element.props.position) mesh.position.set(...element.props.position);
    if (element.props.rotation) mesh.rotation.set(...element.props.rotation);
    group.add(mesh);
  }
  group.updateMatrixWorld(true);
  return { group, dispose() { group.children.forEach(mesh => mesh.geometry.dispose()); material.dispose(); } };
}

test("frozen originals identify the two changed visual owners", () => {
  for (const row of receipt.files) assert.equal(createHash("sha256").update(source(row.fixture, true)).digest("hex"), row.sha256);
});

test("only the world model gains the existing object identity; pose, carry, focus and input remain exact", () => {
  const oldSource = source("StoryEventDirector.tsx", true), next = source("StoryEventDirector.tsx");
  assert.equal(next.replace("<StoryObjectModel objectId={object.id} kind={object.kind}", "<StoryObjectModel kind={object.kind}"), oldSource);
  assert.equal((next.match(/objectId=\{object.id\} kind=/g) ?? []).length, 1);
});

test("Fire and every non-Fork model retain their complete rendered tree", () => {
  const kinds = [...new Set(STORY_OBJECT_DEFINITIONS.map(object => object.kind))], before = load(true), after = load(false);
  for (const kind of kinds) for (const state of [undefined, "idle", "carried", "burned", "erased", "open", "integrated"]) {
    const props = { kind, state, reducedMotion: true, objectId: kind === "marker" ? "fire.old-marker" : undefined };
    assert.deepEqual(json(after(props)), json(before(props)), `${kind}/${state}`);
  }
  assert.deepEqual(json(render(false, { objectId: undefined })), json(render(true, { objectId: undefined })));
});

test("Fork retains three primary meshes, six timber parts and the exact original attribute/triangle budgets", () => {
  for (const state of ["idle", "erased"]) {
    const before = meshesFor(render(true, { state })), after = meshesFor(render(false, { state }));
    try {
      assert.equal(after.group.children.length, before.group.children.length);
      assert.equal(after.group.children.length, state === "erased" ? 2 : 3);
      let triangles = 0;
      for (let i = 0; i < after.group.children.length; i++) {
        const a = before.group.children[i].geometry, b = after.group.children[i].geometry;
        assert.equal(b.index.count, a.index.count);
        assert.deepEqual(Object.keys(b.attributes), Object.keys(a.attributes));
        for (const name of Object.keys(a.attributes)) {
          assert.equal(b.attributes[name].array.byteLength, a.attributes[name].array.byteLength, name);
          assert.ok([...b.attributes[name].array].every(Number.isFinite), name);
        }
        triangles += b.index.count / 3;
      }
      assert.equal(triangles, state === "erased" ? 300 : 360);
    } finally { before.dispose(); after.dispose(); }
  }
});

test("the replacement is low, asymmetric, connected and seated against actual SceneGround triangles at the unchanged interaction origin", () => {
  const tree = render(false), owner = meshesFor(tree);
  try {
    const box = new THREE.Box3().setFromObject(owner.group, true), size = box.getSize(new THREE.Vector3());
    const primitives = evaluate(readFileSync(join(root, "src/components/three/chapters/ChapterPrimitives.tsx"), "utf8"));
    const groundTree = primitives.SceneGround({ radius: 42, color: "#26241b" });
    const circle = groundTree.props.children.find(node => node.type === "circleGeometry");
    const groundMesh = new THREE.Mesh(new THREE.CircleGeometry(...circle.props.args), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    groundMesh.position.fromArray(groundTree.props.position); groundMesh.rotation.set(...groundTree.props.rotation); groundMesh.updateMatrixWorld(true);
    try {
      const bodyMesh = owner.group.children[0], positions = bodyMesh.geometry.attributes.position;
      const contactByPart = [Infinity, Infinity, Infinity];
      for (let i = 0; i < positions.count; i++) {
        const point = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(bodyMesh.matrixWorld).add(new THREE.Vector3(3, .4, 4));
        const ray = new THREE.Raycaster(new THREE.Vector3(point.x, point.y + 2, point.z), new THREE.Vector3(0, -1, 0));
        const hit = ray.intersectObject(groundMesh)[0]; assert.ok(hit, "actual chapter ground supports every body vertex");
        const part = Math.floor(i / 52); contactByPart[part] = Math.min(contactByPart[part], point.y - hit.point.y);
      }
      assert.ok(contactByPart.every(clearance => clearance <= -.005 && clearance >= -.04), "each existing piece seats 5–40mm in the actual rendered ground");
    } finally { groundMesh.geometry.dispose(); groundMesh.material.dispose(); }
    assert.ok(box.max.y + .4 < .47, "the assembly has no upright post");
    assert.ok(size.x > size.y * 2, "horizontal fallen form");
    assert.ok(size.x < 1.3 && size.z < .7, `bounded beside the original point target: ${size.toArray()}`);
    const body = children(tree)[0].props.pieces, boxes = body.map(piece => {
      const geometry = actualChapter.createConstructionGeometry([piece]);
      const bounds = geometry.boundingBox.clone(); geometry.dispose(); return bounds;
    });
    assert.ok(boxes[0].intersectsBox(boxes[1]) && boxes[0].intersectsBox(boxes[2]), "both short shoulders join the main wood");
    assert.notDeepEqual(json(body[1].size), json(body[2].size), "the shoulders are not a manufactured symmetric board");
    assert.ok(body.every(piece => piece.size[0] > piece.size[1]), "no narrow vertical support");
  } finally { owner.dispose(); }
});

test("the visible abrasion lies within millimetres of the actual exposed wood face and disappears on wipe", () => {
  const tree = render(false), parts = children(tree), scrape = parts[2];
  const geometry = geometryFor(parts[0]), material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), mesh = new THREE.Mesh(geometry, material);
  try {
    const ray = new THREE.Raycaster(new THREE.Vector3(scrape.props.position[0], scrape.props.position[1], -1), new THREE.Vector3(0, 0, 1));
    const hit = ray.intersectObject(mesh)[0]; assert.ok(hit);
    assert.ok(Math.abs(hit.point.z - scrape.props.position[2]) < .004, "abrasion is against the real face");
    assert.ok(scrape.props.size[0] >= .3 && scrape.props.size[1] >= .03, "bounded but legible scrape");
    assert.equal(children(render(false, { state: "erased" })).length, 2);
    const model = load(false);
    assert.equal(children(model({ kind: "marker", objectId: "fork.mark" }))[0].props.pieces, children(model({ kind: "marker", objectId: "fork.mark", state: "erased" }))[0].props.pieces, "constant geometry input");
  } finally { geometry.dispose(); material.dispose(); }
});

test("existing committed geometry owners keep one cleanup each and no new frame or effect hook is introduced", () => {
  const cleanup = [], chapter = evaluate(readFileSync(join(root, "src/components/three/chapters/ChapterArt.tsx"), "utf8"), { "./chapterArtGeometry": actualChapter }, cleanup);
  const environment = evaluate(readFileSync(join(root, "src/components/three/environmentArt/EnvironmentArt.tsx"), "utf8"), { "./authoredGeometry.ts": actualArt }, cleanup);
  const meshes = children(render(false)).map(element => element.type === "TimberAssembly" ? chapter.TimberAssembly(element.props) : environment.TimberPiece(element.props));
  const disposed = meshes.map(() => 0);
  meshes.forEach((mesh, i) => mesh.props.geometry.addEventListener("dispose", () => disposed[i]++));
  cleanup.forEach(fn => fn()); assert.deepEqual(json(disposed), [1, 1, 1]);
  for (const hook of ["useFrame", "useEffect", "useMemo", "useRef"]) assert.equal((source("StoryObjectModel.tsx").match(new RegExp(`${hook}\\(`, "g")) ?? []).length, (source("StoryObjectModel.tsx", true).match(new RegExp(`${hook}\\(`, "g")) ?? []).length, hook);
});

test("the actual Fork reducer still requires departure, keeps its physical wipe target and erases only the obsolete mark", () => {
  const definition = STORY_OBJECT_DEFINITIONS.find(object => object.id === "fork.mark");
  assert.equal(definition.label, "Obsolete path mark"); assert.equal(definition.kind, "marker");
  assert.deepEqual(definition.localPosition, [3, .4, 4]); assert.equal(definition.radius, 2.2);
  assert.deepEqual(definition.verbs, ["wipe"]); assert.deepEqual(definition.sceneIds, ["fork.four-verbs"]); assert.ok(!definition.carryable);
  const scene = journeyScenes.find(item => item.id === "fork.four-verbs");
  let state = { ...createFreshStoryJourneyState({ fallbackEntryId: "fragment-001", entryProgress: JOURNEY_ENTRY_PROGRESS }), sceneId: scene.id, activeEntryId: scene.keystoneEntryId, chapterId: scene.chapterId };
  const send = (trigger, objectId, targetId) => dispatchStoryEventState(state, { sceneId: state.sceneId, trigger, objectId, targetId });
  assert.deepEqual(send("wipe", "fork.mark").eventIds, []);
  for (const [trigger, objectId, targetId] of [["pickup", "fork.token"], ["release", "fork.token", "fork.current"], ["close", "fork.door"]]) state = send(trigger, objectId, targetId).state;
  assert.deepEqual(send("wipe", "fork.mark").eventIds, []);
  state = send("volume-exit", "fork.door").state;
  assert.equal(isSceneStoryComplete(state, scene.id), false);
  const result = send("wipe", "fork.mark");
  assert.deepEqual(result.eventIds, ["fork.deleted"]); assert.equal(result.state.storyObjectStates["fork.mark"], "erased");
  assert.equal(result.state.worldFlags["fork.deleted"], true);
  assert.ok(result.actions.some(action => action.type === "environment" && action.cue === "clearer-air"));
  assert.equal(isSceneStoryComplete(result.state, scene.id), true);
});
