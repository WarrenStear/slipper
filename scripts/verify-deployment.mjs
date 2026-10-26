#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function verifyVersion(version, revision, branch = "main") {
  assert.match(revision, /^[0-9a-f]{40}$/, "A full expected Git commit SHA is required.");
  assert.equal(version.repository, "https://github.com/WarrenStear/slipper", "Wrong source repository.");
  assert.equal(version.revision, revision, "The deployment is serving a different commit.");
  assert.equal(version.branch, branch, "Wrong deployment branch.");
  assert.equal(version.mode, "production", "Expected a production build.");
  assert.equal(version.dirty, false, "The deployment was built from modified source.");
}

export async function verifyDeployment(origin, revision, directory, branch = "main", request = fetch) {
  const base = new URL(origin);
  assert.ok(["https:", "http:"].includes(base.protocol), "Expected an HTTP(S) URL.");
  const get = async path => {
    const response = await request(new URL(path, base), { cache: "no-store", signal: AbortSignal.timeout(30_000) });
    assert.ok(response.ok, `${path}: HTTP ${response.status}`);
    return response;
  };
  const response = await get(`/version.json?verify=${Date.now()}`);
  assert.match(response.headers.get("cache-control") ?? "", /(?:^|,)\s*no-store\s*(?:,|$)/i, "Version metadata must be served with no-store.");
  const version = await response.json();
  verifyVersion(version, revision, branch);
  verifyVersion(JSON.parse(readFileSync(resolve(directory, "version.json"), "utf8")), revision, branch);

  const localHtml = readFileSync(resolve(directory, "index.html"), "utf8");
  const liveHtml = await (await get("/")).text();
  const references = html => [...new Set([...html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+\.(?:js|css))"/g)].map(match => match[1]))].sort();
  const assets = references(localHtml);
  assert.ok(assets.length > 0, "The local build has no entry assets.");
  assert.deepEqual(references(liveHtml), assets, "The live page references different entry bundles.");
  const hash = bytes => createHash("sha256").update(bytes).digest("hex");
  for (const asset of assets) {
    const bytes = Buffer.from(await (await get(asset)).arrayBuffer());
    assert.equal(hash(bytes), hash(readFileSync(resolve(directory, `.${asset}`))), `${asset}: deployed bytes differ from the validated build.`);
  }
  return { origin: base.origin, revision, branch, verifiedEntryAssets: assets.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [origin, revision, directory = "dist", branch = "main"] = process.argv.slice(2);
    if (!origin || !revision) throw new Error("Usage: npm run verify:deployment -- URL COMMIT_SHA [BUILD_DIRECTORY] [BRANCH]");
    console.log(JSON.stringify(await verifyDeployment(origin, revision, directory, branch), null, 2));
  } catch (error) { console.error(error); process.exitCode = 1; }
}
