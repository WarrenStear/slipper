import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { describeBuild, verifyBuild } from "../scripts/build-artifact.mjs";
import { discoverUnitTests } from "../scripts/run-unit-tests.mjs";

const revision = "a".repeat(40);
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "slipper-build-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "dist/assets"), { recursive: true });
  mkdirSync(join(root, "src/data"), { recursive: true });
  writeFileSync(join(root, "dist/index.html"), "<main>Story</main>");
  writeFileSync(join(root, "dist/assets/app.js"), "/* candidate */");
  writeFileSync(join(root, "src/data/worldState.json"), "{}");
  return root;
}
test("unit discovery includes new families, excludes dedicated security and ignores fixtures", t => {
  const root = fixture(t);
  for (const name of ["surface-materials.test.mjs", "new-feature.test.mjs", "session-security.test.mjs", "fixture.mjs"]) writeFileSync(join(root, name), "");
  mkdirSync(join(root, "not-a-file.test.mjs"));
  assert.deepEqual(discoverUnitTests(root), [join(root, "new-feature.test.mjs"), join(root, "surface-materials.test.mjs")]);
});
test("artifact fingerprints are deterministic and match the requested revision", t => {
  const root = fixture(t), manifest = describeBuild(root, revision);
  assert.deepEqual(describeBuild(root, revision), manifest);
  assert.equal(verifyBuild(root, revision, manifest), true);
});
test("a different checkout cannot reuse a passing build", t => {
  const root = fixture(t);
  assert.throws(() => verifyBuild(root, "b".repeat(40), describeBuild(root, revision)), /revision mismatch/);
});
test("changed output, extra files and regenerated story data fail verification", t => {
  for (const file of ["dist/assets/app.js", "dist/unexpected.js", "src/data/worldState.json"]) {
    const root = fixture(t), manifest = describeBuild(root, revision);
    writeFileSync(join(root, file), "different");
    assert.throws(() => verifyBuild(root, revision, manifest), /differs/);
  }
});
test("missing files, malformed manifests and short revisions fail closed", t => {
  const root = fixture(t), manifest = describeBuild(root, revision);
  assert.throws(() => describeBuild(root, "main"), /full commit/);
  assert.throws(() => verifyBuild(root, revision, { ...manifest, files: [] }), /Invalid/);
  rmSync(join(root, "dist/assets/app.js"));
  assert.throws(() => verifyBuild(root, revision, manifest), /differs/);
});
test("artifact collection refuses symlinks rather than following them", t => {
  const root = fixture(t);
  symlinkSync(join(root, "src/data/worldState.json"), join(root, "dist/link"));
  assert.throws(() => describeBuild(root, revision), /symbolic links/);
});
test("main browser workflow restores a fingerprinted build and does not rebuild", () => {
  const source = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
  const browsers = source.split("\n  browsers:")[1];
  assert.match(browsers, /actions\/download-artifact@/);
  assert.match(browsers, /build-artifact.mjs verify/);
  assert.doesNotMatch(browsers, /run: npm run build/);
});
test("manual deployment targets the configured Pages project", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const config = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
  const project = config.match(/^name = "([^"]+)"/m)?.[1];
  assert.ok(project);
  assert.ok(pkg.scripts["deploy:pages"].endsWith(`--project-name ${project}`));
});
