import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { verifyDeployment, verifyVersion } from "../scripts/verify-deployment.mjs";

const revision = "a".repeat(40);
const version = { repository: "https://github.com/WarrenStear/slipper", revision, branch: "main", mode: "production", dirty: false };

test("deployment identity rejects old metadata, wrong revisions, branches and modified source", () => {
  verifyVersion(version, revision);
  for (const changed of [{}, { ...version, revision: "b".repeat(40) }, { ...version, branch: "preview" }, { ...version, dirty: true }, { ...version, repository: "old-repository" }, { ...version, mode: "development" }]) {
    assert.throws(() => verifyVersion(changed, revision));
  }
});

test("deployment check compares fetched bundle bytes and requires uncached version metadata", async t => {
  const directory = mkdtempSync(join(tmpdir(), "slipper-deployment-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  mkdirSync(join(directory, "assets"));
  const html = '<script type="module" src="/assets/app-123.js"></script>';
  writeFileSync(join(directory, "index.html"), html);
  writeFileSync(join(directory, "version.json"), JSON.stringify(version));
  writeFileSync(join(directory, "assets/app-123.js"), "current bundle");
  let bundle = "current bundle", cache = "no-store", page = html;
  const request = async url => url.pathname === "/version.json"
    ? new Response(JSON.stringify(version), { headers: { "cache-control": cache } })
    : new Response(url.pathname === "/" ? page : bundle);
  assert.equal((await verifyDeployment("https://example.test", revision, directory, "main", request)).verifiedEntryAssets, 1);
  bundle = "stale bundle";
  await assert.rejects(verifyDeployment("https://example.test", revision, directory, "main", request), /deployed bytes differ/);
  bundle = "current bundle";
  page = '<script src="/assets/old.js"></script>';
  await assert.rejects(verifyDeployment("https://example.test", revision, directory, "main", request), /different entry bundles/);
  cache = "public, max-age=3600";
  await assert.rejects(verifyDeployment("https://example.test", revision, directory, "main", request), /no-store/);
});
