import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { heroReflectionDisturbance } from "../src/components/three/reflections/reflectionMotion.ts";

test("both live hero surfaces retain their authored disturbance and settle from shared evidence", () => {
  for (const [kind, amount] of [["mirror", .004], ["moonwater", .0015]]) {
    assert.equal(heroReflectionDisturbance(kind, .1, 0), amount);
    assert.equal(heroReflectionDisturbance(kind, .1, .5), amount * .5);
    assert.equal(heroReflectionDisturbance(kind, .1, 1), 0);
    assert.equal(heroReflectionDisturbance(kind, 0, 0), 0);
  }
});

test("hero material motion is updated by its existing shared-frame subscriber, independently of capture", () => {
  const source = readFileSync(new URL("../src/components/three/reflections/HeroReflectionSurface.tsx", import.meta.url), "utf8");
  const ast = ts.createSourceFile("HeroReflectionSurface.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const subscribers = [];
  const visit = node => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "useFrame") subscribers.push(node);
    ts.forEachChild(node, visit);
  };
  visit(ast);
  assert.equal(subscribers.length, 1, "no additional capture or animation subscriber");
  const frame = subscribers[0].arguments[0].getText(ast);
  assert.match(frame, /uTime\.value = presentation\.time\.water/);
  assert.match(frame, /uDisturbance\.value = heroReflectionDisturbance/);
  assert.doesNotMatch(frame, /getRenderTarget|onBeforeRender|clock\.elapsedTime/);
  assert.match(source, /frame\.current - capturedFrame\.current < presentation\.look\.budget\.reflectionEveryFrames/);
});
