import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { register } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";

register("./canonical-node-loader.mjs", import.meta.url);
const narrative = await import("../src/data/journeyNarrative.ts");
const lantern = await import("../src/lib/lanternNarrative.ts");
const navigation = await import("../src/lib/navigationResolver.ts");
const layout = await import("../src/lib/worldLayout.ts");
const { entries: canonicalEntries } = await import("../src/data/slipperContent.ts");
const entries = canonicalEntries.map(entry => ({ ...entry, title: `Memory title ${entry.id}` }));
const ids = entries.map(entry => entry.id);
const moduleCode = ts.transpileModule(readFileSync(new URL("../src/components/ui/ConstellationMap.tsx", import.meta.url), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

// The real TSX and canonical model/layout execute. Only host hooks and stores
// are bounded fixtures; no copied rendering algorithm or alternative model.
function renderMap(overrides = {}, props = {}) {
  let state = {
    activeEntryId: ids[0], chapterId: "broken-floor", sceneId: "broken-floor.confession",
    history: [], witnessedEntryIds: [], completedActs: [], completedRitualIds: [],
    completedChapterIds: [], completedSceneIds: [], worldFlags: {}, landmarkStates: {},
    resonances: { wolf: 0, swan: 0, seer: 0 }, inventory: { lantern: false, recoveredKeys: [], symbolicObjects: [] },
    releasedWords: [], storyStarted: true, storyCompleted: false, ...overrides,
  };
  const before = structuredClone(state), opened = [], guided = [], updates = [], captures = [], released = [];
  let refs = 0;
  const svg = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 420, height: 420 }),
    setPointerCapture: id => captures.push(id), hasPointerCapture: id => captures.includes(id),
    releasePointerCapture: id => released.push(id) };
  const host = (type, elementProps, key) => ({ type, props: elementProps, key });
  const store = select => select(state); store.getState = () => state;
  const imports = {
    "react/jsx-runtime": { jsx: host, jsxs: host },
    react: { useId: () => "map-title", useMemo: create => create(),
      useRef: current => ({ current: refs++ === 0 ? svg : current }),
      useState: initial => [initial, value => updates.push(value)] },
    "zustand/react/shallow": { useShallow: select => select },
    "../../data/journeyNarrative": narrative,
    "../../lib/lanternNarrative": lantern,
    "../../lib/navigationResolver": navigation,
    "../../lib/worldLayout": layout,
    "../../stores/useBreadcrumbStore": { useBreadcrumbStore: select => select({ traces: ids.map((id, index) => ({
      id: `trace-${id}`, activeEntryId: id, position: layout.entryWorldPosition(entries[index], entries),
      kind: "step", scale: 1, intensity: 1,
    })) }) },
    "../../stores/useJourneyStore": { useJourneyStore: store },
    "./ConstellationMap.css": {},
  };
  const exports = {};
  runInNewContext(moduleCode, { exports, require: name => {
    assert.ok(name in imports, `Unexpected actual map dependency ${name}`); return imports[name];
  } });
  const mapProps = { entries, activeEntryId: state.activeEntryId, visitedEntryIds: ids,
    onOpenEntry: id => opened.push(id), onGuideEntry: id => guided.push(id), ...props };
  const tree = exports.ConstellationMap(mapProps);
  assert.deepEqual(state, before, "Rendering or deriving a scoped model cannot mutate canonical progress");
  return { tree, state, opened, guided, updates, captures, released, svg,
    restore: next => { state = { ...state, ...next }; } };
}
function elements(tree) {
  if (tree === null || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(elements);
  return [tree, ...elements(tree.props?.children)];
}
function text(tree) {
  if (tree === null || tree === undefined || typeof tree === "boolean") return "";
  if (Array.isArray(tree)) return tree.map(text).join("");
  return typeof tree === "object" ? text(tree.props?.children) : String(tree);
}
const hasClass = (element, name) => (element.props?.className ?? "").split(" ").includes(name);
function namedNodes(tree) { return elements(tree).filter(element => hasClass(element, "constellation-node-button")); }
function rows(tree) { return elements(tree).filter(element => hasClass(element, "constellation-row")); }
function assertPrivate(tree, witnessed) {
  const output = text(tree), serialized = JSON.stringify(tree);
  for (const entry of entries.filter(entry => !witnessed.includes(entry.id))) {
    assert.equal(output.includes(entry.title), false, `Unwitnessed title leaked: ${entry.id}`);
    assert.equal(serialized.includes(entry.id), false, `Unwitnessed identifier leaked: ${entry.id}`);
  }
  const future = elements(tree).filter(element => hasClass(element, "constellation-unwitnessed-dot"));
  assert.equal(future.length, entries.length - witnessed.length);
  for (const dot of future) {
    assert.equal(dot.type, "circle");
    assert.deepEqual(Object.keys(dot.props).sort(), ["className", "cx", "cy", "r", "data-constellation-future", "aria-hidden"].sort());
    assert.equal(dot.props["data-constellation-future"], "true");
    assert.equal(dot.props["aria-hidden"], "true");
    assert.equal(typeof dot.key, "number");
  }
}

test("witnessed-only empty and merely visited/current/history/completed memories remain anonymous in every DOM branch", () => {
  const fixture = renderMap({ history: ids.slice(0, 12), completedChapterIds: narrative.journeyChapters.map(chapter => chapter.id),
    completedSceneIds: narrative.journeyScenes.map(scene => scene.id) }, { scope: "witnessed-only",
    sceneProximity: { activeEntryId: ids[0], navigationTargetId: ids[10], navigationTargetReason: "unread" } });
  assertPrivate(fixture.tree, []);
  assert.equal(namedNodes(fixture.tree).length, 0); assert.equal(rows(fixture.tree).length, 0);
  assert.equal(elements(fixture.tree).some(element => hasClass(element, "constellation-route-panel")), false);
  assert.equal(text(fixture.tree).includes("Guide me there"), false);
  assert.equal(text(fixture.tree).includes("Archive"), false);
  assert.deepEqual(fixture.opened, []); assert.deepEqual(fixture.guided, []);
});

test("sparse witnessed nodes retain exactly their earned edges/list/title/regions and never bridge an unwitnessed route", () => {
  const witnessed = [ids[0], ids[3], ids[7]], history = ids.slice(0, 10);
  const fixture = renderMap({ activeEntryId: ids[65], history, witnessedEntryIds: witnessed,
    completedChapterIds: narrative.journeyChapters.map(chapter => chapter.id),
    completedSceneIds: narrative.journeyScenes.map(scene => scene.id) }, { scope: "witnessed-only",
    sceneProximity: { activeEntryId: ids[65], navigationTargetId: ids[9], navigationTargetReason: "unread" } });
  assertPrivate(fixture.tree, witnessed);
  assert.equal(namedNodes(fixture.tree).length, witnessed.length); assert.equal(rows(fixture.tree).length, witnessed.length);
  assert.deepEqual(namedNodes(fixture.tree).map(node => node.props["data-constellation-entry-id"]).sort(), [...witnessed].sort());
  const model = lantern.buildStoryConstellationModel(fixture.state);
  const earnedEdges = model.edges.filter(edge => witnessed.includes(edge.sourceEntryId) && witnessed.includes(edge.targetEntryId));
  assert.equal(elements(fixture.tree).filter(element => hasClass(element, "constellation-link")).length, earnedEdges.length);
  for (const row of rows(fixture.tree)) row.props.onClick();
  assert.deepEqual([...fixture.opened].sort(), [...witnessed].sort()); assert.deepEqual(fixture.guided, []);
});

test("all66 witnessed memories remain keyboard-accessible in the list, with physical pan/zoom and active-node touch preserved", () => {
  const fixture = renderMap({ witnessedEntryIds: ids, history: ids.slice(0, -1) }, { scope: "witnessed-only" });
  assertPrivate(fixture.tree, ids); assert.equal(rows(fixture.tree).length, 66);
  const active = namedNodes(fixture.tree).find(element => element.props["aria-current"] === "location");
  assert.equal(active.props.tabIndex, 0);
  let prevented = 0;
  active.props.onKeyDown({ key: "Enter", preventDefault: () => prevented++ });
  active.props.onKeyDown({ key: " ", preventDefault: () => prevented++ }); active.props.onClick();
  assert.equal(prevented, 2); assert.deepEqual(fixture.opened, [ids[0], ids[0], ids[0]]);
  const svg = elements(fixture.tree).find(element => element.type === "svg");
  svg.props.onPointerDown({ target: { closest: () => null }, currentTarget: fixture.svg, pointerId: 4, clientX: 10, clientY: 10 });
  svg.props.onPointerMove({ pointerId: 4, clientX: 20, clientY: 25 });
  svg.props.onPointerUp({ pointerId: 4, currentTarget: fixture.svg });
  svg.props.onWheel({ preventDefault() {}, clientX: 100, clientY: 100, deltaY: -10000 });
  assert.deepEqual(fixture.captures, [4]); assert.deepEqual(fixture.released, [4]);
  assert.equal(fixture.updates.some(update => update?.scale === 3.4), true);
});

test("witnessed-only retained callbacks recheck current witnesses and readonly viewers cannot guide or open anything", () => {
  const fixture = renderMap({ witnessedEntryIds: [ids[0]] }, { scope: "witnessed-only" });
  const retained = rows(fixture.tree)[0].props.onClick;
  fixture.restore({ witnessedEntryIds: [] }); retained(); assert.deepEqual(fixture.opened, []); assert.deepEqual(fixture.guided, []);
  const readonly = renderMap({ witnessedEntryIds: [ids[0], ids[1]] }, { scope: "witnessed-only", onOpenEntry: undefined, onGuideEntry: undefined });
  for (const row of rows(readonly.tree)) { assert.equal(row.props.disabled, true); row.props.onClick(); }
  assert.deepEqual(readonly.opened, []); assert.deepEqual(readonly.guided, []);
});

test("omitted scope remains the existing full map, including unread guidance and its twelve-row limit", () => {
  const state = { history: ids.slice(0, 20), completedChapterIds: narrative.journeyChapters.map(chapter => chapter.id) };
  const props = { visitedEntryIds: [ids[0]], sceneProximity: { activeEntryId: ids[0], navigationTargetId: ids[9], navigationTargetReason: "unread" } };
  const implicit = renderMap(state, props), explicit = renderMap(state, { ...props, scope: "full" });
  assert.equal(implicit.tree.props["data-constellation-scope"], "full");
  assert.equal(text(implicit.tree), text(explicit.tree));
  assert.equal(rows(implicit.tree).length, 12);
  assert.equal(namedNodes(implicit.tree).length, namedNodes(explicit.tree).length);
  rows(implicit.tree).find(row => row.props["aria-label"].includes(entries[9].title)).props.onClick();
  assert.deepEqual(implicit.guided, [ids[9]]);
  namedNodes(implicit.tree).find(node => node.props["aria-current"] === "location").props.onClick();
  assert.deepEqual(implicit.opened, [ids[0]]);
});
