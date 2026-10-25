import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { observeWebGLContextLoss, pauseLostWebGLRenderer } from "../src/lib/webglContextRecovery.ts";

const loss = () => new Event("webglcontextlost", { cancelable: true });

test("healthy renderers do not open recovery", () => {
  const canvas = new EventTarget();
  let calls = 0;
  const release = observeWebGLContextLoss(canvas, () => calls++);
  canvas.dispatchEvent(new Event("webglcontextrestored"));
  canvas.dispatchEvent(new Event("click"));
  assert.equal(calls, 0);
  release();
});

test("a canvas loss is handled once and allows the browser restoration protocol", () => {
  const canvas = new EventTarget();
  let calls = 0;
  const release = observeWebGLContextLoss(canvas, () => calls++);
  const event = loss();
  assert.equal(canvas.dispatchEvent(event), false);
  assert.equal(event.defaultPrevented, true);
  canvas.dispatchEvent(loss());
  assert.equal(calls, 1);
  release();
});

test("renderer teardown after cleanup cannot open a stale recovery dialog", () => {
  const canvas = new EventTarget();
  let calls = 0;
  const release = observeWebGLContextLoss(canvas, () => calls++);
  release();
  release();
  const event = loss();
  canvas.dispatchEvent(event);
  assert.equal(calls, 0);
  assert.equal(event.defaultPrevented, false);
});

test("a context lost before listener installation still opens recovery once", () => {
  const canvas = new EventTarget();
  let calls = 0;
  const release = observeWebGLContextLoss(canvas, () => calls++, () => true);
  assert.equal(calls, 1);
  canvas.dispatchEvent(loss());
  assert.equal(calls, 1);
  release();
});

test("StrictMode cleanup and remount do not leave duplicate listeners", () => {
  const canvas = new EventTarget();
  let stale = 0;
  let current = 0;
  observeWebGLContextLoss(canvas, () => stale++)();
  const release = observeWebGLContextLoss(canvas, () => current++);
  canvas.dispatchEvent(loss());
  assert.equal(stale, 0);
  assert.equal(current, 1);
  release();
});

test("failed initial context inspection removes its listener before throwing", () => {
  const canvas = new EventTarget();
  let calls = 0;
  assert.throws(() => observeWebGLContextLoss(canvas, () => calls++, () => {
    throw new Error("Renderer unavailable");
  }), /Renderer unavailable/);
  canvas.dispatchEvent(loss());
  assert.equal(calls, 0);
});

test("separate canvases retain independent recovery ownership", () => {
  const first = new EventTarget();
  const second = new EventTarget();
  const calls = [0, 0];
  const releaseFirst = observeWebGLContextLoss(first, () => calls[0]++);
  const releaseSecond = observeWebGLContextLoss(second, () => calls[1]++);
  first.dispatchEvent(loss());
  assert.deepEqual(calls, [1, 0]);
  second.dispatchEvent(loss());
  assert.deepEqual(calls, [1, 1]);
  releaseFirst();
  releaseSecond();
});


test("actual WebGL loss pauses both render scheduling owners before opening the DOM recovery", () => {
  const canvas = new EventTarget(), calls = [];
  const renderer = { setAnimationLoop(callback) { assert.equal(callback, null); calls.push("renderer-stopped"); } };
  const setFrameloop = mode => { assert.equal(mode, "never"); calls.push("r3f-stopped"); };
  const release = observeWebGLContextLoss(canvas,
    () => pauseLostWebGLRenderer(renderer, setFrameloop, () => calls.push("recovery")));
  canvas.dispatchEvent(loss());
  canvas.dispatchEvent(loss());
  assert.deepEqual(calls, ["renderer-stopped","r3f-stopped","recovery"]);
  release();
});

test("renderer teardown failure cannot block the R3F pause or accessible recovery", () => {
  const calls = [];
  const renderer = { setAnimationLoop() { calls.push("renderer-attempt"); throw new Error("Already destroyed"); } };
  assert.doesNotThrow(() => pauseLostWebGLRenderer(renderer,
    mode => { assert.equal(mode, "never"); calls.push("r3f-stopped"); },
    () => calls.push("recovery")));
  assert.deepEqual(calls, ["renderer-attempt","r3f-stopped","recovery"]);
});

test("WorldCanvas wires synchronous frame shutdown to the actual context-loss observer", () => {
  const source = readFileSync(new URL("../src/components/three/WorldCanvas.tsx", import.meta.url), "utf8");
  assert.match(source, /const \{ gl, setFrameloop \} = useThree\(\)/);
  assert.match(source, /pauseLostWebGLRenderer\(gl, setFrameloop, onContextLost\)/);
  assert.match(source, /observeWebGLContextLoss\([\s\S]*gl\.domElement,[\s\S]*stopFramesBeforeRecovery/);
});

