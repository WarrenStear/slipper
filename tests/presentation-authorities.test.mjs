import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
function files(directory) {
  return readdirSync(resolve(root, directory), { withFileTypes: true }).flatMap(entry => {
    const path = `${directory}/${entry.name}`;
    return entry.isDirectory() ? files(path) : path.endsWith(".tsx") ? [path] : [];
  });
}
const components = files("src").map(path => ({ path, ast: ts.createSourceFile(path,
  readFileSync(resolve(root, path), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX) }));

// Resolve JSX through the imported binding, including aliases. Comments, shader
// strings and historic component re-exports are not mounted component instances.
function mountsOf(componentPath, exportedName) {
  const target = resolve(root, componentPath).replace(/\.tsx$/, "");
  const mounts = [];
  for (const { path, ast } of components) {
    const bindings = new Set();
    for (const statement of ast.statements) {
      if (!ts.isImportDeclaration(statement) || statement.importClause?.isTypeOnly
        || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
      const imported = resolve(root, dirname(path), statement.moduleSpecifier.text).replace(/\.tsx$/, "");
      if (imported !== target) continue;
      const clause = statement.importClause;
      if (clause?.name && exportedName === "default") bindings.add(clause.name.text);
      if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        for (const binding of clause.namedBindings.elements) {
          if (!binding.isTypeOnly && (binding.propertyName ?? binding.name).text === exportedName) bindings.add(binding.name.text);
        }
      }
    }
    const inspect = node => {
      if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node))
        && ts.isIdentifier(node.tagName) && bindings.has(node.tagName.text)) mounts.push(path);
      ts.forEachChild(node, inspect);
    };
    inspect(ast);
  }
  return mounts.sort();
}

test("the carried lantern has exactly one production composition owner", () => {
  assert.deepEqual(mountsOf("src/components/three/MasterPlayerLantern.tsx", "default"),
    ["src/components/three/StorySceneWithMasterLantern.tsx"]);
  assert.deepEqual(mountsOf("src/components/three/MasterPlayerLantern.tsx", "MasterPlayerLantern"), []);
});

test("canonical lighting and atmosphere are mounted only by the shared scene look", () => {
  for (const [path, name] of [["src/world/lighting/SceneLighting.tsx", "SceneLighting"],
    ["src/world/atmosphere/SceneAtmosphere.tsx", "SceneAtmosphere"]]) {
    assert.deepEqual(mountsOf(path, name), ["src/components/three/artDirection/SceneLookDirector.tsx"]);
    // Historic reexports remain usable by reviews, but cannot evade the single
    // production owner contract through an old import path.
    const historic = `src/components/three/artDirection/${name}.tsx`;
    assert.deepEqual(mountsOf(historic, name), []);
    assert.deepEqual(mountsOf(historic, "default"), []);
  }
});

test("canonical airborne particles share the same composition owner", () => {
  assert.deepEqual(mountsOf("src/world/atmosphere/SceneParticles.tsx", "SceneParticles"),
    ["src/components/three/artDirection/SceneLookDirector.tsx"]);
  assert.deepEqual(mountsOf("src/world/atmosphere/SceneParticles.tsx", "default"), []);
});
