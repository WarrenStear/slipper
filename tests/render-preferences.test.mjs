import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  getStoredRenderQuality, isRenderQuality, normalizeDevicePixelRatio, persistRenderQuality,
  RENDER_QUALITY_EVENT, RENDER_QUALITY_STORAGE_KEY, resolveInitialRenderQuality, setPreferredRenderQuality,
} from "../src/components/three/renderPreferences.ts";

function world(t, { search = "", stored = null, denied = false, memory = 8, cores = 8 } = {}) {
  const previous = ["window", "navigator"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  const events = [], writes = [];
  const win = {
    location: { search }, dispatchEvent: event => { events.push(event); return true; },
    get localStorage() {
      if (denied) throw new Error("Storage is disabled");
      return { getItem: () => stored, setItem: (...args) => writes.push(args) };
    },
  };
  Object.defineProperty(globalThis, "window", { configurable: true, value: win });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { deviceMemory: memory, hardwareConcurrency: cores } });
  t.after(() => { for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } });
  return { events, writes };
}
test("query preference retains precedence without accessing denied storage", t => {
  world(t, { search: "?quality=cinematic", denied: true, memory: 2 });
  assert.equal(resolveInitialRenderQuality(), "cinematic");
});
test("saved preferences are retained and invalid stored values are ignored", t => {
  world(t, { search: "?quality=unknown", stored: "high", memory: 2 });
  assert.equal(getStoredRenderQuality(), "high"); assert.equal(resolveInitialRenderQuality(), "high");
  assert.equal(isRenderQuality("ultra"), false); assert.equal(isRenderQuality(null), false);
});
test("denied storage cannot prevent a safe initial preset", t => {
  world(t, { denied: true, memory: 2 });
  assert.equal(getStoredRenderQuality(), null); assert.equal(resolveInitialRenderQuality(), "low");
});
test("quality changes still reach the current tab when persistence fails", t => {
  const { events } = world(t, { denied: true });
  assert.equal(persistRenderQuality("high"), false);
  setPreferredRenderQuality("low");
  assert.equal(events.length, 1); assert.equal(events[0].type, RENDER_QUALITY_EVENT);
  assert.deepEqual(events[0].detail, { quality: "low" });
});
test("successful writes retain the existing preference key and reject invalid values", t => {
  const { writes, events } = world(t);
  setPreferredRenderQuality("high"); setPreferredRenderQuality("unknown");
  assert.deepEqual(writes, [[RENDER_QUALITY_STORAGE_KEY, "high"]]); assert.equal(events.length, 1);
});
test("hardware hints preserve the original low, medium and high thresholds", async t => {
  for (const [memory, cores, expected] of [[4,16,"low"], [16,4,"low"], [8,8,"medium"], [16,16,"high"]]) {
    await t.test(`${memory}/${cores}`, sub => { world(sub, { memory, cores }); assert.equal(resolveInitialRenderQuality(), expected); });
  }
});
test("unavailable or invalid hardware hints fall back rather than selecting maximum detail", t => {
  world(t, { memory: NaN, cores: Infinity }); assert.equal(resolveInitialRenderQuality(), "medium");
  Object.defineProperty(navigator, "deviceMemory", { get() { throw new Error("denied"); } });
  assert.equal(resolveInitialRenderQuality(), "medium");
});
test("pixel ratio normalisation rejects non-finite or non-positive values", () => {
  for (const value of [undefined, NaN, Infinity, -Infinity, 0, -2]) assert.equal(normalizeDevicePixelRatio(value), 1);
  for (const value of [.75, 1, 2, 3]) assert.equal(normalizeDevicePixelRatio(value), value);
});
test("renderer consumes the guarded preferences and keeps compatibility exports", () => {
  const source = readFileSync(new URL("../src/components/three/renderQuality.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /localStorage/);
  assert.match(source, /persistRenderQuality\(quality\)/);
  assert.match(source, /normalizeDevicePixelRatio\(devicePixelRatio\)/);
  assert.match(source, /setPreferredRenderQuality,[\s\S]*from "\.\/renderPreferences"/);
});
