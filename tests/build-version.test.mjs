import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildVersion } from "../scripts/write-build-version.mjs";

function checkout(t) {
  const directory = mkdtempSync(join(tmpdir(), "slipper-version-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const git = (...args) => execFileSync("git", args, { cwd: directory, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  git("init", "-b", "main");
  writeFileSync(join(directory, "package.json"), JSON.stringify({ name: "slipper-in-the-woods", version: "1.0.0" }));
  git("add", "package.json");
  git("-c", "user.name=Build Test", "-c", "user.email=build@example.invalid", "-c", "commit.gpgsign=false", "commit", "-m", "fixture");
  return { directory, revision: git("rev-parse", "HEAD") };
}

test("a local production build identifies its actual checkout and modified source", t => {
  const { directory, revision } = checkout(t);
  const version = buildVersion(directory, {}, new Date("2026-09-25T10:00:00Z"));
  assert.equal(version.revision, revision);
  assert.equal(version.branch, "main");
  assert.equal(version.builtAt, "2026-09-25T10:00:00.000Z");
  assert.equal(version.repository, "https://github.com/WarrenStear/slipper");
  assert.equal(version.dirty, false);
  mkdirSync(join(directory, "src/data"), { recursive: true });
  writeFileSync(join(directory, "src/data/worldState.json"), "{}");
  assert.equal(buildVersion(directory, {}).dirty, false);
  writeFileSync(join(directory, "new-source.js"), "export const value = 1;");
  assert.equal(buildVersion(directory, {}).dirty, true);
  rmSync(join(directory, "new-source.js"));
  writeFileSync(join(directory, "package.json"), JSON.stringify({ name: "slipper-in-the-woods", version: "1.0.1" }));
  assert.equal(buildVersion(directory, {}).dirty, true);
});

test("Cloudflare and GitHub builds use their deployment revision and branch", t => {
  const { directory } = checkout(t);
  const cloud = buildVersion(directory, { CF_PAGES_COMMIT_SHA: "a".repeat(40), CF_PAGES_BRANCH: "main", GITHUB_SHA: "b".repeat(40), GITHUB_REF_NAME: "ignored-github-branch" });
  assert.equal(cloud.revision, "a".repeat(40));
  assert.equal(cloud.branch, "main");
  assert.equal(cloud.repository, "https://github.com/WarrenStear/slipper");
  assert.equal(cloud.dirty, false);
  const github = buildVersion(directory, { GITHUB_SHA: "b".repeat(40), GITHUB_REF_NAME: "preview" });
  assert.equal(github.revision, "b".repeat(40));
  assert.equal(github.branch, "preview");
  assert.equal(github.repository, "https://github.com/WarrenStear/slipper");
  assert.equal(github.dirty, false);
  assert.throws(() => buildVersion(directory, { CF_PAGES_COMMIT_SHA: "main" }), /full Git commit SHA/);
});

test("the production build writes version metadata and Pages serves it without caching", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.scripts.postbuild, "node scripts/write-build-version.mjs");
  const headers = readFileSync(new URL("../public/_headers", import.meta.url), "utf8");
  const versionHeaders = headers.split(/\n\s*\n/).find(block => block.trim().startsWith("/version.json\n"));
  assert.ok(versionHeaders, "the version endpoint needs its own response policy");
  const cachePolicies = [...versionHeaders.matchAll(/^\s+Cache-Control:\s*(.+)$/gm)].map(match => match[1].trim());
  assert.deepEqual(cachePolicies, ["no-store"]);
});
