import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const code = ts.transpileModule(readFileSync(new URL(
  "../src/experience/ExperienceRouter.ts", import.meta.url,
), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;

function route(globals = {}) {
  const context = vm.createContext({ exports: {}, URLSearchParams, ...globals });
  vm.runInContext(code, context);
  return context.exports.requiresAccessibleJourney();
}

test("server and explicit text routes never allocate a rendering context", () => {
  assert.equal(route(), true);
  assert.equal(route({ window: { location: { search: "?accessible=1" } },
    document: { createElement() { assert.fail("text route must not allocate WebGL"); } },
  }), true);
});

test("forest routing requires WebGL2 and releases each successful probe", () => {
  let allocated = 0;
  let released = 0;
  const globals = { window: { location: { search: "" } }, document: {
    createElement(tag) {
      assert.equal(tag, "canvas");
      return { getContext(kind, options) {
        assert.equal(kind, "webgl2");
        assert.equal(options.failIfMajorPerformanceCaveat, true);
        allocated++;
        return { getExtension(name) {
          assert.equal(name, "WEBGL_lose_context");
          return { loseContext() { released++; } };
        } };
      } };
    },
  } };
  assert.equal(route(globals), false);
  assert.equal(route(globals), false);
  assert.equal(allocated, 2);
  assert.equal(released, allocated, "StrictMode must not retain temporary probes");
});

test("unavailable or rejected WebGL routes to the existing text journey", () => {
  for (const getContext of [() => null, () => { throw new Error("context rejected"); }]) {
    assert.equal(route({ window: { location: { search: "" } },
      document: { createElement: () => ({ getContext }) },
    }), true);
  }
});

test("a usable context without explicit release extension still enters Forest", () => {
  assert.equal(route({ window: { location: { search: "?accessible=0" } },
    document: { createElement: () => ({ getContext: () => ({ getExtension: () => null }) }) },
  }), false);
});
