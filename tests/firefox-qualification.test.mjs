import test from "node:test";
import assert from "node:assert/strict";
import { inspectWebGL2, requireFirefoxWebGL2 } from "../scripts/check-firefox-webgl.mjs";

function rendererFixture({ supported = true, debug = true, throwOnRead = false } = {}) {
  let released = 0;
  const gl = {
    RENDERER: "renderer",
    getExtension(name) {
      if (name === "WEBGL_lose_context") return { loseContext() { released++; } };
      return debug ? { UNMASKED_RENDERER_WEBGL: "unmasked" } : null;
    },
    getParameter(key) {
      if (throwOnRead) throw new Error("driver failure");
      return key;
    },
  };
  return {
    documentObject: { createElement(tag) {
      assert.equal(tag, "canvas");
      return { getContext(name, options) {
        assert.equal(name, "webgl2");
        assert.deepEqual(options, { failIfMajorPerformanceCaveat: true });
        return supported ? gl : null;
      } };
    } },
    releases: () => released,
  };
}

test("qualification reports absence rather than manufacturing graphics support", () => {
  const fixture = rendererFixture({ supported: false });
  assert.deepEqual(inspectWebGL2(fixture.documentObject), { webgl2: false });
});
for (const debug of [true, false]) test(`real-context metadata works with debug extension ${debug}`, () => {
  const fixture = rendererFixture({ debug });
  assert.deepEqual(inspectWebGL2(fixture.documentObject), { webgl2: true, renderer: debug ? "unmasked" : "renderer" });
  assert.equal(fixture.releases(), 1);
});
test("driver exceptions still release the probe context", () => {
  const fixture = rendererFixture({ throwOnRead: true });
  assert.throws(() => inspectWebGL2(fixture.documentObject), /driver failure/);
  assert.equal(fixture.releases(), 1);
});
for (const supported of [true, false]) test(`qualification closes Firefox when WebGL2 is ${supported}`, async () => {
  let closed = 0;
  const browserType = { async launch(options) {
    assert.equal(options.headless, false);
    return {
      async newPage() { return { async evaluate(probe) {
        assert.equal(probe, inspectWebGL2);
        return { webgl2: supported, renderer: "test fixture" };
      } }; },
      async close() { closed++; },
    };
  } };
  if (supported) assert.equal((await requireFirefoxWebGL2(browserType)).webgl2, true);
  else await assert.rejects(requireFirefoxWebGL2(browserType), /requires a real WebGL2/);
  assert.equal(closed, 1);
});
test("a failed page allocation closes the browser and propagates the failure", async () => {
  let closed = 0;
  await assert.rejects(requireFirefoxWebGL2({ async launch() { return {
    async newPage() { throw new Error("context allocation failed"); },
    async close() { closed++; },
  }; } }), /context allocation failed/);
  assert.equal(closed, 1);
});
