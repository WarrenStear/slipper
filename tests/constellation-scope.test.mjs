import assert from "node:assert/strict";
import test, { after, afterEach } from "node:test";
import { register } from "node:module";
register("./canonical-node-loader.mjs", import.meta.url);
register("./quiet-tsx-loader.mjs", import.meta.url);
import { mount, text as committedText } from "./ui-owner-harness.mjs";
const oldWindow = globalThis.window;
globalThis.window = Object.assign(new EventTarget(), { localStorage: { getItem(){return null;},setItem(){},removeItem(){} },
  location: { search: "", pathname: "/" }, matchMedia: () => ({ matches: false }) });
after(() => { globalThis.window = oldWindow; });
let activeCpu;
afterEach(() => { activeCpu?.unmount(); activeCpu = null; });
const narrative = await import("../src/data/journeyNarrative.ts");
const lantern = await import("../src/lib/lanternNarrative.ts");
const layout = await import("../src/lib/worldLayout.ts");
const { useJourneyStore } = await import("../src/stores/useJourneyStore.ts");
const { useBreadcrumbStore } = await import("../src/stores/useBreadcrumbStore.ts");
const { useSettingsStore } = await import("../src/stores/useSettingsStore.ts");
const { ConstellationMap } = await import("../src/components/ui/ConstellationMap.tsx");
const { entries: canonicalEntries } = await import("../src/data/slipperContent.ts");
const entries = canonicalEntries.map(entry => ({ ...entry, title: `Memory title ${entry.id}` }));
const ids = entries.map(entry => entry.id);

// The actual React owner, canonical model/layout and Zustand state execute.
// The CPU host supplies only DOM geometry, pointer capture and ordered commits.
function renderMap(overrides = {}, props = {}) {
  useJourneyStore.setState({ activeEntryId: ids[0], chapterId: "broken-floor", sceneId: "broken-floor.confession",
    history: [], visitedEntryIds: ids, witnessedEntryIds: [], completedActs: [], completedRitualIds: [],
    completedChapterIds: [], completedSceneIds: [], worldFlags: {}, landmarkStates: {},
    resonances: { wolf: 0, swan: 0, seer: 0 }, inventory: { lantern: false, recoveredKeys: [], symbolicObjects: [] },
    releasedWords: [], storyStarted: true, storyCompleted: false, ...overrides });
  useSettingsStore.setState({ reducedMotion: false });
  useBreadcrumbStore.setState({ traces: ids.map((id, index) => ({ id: `trace-${id}`, activeEntryId: id,
    position: layout.entryWorldPosition(entries[index], entries), kind: "step", scale: 1, intensity: 1 })) });
  const opened = [], guided = [], before = useJourneyStore.getState().getSnapshot();
  const cpu = mount(ConstellationMap, { entries, activeEntryId: useJourneyStore.getState().activeEntryId, visitedEntryIds: ids,
    onOpenEntry: id => opened.push(id), onGuideEntry: id => guided.push(id), ...props });
  activeCpu = cpu;
  assert.deepEqual(useJourneyStore.getState().getSnapshot(), before, "Rendering or deriving a scoped model cannot mutate canonical progress");
  return { get tree(){return cpu.container.children[0];}, get state(){return useJourneyStore.getState();}, opened, guided,
    get svg(){return cpu.elements().find(element => element.type === "svg");},
    get captures(){return this.svg.captures;}, get released(){return this.svg.released;},
    act: cpu.act, restore: next => cpu.act(() => useJourneyStore.setState(next)),
    unmount(){cpu.unmount();if(activeCpu===cpu)activeCpu=null;} };
}
function elements(tree) { return tree ? [tree, ...(tree.children ?? []).flatMap(elements)] : []; }
function text(tree) { return committedText(tree); }
const hasClass = (element, name) => (element.props?.className ?? "").split(" ").includes(name);
function namedNodes(tree) { return elements(tree).filter(element => hasClass(element, "constellation-node-button")); }
function rows(tree) { return elements(tree).filter(element => hasClass(element, "constellation-row")); }
function assertPrivate(tree, witnessed) {
  const output = text(tree);
  for (const entry of entries.filter(entry => !witnessed.includes(entry.id))) {
    assert.equal(output.includes(entry.title), false, `Unwitnessed title leaked: ${entry.id}`);
  }
  const future = elements(tree).filter(element => hasClass(element, "constellation-unwitnessed-dot"));
  assert.equal(future.length, entries.length - witnessed.length);
  for (const dot of future) {
    assert.equal(dot.type, "circle");
    for (const prop of ["role", "tabIndex", "aria-label", "data-constellation-entry-id"]) assert.equal(dot.props[prop], undefined);
    assert.equal(dot.props["data-constellation-future"], "true");
    assert.equal(dot.props["aria-hidden"], "true");
    assert.equal(elements(dot).some(element => element.type === "title" || element.type === "button"), false);
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
  for (const row of rows(fixture.tree)) fixture.act(() => row.props.onClick());
  assert.deepEqual([...fixture.opened].sort(), [...witnessed].sort()); assert.deepEqual(fixture.guided, []);
});

test("all66 witnessed memories remain keyboard-accessible in the list, with physical pan/zoom and active-node touch preserved", () => {
  const fixture = renderMap({ witnessedEntryIds: ids, history: ids.slice(0, -1) }, { scope: "witnessed-only" });
  assertPrivate(fixture.tree, ids); assert.equal(rows(fixture.tree).length, 66);
  const active = namedNodes(fixture.tree).find(element => element.props["aria-current"] === "location");
  assert.equal(active.props.tabIndex, 0);
  let prevented = 0;
  fixture.act(() => active.props.onKeyDown({ key: "Enter", preventDefault: () => prevented++ }));
  fixture.act(() => active.props.onKeyDown({ key: " ", preventDefault: () => prevented++ })); fixture.act(() => active.props.onClick());
  assert.equal(prevented, 2); assert.deepEqual(fixture.opened, [ids[0], ids[0], ids[0]]);
  const svg = elements(fixture.tree).find(element => element.type === "svg");
  fixture.act(() => svg.props.onPointerDown({ target: { closest: () => null }, currentTarget: fixture.svg, pointerId: 4, clientX: 10, clientY: 10 }));
  fixture.act(() => svg.props.onPointerMove({ pointerId: 4, clientX: 20, clientY: 25 }));
  fixture.act(() => svg.props.onPointerUp({ pointerId: 4, currentTarget: fixture.svg }));
  fixture.act(() => svg.props.onWheel({ preventDefault() {}, clientX: 100, clientY: 100, deltaY: -10000 }));
  assert.deepEqual(fixture.captures, [4]); assert.deepEqual(fixture.released, [4]);
  assert.equal(elements(fixture.tree).some(element => Number(String(element.props?.transform).match(/scale\(([^)]+)\)/)?.[1]) === 3.4), true);
});

test("witnessed-only retained callbacks recheck current witnesses and readonly viewers cannot guide or open anything", () => {
  const fixture = renderMap({ witnessedEntryIds: [ids[0]] }, { scope: "witnessed-only" });
  const retained = rows(fixture.tree)[0].props.onClick;
  fixture.restore({ witnessedEntryIds: [] }); fixture.act(() => retained()); assert.deepEqual(fixture.opened, []); assert.deepEqual(fixture.guided, []);
  fixture.unmount();
  const readonly = renderMap({ witnessedEntryIds: [ids[0], ids[1]] }, { scope: "witnessed-only", onOpenEntry: undefined, onGuideEntry: undefined });
  for (const row of rows(readonly.tree)) { assert.equal(row.props.disabled, true); readonly.act(() => row.props.onClick()); }
  assert.deepEqual(readonly.opened, []); assert.deepEqual(readonly.guided, []);
});

test("omitted scope remains full with anonymous unread guidance and every earned memory accessible", () => {
  const state = { history: ids.slice(0, 20), witnessedEntryIds: [ids[0]], completedChapterIds: narrative.journeyChapters.map(chapter => chapter.id) };
  const props = { visitedEntryIds: [ids[0]], sceneProximity: { activeEntryId: ids[0], navigationTargetId: ids[9], navigationTargetReason: "unread" } };
  const implicit = renderMap(state, props);
  const implicitText = text(implicit.tree), implicitNodeCount = namedNodes(implicit.tree).length;
  assert.equal(implicit.tree.props["data-constellation-scope"], "full");
  assert.equal(rows(implicit.tree).length, 1);
  assert.equal(text(implicit.tree).includes(entries[9].title), false);
  const guide = elements(implicit.tree).find(element => element.props?.role === "button" && element.props["aria-label"] === "Guide through the forest to an unread memory");
  assert.ok(guide); implicit.act(() => guide.props.onClick()); assert.deepEqual(implicit.guided, [ids[9]]);
  implicit.act(() => namedNodes(implicit.tree).find(node => node.props["aria-current"] === "location").props.onClick());
  assert.deepEqual(implicit.opened, [ids[0]]); implicit.unmount();
  const explicit = renderMap(state, { ...props, scope: "full" });
  assert.equal(text(explicit.tree), implicitText);assert.equal(namedNodes(explicit.tree).length, implicitNodeCount);explicit.unmount();
  const complete = renderMap({ witnessedEntryIds: ids, history: ids.slice(0, -1) });
  assert.equal(rows(complete.tree).length, 66);
  for (const row of rows(complete.tree)) complete.act(() => row.props.onClick());
  assert.deepEqual([...complete.opened].sort(), [...ids].sort());
});
