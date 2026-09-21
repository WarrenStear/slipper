#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MODE = process.argv.includes("--lint")
  ? "lint"
  : process.argv.includes("--security")
    ? "security"
    : "integration";
const errors = [];
const warnings = [];

function relative(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join("/");
}

function fail(message) {
  errors.push(message);
}

function warn(message) {
  warnings.push(message);
}

function resolve(relativePath) {
  return path.join(ROOT, relativePath);
}

function required(relativePath) {
  const filePath = resolve(relativePath);
  if (!fs.existsSync(filePath)) fail(`Missing required file: ${relativePath}`);
  return filePath;
}

function read(relativePath) {
  const filePath = required(relativePath);
  if (!fs.existsSync(filePath)) return "";
  return fs.readFileSync(filePath, "utf8");
}

function parseJson(relativePath) {
  const source = read(relativePath);
  if (!source) return null;
  try {
    return JSON.parse(source);
  } catch (error) {
    fail(`${relativePath} is not valid JSON: ${error instanceof Error ? error.message : "unknown parse error"}`);
    return null;
  }
}

function requirePatterns(relativePath, patterns) {
  const source = read(relativePath);
  for (const [label, pattern] of patterns) {
    if (!pattern.test(source)) fail(`${relativePath} is missing ${label}.`);
  }
  return source;
}

function walk(directory, extensions) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  const visit = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
      } else if (entry.isFile() && extensions.has(path.extname(entry.name))) {
        files.push(fullPath);
      }
    }
  };
  visit(directory);
  return files;
}

function validateSourceLint() {
  const lintRoots = ["src", "functions", "scripts", "tests", "e2e"];
  const extensions = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);
  const conflictMarker = /^(?:<<<<<<<|=======|>>>>>>>)(?: .*)?$/m;
  const suppression = /@ts-(?:ignore|nocheck)\b/;
  const unsafeRuntime = /\b(?:eval\s*\(|new\s+Function\s*\(|document\.write\s*\()/;

  for (const root of lintRoots) {
    for (const filePath of walk(resolve(root), extensions)) {
      const source = fs.readFileSync(filePath, "utf8");
      const name = relative(filePath);
      if (source.includes("\0")) fail(`${name} contains a NUL byte.`);
      if (conflictMarker.test(source)) fail(`${name} contains an unresolved merge marker.`);
      if (suppression.test(source)) fail(`${name} contains a TypeScript checking suppression.`);
      if (/\bdebugger\s*;/.test(source)) fail(`${name} contains a debugger statement.`);
      if (unsafeRuntime.test(source)) fail(`${name} contains an unsafe dynamic-code or document-write API.`);
      if (source.split(/\r?\n/).some((line) => /[ \t]+$/.test(line))) {
        fail(`${name} contains trailing whitespace.`);
      }
      if (source.length > 0 && !source.endsWith("\n")) fail(`${name} must end with a newline.`);
    }
  }

  const focusedMobileFiles = [
    "src/components/ui/AccessibleArchive.tsx",
    "src/components/ui/ExperienceSettingsDrawer.tsx",
    "src/components/ui/MobileExploreControls.tsx",
    "src/hooks/useMobileViewport.ts",
    "src/lib/experiencePreferences.ts",
    "src/lib/mobileControls.ts",
    "src/stores/usePlayerInputStore.ts",
    "src/stores/useSettingsStore.ts",
  ];
  const explicitAny = /(?:\bas\s+any\b|:\s*any\b|<any>)/;
  for (const relativePath of focusedMobileFiles) {
    const source = read(relativePath);
    if (explicitAny.test(source)) fail(`${relativePath} introduces an explicit any in the mobile/settings surface.`);
  }

  parseJson("package.json");
  parseJson("public/_routes.json");
}

function validateSecurity() {
  const securityRoots = ["src", "functions", ".github", "private-content"];
  const extensions = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".yml", ".yaml", ".json"]);
  const secretPatterns = [
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
    /\bghp_[A-Za-z0-9]{20,}\b/,
    /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/,
    /\b(?:MAGIC_LINK_SECRET|CLOUDFLARE_API_TOKEN)\s*[=:]\s*["'][^"']{12,}["']/,
  ];

  for (const root of securityRoots) {
    for (const filePath of walk(resolve(root), extensions)) {
      const source = fs.readFileSync(filePath, "utf8");
      for (const pattern of secretPatterns) {
        if (pattern.test(source)) fail(`Potential committed secret in ${relative(filePath)}.`);
      }
    }
  }

  const headers = requirePatterns("public/_headers", [
    ["X-Frame-Options", /^\s*X-Frame-Options:\s*DENY\s*$/m],
    ["X-Content-Type-Options", /^\s*X-Content-Type-Options:\s*nosniff\s*$/m],
    ["Referrer-Policy", /^\s*Referrer-Policy:\s*strict-origin-when-cross-origin\s*$/m],
    ["Permissions-Policy", /^\s*Permissions-Policy:/m],
  ]);
  if (/Access-Control-Allow-Origin:\s*\*/i.test(headers)) {
    fail("public/_headers must not enable wildcard cross-origin access.");
  }

  const routes = parseJson("public/_routes.json");
  if (routes) {
    const includes = Array.isArray(routes.include) ? routes.include : [];
    if (!includes.includes("/api/*")) fail("public/_routes.json must include the Pages Functions API route.");
  }

  requirePatterns("functions/_shared/session.ts", [
    ["HMAC signing", /crypto\.subtle\.(?:sign|verify)|crypto\.subtle\.sign/],
    ["no-store API responses", /["']cache-control["']:\s*["']no-store["']/],
    ["bounded journey history", /const MAX_HISTORY = 512;[\s\S]*?idArray\(value\.history, MAX_HISTORY, fragmentId, true\)/],
    ["bounded visited entries", /const MAX_ENTRY_IDS = 66;[\s\S]*?idArray\(value\.visitedEntryIds, MAX_ENTRY_IDS, fragmentId\)/],
  ]);
  requirePatterns("functions/api/magic-link.ts", [
    ["cryptographically random magic-link tokens", /crypto\.getRandomValues/],
    ["short-lived magic-link storage", /expirationTtl:\s*60\s*\*\s*15/],
  ]);
  requirePatterns("wrangler.toml", [
    ["disabled development magic links", /ENABLE_DEV_MAGIC_LINK\s*=\s*"false"/],
  ]);
  required("tests/session-security.test.mjs");
}

function validateWorldData() {
  const world = parseJson("src/data/worldState.json");
  if (!world) return;
  const entries = Array.isArray(world.entries) ? world.entries : [];
  const visuals = Array.isArray(world.visuals) ? world.visuals : [];
  if (entries.length === 0) fail("worldState.json has no story entries.");
  if (visuals.length === 0) fail("worldState.json has no visual records.");

  const entryIds = entries.map((entry) => entry?.id).filter(Boolean);
  const visualIds = visuals.map((visual) => visual?.id).filter(Boolean);
  if (new Set(entryIds).size !== entryIds.length) fail("worldState.json contains duplicate entry IDs.");
  if (new Set(visualIds).size !== visualIds.length) fail("worldState.json contains duplicate visual IDs.");
  const visualIdSet = new Set(visualIds);
  const entryIdSet = new Set(entryIds);
  let legacyVisualReferenceCount = 0;

  for (const entry of entries) {
    if (!entry?.id || !entry?.title || !entry?.chapter) {
      fail("worldState.json contains an entry without an ID, title, or chapter.");
      continue;
    }
    if (!Array.isArray(entry.paragraphs) || entry.paragraphs.length === 0) {
      fail(`Story entry ${entry.id} has no readable paragraphs.`);
    }
    if (!entry.engine3d || typeof entry.engine3d !== "object" || Array.isArray(entry.engine3d)) {
      fail(`Story entry ${entry.id} has no engine3d metadata.`);
      continue;
    }
    const nestedVisualId =
      typeof entry.engine3d.linkedVisualId === "string" && entry.engine3d.linkedVisualId.trim()
        ? entry.engine3d.linkedVisualId.trim()
        : null;
    const legacyVisualIds = [entry.linkedVisualId, entry.visualId, entry.heroVisualId]
      .filter((value) => typeof value === "string" && value.trim())
      .map((value) => value.trim());
    const declaredVisualIds = new Set([nestedVisualId, ...legacyVisualIds].filter(Boolean));
    if (declaredVisualIds.size === 0) {
      fail(`Story entry ${entry.id} has no linked visual reference.`);
      continue;
    }
    if (declaredVisualIds.size > 1) {
      fail(`Story entry ${entry.id} has conflicting linked visual references: ${[...declaredVisualIds].join(", ")}.`);
      continue;
    }
    if (!nestedVisualId) legacyVisualReferenceCount += 1;
    const linkedVisualId = nestedVisualId ?? legacyVisualIds[0];
    if (!visualIdSet.has(linkedVisualId)) {
      fail(`Story entry ${entry.id} references missing visual ${linkedVisualId}.`);
    }
    for (const portal of entry.engine3d?.portalLocations ?? []) {
      if (portal?.targetEntryId && !entryIdSet.has(portal.targetEntryId)) {
        fail(`Story entry ${entry.id} references missing portal target ${portal.targetEntryId}.`);
      }
    }
  }

  if (legacyVisualReferenceCount > 0) {
    warn(
      `${legacyVisualReferenceCount} generated entries use a legacy top-level visual reference; runtime normalization will move it to engine3d.linkedVisualId.`,
    );
  }

  for (const visual of visuals) {
    if (!visual?.id || typeof visual.src !== "string" || !visual.src.startsWith("/")) {
      fail("worldState.json contains a visual without an absolute public asset path.");
      continue;
    }
    const assetPath = resolve(path.join("public", visual.src.slice(1)));
    if (!fs.existsSync(assetPath)) fail(`Missing visual asset for ${visual.id}: ${visual.src}`);
  }
}

function validateIntegration() {
  const requiredFiles = [
    ".github/workflows/ci.yml",
    "docs/ARCHITECTURE.md",
    "docs/BROWSER_SUPPORT.md",
    "docs/MOBILE.md",
    "docs/TESTING.md",
    "e2e/mobile-exploration.spec.ts",
    "e2e/semantic-experience.spec.ts",
    "playwright.config.ts",
    "src/components/ui/AccessibleArchive.tsx",
    "src/components/ui/ExperienceSettingsDrawer.tsx",
    "src/components/ui/MobileExploreControls.tsx",
    "src/hooks/useMobileViewport.ts",
    "src/lib/mobileControls.ts",
    "src/lib/terrainModel.ts",
    "src/lib/journeySnapshot.ts",
    "src/stores/usePlayerInputStore.ts",
    "src/stores/useSettingsStore.ts",
    "tests/journey-recovery.test.mjs",
    "tests/mobile-controls.test.mjs",
    "tests/session-security.test.mjs",
    "tests/terrain-model.test.mjs",
    "tests/world-content.test.mjs",
    "tests/world-render-contracts.test.mjs",
  ];
  for (const relativePath of requiredFiles) required(relativePath);

  const packageJson = parseJson("package.json");
  if (packageJson) {
    const requiredScripts = [
      "build",
      "check",
      "content:qa",
      "lint",
      "test",
      "test:unit",
      "test:security",
      "test:e2e",
      "test:e2e:desktop",
      "test:e2e:mobile",
      "typecheck",
      "typecheck:functions",
      "validate",
      "wrangler:check",
    ];
    for (const script of requiredScripts) {
      if (typeof packageJson.scripts?.[script] !== "string" || packageJson.scripts[script].trim() === "") {
        fail(`package.json is missing the ${script} script.`);
      }
    }
    if (packageJson.engines?.node !== ">=22 <25") {
      fail('package.json must declare engines.node as ">=22 <25".');
    }
    if (packageJson.packageManager !== "npm@10.9.2") {
      fail('package.json must declare packageManager as "npm@10.9.2".');
    }
    const prebuild = packageJson.scripts?.prebuild ?? "";
    for (const worldStep of ["final:world", "content:qa", "world:compile"]) {
      if (!prebuild.includes(worldStep)) fail(`The existing ${worldStep} prebuild step was not preserved.`);
    }
  }

  requirePatterns("src/App.tsx", [
    ["React mobile controls", /<MobileExploreControls\b/],
    ["mobile viewport state", /useMobileViewport\(/],
    ["settings shortcut guard", /isExperienceSettingsOpen\(\)/],
    ["guided navigation state", /guidanceEntryId/],
    ["reader progress", /readerProgress/],
    ["non-3D archive route", /<AccessibleArchive\b/],
  ]);
  requirePatterns("src/components/three/StoryScene.tsx", [
    ["desktop pointer-lock controls", /<(?:PointerLockControls|SafePointerLockLookControls)\b/],
    ["transient mobile player input", /usePlayerInputStore\.getState\(\)/],
    ["proportional mobile movement", /mobileMagnitude/],
  ]);
  requirePatterns("src/components/ui/MobileExploreControls.tsx", [
    ["analogue movement semantics", /aria-label=["']Analogue movement control["']/],
    ["independent drag-to-look semantics", /aria-label=["']Drag to look around["']/],
    ["interrupted pointer reset", /onPointerCancel=\{resetPointers\}/],
    ["lost pointer-capture reset", /onLostPointerCapture/],
    ["direct-mode selection", /onModeChange\(["']direct["']\)/],
    ["guided-mode selection", /onModeChange\(["']guided["']\)/],
  ]);
  requirePatterns("src/hooks/useMobileViewport.ts", [
    ["Visual Viewport support", /visualViewport/],
    ["orientation reset", /orientationchange/],
    ["visibility reset", /visibilitychange/],
    ["window blur reset", /["']blur["']/],
    ["page interruption reset", /pagehide/],
  ]);
  requirePatterns("src/stores/useSettingsStore.ts", [
    ["direct and guided persistence", /mobileControlMode/],
    ["left and right handedness persistence", /mobileControlSide/],
    ["finite look sensitivity sanitization", /Number\.isFinite/],
    ["reduced-effects haptics guard", /mobileHaptics:\s*reducedEffects\s*\?\s*false/],
  ]);
  requirePatterns("src/components/ui/AccessibleArchive.tsx", [
    ["witnessed-only searchable prose", /searchableProse\s*=\s*remembered\.has/],
    ["witness evidence before navigation fallback", /new Set\(witnessedEntryIds \?\? visitedEntryIds\)/],
    ["unread guidance action", /onGuideEntry/],
    ["unread prose exclusion copy", /Unread prose is intentionally excluded/],
  ]);
  requirePatterns("src/mobileEnhancements.css", [
    ["safe-area insets", /safe-area-inset/],
    ["dynamic viewport sizing", /100dvh|--app-height|--sidtw-vh/],
    ["touch scrolling protection", /touch-action:\s*none|overscroll-behavior:\s*none/],
  ]);

  const playwright = read("playwright.config.ts");
  const projects = ["chromium", "firefox", "webkit", "mobile-chromium", "mobile-webkit"];
  for (const project of projects) {
    if (!new RegExp(`name:\\s*["']${project}["']`).test(playwright)) {
      fail(`playwright.config.ts is missing the ${project} project.`);
    }
  }
  if (/\btestMatch\s*:/.test(playwright)) {
    fail("Playwright projects must not exclude suites through project-level testMatch filters.");
  }

  const workflow = read(".github/workflows/ci.yml");
  if (/\b(?:deploy|pages deploy|wrangler deploy)\b/i.test(workflow)) {
    fail(".github/workflows/ci.yml must remain non-deploying.");
  }
  if (!/permissions:\s*\n\s*contents:\s*read/m.test(workflow)) {
    fail(".github/workflows/ci.yml must use read-only repository contents permission.");
  }
  if (!/npm\s+ci/.test(workflow) || !/npm\s+run\s+check/.test(workflow) || !/npm\s+run\s+test:e2e/.test(workflow)) {
    fail(".github/workflows/ci.yml must run a clean install, the project check, and the broad Playwright suite.");
  }

  validateWorldData();
}

if (MODE === "lint") validateSourceLint();
else if (MODE === "security") validateSecurity();
else validateIntegration();

for (const message of warnings) console.warn(`WARN: ${message}`);
if (errors.length > 0) {
  for (const message of errors) console.error(`ERROR: ${message}`);
  console.error(`${MODE} validation failed with ${errors.length} error(s).`);
  process.exit(1);
}

if (MODE === "lint") {
  console.log("Static source lint passed for first-party TypeScript/JavaScript and the mobile integration surface.");
} else if (MODE === "security") {
  console.log("Security validation passed for committed-secret patterns, public headers/routes, and session safeguards.");
} else {
  console.log("Mobile integration validation passed for source contracts, tooling, browser projects, and generated world references.");
}
