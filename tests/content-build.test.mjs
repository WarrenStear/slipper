import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "slipper-content-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "scripts"));
  mkdirSync(join(root, "src/data"), { recursive: true });
  copyFileSync(new URL("../scripts/compile-world-state.js", import.meta.url), join(root, "scripts/compile.mjs"));
  copyFileSync(new URL("../src/data/slipperArchiveSource.ts", import.meta.url), join(root, "src/data/slipperArchiveSource.ts"));
  return root;
}
function compile(root, epoch) {
  const env = { ...process.env };
  delete env.SOURCE_DATE_EPOCH;
  if (epoch !== undefined) env.SOURCE_DATE_EPOCH = epoch;
  return spawnSync(process.execPath, [join(root, "scripts/compile.mjs")], { env, encoding: "utf8" });
}
function output(root) { return readFileSync(join(root, "src/data/worldState.json"), "utf8"); }

test("unchanged story inputs compile to byte-identical data without wall-clock metadata", t => {
  const root = fixture(t);
  assert.equal(compile(root).status, 0);
  const first = output(root);
  assert.equal(compile(root).status, 0);
  assert.equal(output(root), first);
  assert.equal("generatedAt" in JSON.parse(first), false);
});
test("compiled output preserves every entry and visual without the redundant byId copy", t => {
  const root = fixture(t);
  assert.equal(compile(root).status, 0);
  const result = JSON.parse(output(root));
  const previous = JSON.parse(readFileSync(new URL("../src/data/worldState.json", import.meta.url), "utf8"));
  assert.deepEqual(result.entries, previous.entries);
  assert.deepEqual(result.visuals, previous.visuals);
  assert.equal(result.entries.length, 66);
  assert.equal("byId" in result, false);
});
test("explicit source timestamps are reproducible, including epoch zero", t => {
  const root = fixture(t);
  for (const [epoch, expected] of [["0", "1970-01-01T00:00:00.000Z"], ["1700000000", "2023-11-14T22:13:20.000Z"]]) {
    assert.equal(compile(root, epoch).status, 0);
    assert.equal(JSON.parse(output(root)).generatedAt, expected);
  }
});
test("invalid timestamps fail rather than silently creating a different build", t => {
  const root = fixture(t);
  for (const epoch of ["", "-1", "1.5", "not-a-date", "9".repeat(40), "9999999999999"]) {
    const result = compile(root, epoch);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /SOURCE_DATE_EPOCH/);
  }
});
test("mutable filenames revalidate while content-hashed build assets remain immutable", () => {
  const headers = readFileSync(new URL("../public/_headers", import.meta.url), "utf8");
  const block = path => headers.split(`${path}\n`)[1]?.split("\n\n")[0];
  assert.match(block("/assets/*"), /max-age=31536000, immutable/);
  for (const path of ["/models/*", "/textures/*", "/visuals/*"]) {
    assert.match(block(path), /max-age=0, must-revalidate/);
    assert.doesNotMatch(block(path), /immutable/);
  }
});
