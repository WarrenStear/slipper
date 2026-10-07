import assert from "node:assert/strict";
import test from "node:test";
import { register } from "node:module";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

register("./quiet-tsx-loader.mjs", import.meta.url);
const { resolveQuietGuidance } = await import("../src/ui/quietGuidancePresentation.ts");
const { QuietGuidance } = await import("../src/ui/QuietGuidance.tsx");
const { ExperienceMenu } = await import("../src/ui/ExperienceMenu.tsx");
const { journeyScenes } = await import("../src/data/journeyNarrative.ts");
const { getSlipperExperienceCapabilities } = await import("../src/lib/experienceMode.ts");
const opening = journeyScenes.find(scene => scene.id === "broken-floor.confession");
const input = overrides => ({ sceneId: opening.id, kind: "action", instruction: "Wipe the wet floor.", active: true, idleMs: 0, ...overrides });
const markup = props => renderToStaticMarkup(React.createElement(QuietGuidance, { sceneId: opening.id, kind: "action", eventIds: ["broken-floor.first-wipe"],
  instruction: "Wipe the wet floor.", hint: "Drag across the water.", detailsOpen: false, onCloseDetails() {}, ...props }));

test("all32 default current-scene lines come from existing canonical guidance and deriving cannot mutate it", () => {
  const before = JSON.stringify(journeyScenes);
  for (const scene of journeyScenes) {
    const view = resolveQuietGuidance(input({ sceneId: scene.id }));
    assert.equal(view.line, scene === opening ? null : scene.presentation.guidanceLines[0] ?? null, scene.id);
    assert.equal(view.detailsOpen, false, scene.id);
  }
  assert.equal(JSON.stringify(journeyScenes), before);
});
test("opening uses exact authored delay then Look down, current authored discovery, and existing mechanical help", () => {
  const delay = opening.pacing.guidanceDelayMs;
  assert.equal(delay, 28000);
  for (const [idleMs, stage, line] of [[0,0,null],[delay-1,0,null],[delay,1,"Look down."],
    [delay+15999,1,"Look down."],[delay+16000,2,opening.presentation.guidanceLines[0]],
    [delay+35999,2,opening.presentation.guidanceLines[0]],[delay+36000,3,"Wipe the wet floor."]]) {
    const view = resolveQuietGuidance(input({ idleMs }));
    assert.equal(view.openingStage, stage); assert.equal(view.line, line); assert.equal(view.detailsOpen, stage === 3);
  }
});
test("help and existing stronger assistance are immediate; explicit quiet overrides automatic details without persisting anything", () => {
  for (const preference of [{ detailRequested: true },{ assistanceEnabled: true }]) {
    const view = resolveQuietGuidance(input(preference)); assert.equal(view.openingStage,3);assert.equal(view.detailsOpen,true);
  }
  const quiet = resolveQuietGuidance(input({ detailRequested:false,assistanceEnabled:true,idleMs:500000 }));
  assert.equal(quiet.detailsOpen,false); assert.equal(quiet.line,opening.presentation.guidanceLines[0]);
  for (const idleMs of [-1,NaN,Infinity]) assert.equal(resolveQuietGuidance(input({idleMs})).line,null);
});
test("inactive and physical quiet/sequence presentations stay absent while inline accessibility stays immediate", () => {
  for (const kind of ["quiet","sequence"]) {
    const physical=resolveQuietGuidance(input({kind,detailRequested:true}));assert.equal(physical.visible,false);assert.equal(physical.line,null);
    const semantic=resolveQuietGuidance(input({kind,inline:true}));assert.equal(semantic.visible,true);assert.equal(semantic.detailsOpen,true);
  }
  assert.equal(resolveQuietGuidance(input({active:false,detailRequested:true,inline:true})).visible,false);
});
test("one-line DOM omits headings/actions/mechanics; consequence uses only its supplied current response", () => {
  const compact=markup({line:opening.presentation.guidanceLines[0]});
  assert.ok(compact.includes(opening.presentation.guidanceLines[0]));assert.equal(compact.includes("<button"),false);
  assert.equal(compact.includes("Drag across"),false);assert.equal(compact.includes("<h2"),false);
  const consequence={eventId:"broken-floor.first-wipe",line:"A clear patch opens in the water.",held:false,onHeldChange(){},onDismiss(){}};
  const response=markup({line:consequence.line,consequence});assert.ok(response.includes(consequence.line));assert.equal(response.includes("Wipe the wet floor"),false);
  const expanded=markup({line:consequence.line,consequence,detailsOpen:true});
  assert.ok(expanded.includes("Stay with this moment"));assert.ok(expanded.includes("Show my next step"));
  assert.ok(expanded.includes('aria-label="Your current next step" hidden=""')||expanded.includes('hidden="" aria-label="Your current next step"'));
  assert.equal(markup({line:null}),"");
});
test("Memories menu keeps completed capabilities and the earned directed viewer while omitting forbidden Archive/navigation rows", () => {
  const base={open:false,onOpenChange(){},fragmentAvailable:false,onFragment(){},onConstellation(){},onArchive(){},onSettings(){}};
  const free=renderToStaticMarkup(React.createElement(ExperienceMenu,{...base,capabilities:getSlipperExperienceCapabilities("free-woods")}));
  for(const label of ["Memories","Fragment","Constellation","Archive","Settings"])assert.ok(free.includes(label));
  assert.ok(free.includes('aria-haspopup="dialog"'));assert.ok(free.includes("disabled"));
  const directed=renderToStaticMarkup(React.createElement(ExperienceMenu,{...base,capabilities:getSlipperExperienceCapabilities("first-journey")}));
  assert.equal(directed.includes(">Archive<"),false);assert.equal(directed.includes(">Constellation<"),false);
  const earned=renderToStaticMarkup(React.createElement(ExperienceMenu,{...base,constellationAvailable:true,
    capabilities:getSlipperExperienceCapabilities("first-journey"),navigationActions:[{id:"next",label:"Arbitrary next fragment",onSelect(){}}]}));
  assert.equal(earned.includes(">Constellation<"),true);assert.equal(earned.includes("Arbitrary next fragment"),false);
  assert.equal(directed.includes("66"),false);assert.equal(directed.includes("%"),false);assert.equal(directed.includes("visuals"),false);
});
