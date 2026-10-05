import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
function source(relative) {
  return ts.createSourceFile(relative, readFileSync(join(root, relative), "utf8"),
    ts.ScriptTarget.Latest, true, relative.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
}
function modules(directory) {
  return readdirSync(join(root, directory), { withFileTypes: true }).flatMap(entry => {
    const path = `${directory}/${entry.name}`;
    return entry.isDirectory() ? modules(path) : /\.tsx?$/.test(path) ? [path] : [];
  });
}
function runtimeImports(ast) {
  return ast.statements.filter(ts.isImportDeclaration).filter(statement => {
    const clause = statement.importClause;
    if (!clause) return true;
    if (clause.isTypeOnly) return false;
    if (clause.name || !clause.namedBindings || ts.isNamespaceImport(clause.namedBindings)) return true;
    return clause.namedBindings.elements.some(element => !element.isTypeOnly);
  }).map(statement => statement.moduleSpecifier.text);
}

test("world domains have no runtime dependency back into scene composition", () => {
  const owners = modules("src/world");
  assert.ok(owners.length > 10, "the checks must inspect the extracted implementations");
  for (const owner of owners) {
    for (const imported of runtimeImports(source(owner))) {
      assert.doesNotMatch(imported, /(?:^|\/)StoryScene(?:WithMasterLantern)?(?:\.|$)/,
        `${owner} cannot load its composition parent`);
    }
  }
});

test("canonical terrain and seeded route calculations remain renderer and store independent", () => {
  for (const owner of ["worldPlacement", "worldPaths", "terrainSampler", "terrainGeometry"]) {
    for (const imported of runtimeImports(source(`src/world/terrain/${owner}.ts`))) {
      assert.doesNotMatch(imported, /(?:stores\/|zustand|^react$|@react-three\/)/,
        `${owner} must be executable without mounting a renderer or changing persisted state`);
    }
  }
});

test("physical observers and movement cannot import narrative commands or persisted story state", () => {
  for (const owner of ["PlayerController.tsx", "InteractionController.tsx", "interactionFacts.ts", "interactionProximity.ts", "playerMovement.ts", "playerInput.ts"]) {
    for (const imported of runtimeImports(source(`src/player/${owner}`))) {
      assert.doesNotMatch(imported, /(?:useJourneyStore|narrative\/Story(?:Actions|Runtime|Selectors|Manifest)|storyEvents\/)/,
        `${owner} can report physical evidence but cannot interpret or award narrative progress`);
    }
  }
});

test("extracted terrain and forest workers resolve to the preserved production worker", () => {
  const found = [];
  for (const owner of modules("src/world")) {
    const inspect = node => {
      if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "Worker") {
        const url = node.arguments?.[0];
        assert.ok(url && ts.isNewExpression(url) && ts.isIdentifier(url.expression) && url.expression.text === "URL", `${owner}: worker requires a bundler-resolved URL`);
        const path = url.arguments?.[0];
        assert.ok(path && ts.isStringLiteral(path), `${owner}: worker URL must be a stable source path`);
        const resolved = resolve(root, dirname(owner), path.text);
        assert.ok(existsSync(resolved), `${owner}: worker source exists`);
        assert.equal(resolved, join(root, "src/workers/forestWorker.ts"));
        found.push(owner);
      }
      ts.forEachChild(node, inspect);
    };
    inspect(source(owner));
  }
  assert.deepEqual(found.sort(), ["src/world/forest/ContinuousForestBed.tsx", "src/world/terrain/HillyForestGround.tsx"]);
});
