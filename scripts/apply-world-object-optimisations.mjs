import fs from "node:fs";
import path from "node:path";

const filePath = path.resolve("src/components/three/StoryScene.tsx");
let source = fs.readFileSync(filePath, "utf8");
const original = source;

function replaceFunction(sourceText, functionName, replacement) {
  const start = sourceText.indexOf(functionName);
  if (start === -1) {
    throw new Error(`Could not find ${functionName}`);
  }

  const paramsStart = sourceText.indexOf("(", start);
  if (paramsStart === -1) {
    throw new Error(`Could not find parameter list for ${functionName}`);
  }

  let paramDepth = 0;
  let paramQuote = null;
  let paramEscaped = false;
  let braceStart = -1;

  for (let index = paramsStart; index < sourceText.length; index += 1) {
    const char = sourceText[index];
    if (paramQuote) {
      if (paramEscaped) paramEscaped = false;
      else if (char === "\\") paramEscaped = true;
      else if (char === paramQuote) paramQuote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      paramQuote = char;
      continue;
    }
    if (char === "(") paramDepth += 1;
    if (char === ")") {
      paramDepth -= 1;
      if (paramDepth === 0) {
        braceStart = sourceText.indexOf("{", index);
        break;
      }
    }
  }

  if (braceStart === -1) {
    throw new Error(`Could not find opening body brace for ${functionName}`);
  }

  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = braceStart; index < sourceText.length; index += 1) {
    const char = sourceText[index];
    const next = sourceText[index + 1] ?? "";

    if (lineComment) {
      if (char === "\n") lineComment = false;
      continue;
    }

    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }

    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
      continue;
    }

    if (char === "/" && next === "/") {
      lineComment = true;
      index += 1;
      continue;
    }

    if (char === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }

    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return sourceText.slice(0, start) + replacement + sourceText.slice(index + 1);
      }
    }
  }

  throw new Error(`Could not find closing brace for ${functionName}`);
}

function ensureReactImport() {
  if (source.includes("useLayoutEffect")) return;
  source = source.replace(
    /import \{ ([^}]*useEffect[^}]*) \} from "react";/,
    (match, imports) => `import { ${imports.replace("useEffect,", "useEffect, useLayoutEffect,")} } from "react";`,
  );
}

function ensureLocalGeometryConstants() {
  if (source.includes("LOCAL_RING_SEGMENTS")) return;
  source = source.replace(
    "const PORTAL_TRIGGER_RADIUS_SQ = PORTAL_TRIGGER_RADIUS * PORTAL_TRIGGER_RADIUS;",
    `const PORTAL_TRIGGER_RADIUS_SQ = PORTAL_TRIGGER_RADIUS * PORTAL_TRIGGER_RADIUS;
const LOCAL_RING_SEGMENTS = 64;
const LOCAL_DISC_SEGMENTS = 56;
const LOCAL_TORUS_RADIAL_SEGMENTS = 48;
const LOCAL_SPHERE_SEGMENTS = 8;`,
  );
}

function optimiseStaticLocalGeometry() {
  source = source
    .replace(/<ringGeometry args=\{\[1\.72, 2\.08, 96\]\} \/>/g, "<ringGeometry args={[1.72, 2.08, LOCAL_RING_SEGMENTS]} />")
    .replace(/<circleGeometry args=\{\[1\.45, 96\]\} \/>/g, "<circleGeometry args={[1.45, LOCAL_DISC_SEGMENTS]} />");
}

function replaceLocalObjectRenderers() {
  source = replaceFunction(source, "function ForestMarkers", FOREST_MARKERS);
  source = replaceFunction(source, "function EmberMarkers", EMBER_MARKERS);
  source = replaceFunction(source, "function CrownGlyph", CROWN_GLYPH);
}

const FOREST_MARKERS = "function ForestMarkers({ entry, visitedCount }: { entry: Slipper3DEntry; visitedCount: number }) {\n  const meshRef = useRef<THREE.InstancedMesh>(null);\n  const dummy = useMemo(() => new THREE.Object3D(), []);\n  const seed = hashString(entry.id);\n  const color = entry.engine3d.environmentGradient?.[2] ?? \"#c8b38a\";\n  const trunkCount = Math.min(34, 18 + Math.floor(visitedCount / 5));\n  const opacity = 0.14 + clamp01(visitedCount / 80) * 0.08;\n  const trunks = useMemo(\n    () =>\n      Array.from({ length: trunkCount }, (_, index) => {\n        const side = index % 2 === 0 ? -1 : 1;\n        const x = side * (2.9 + seededUnit(seed, index) * 3.2);\n        const y = -0.15 + seededUnit(seed, index + 12) * 0.35;\n        const z = -3.8 - seededUnit(seed, index + 20) * 5.6;\n        const height = 1.25 + seededUnit(seed, index + 33) * 2.5;\n        const lean = (seededUnit(seed, index + 50) - 0.5) * 0.22;\n        return { x, y, z, height, lean };\n      }),\n    [seed, trunkCount],\n  );\n\n  useLayoutEffect(() => {\n    const mesh = meshRef.current;\n    if (!mesh) return;\n\n    mesh.count = trunks.length;\n    for (let index = 0; index < trunks.length; index += 1) {\n      const trunk = trunks[index];\n      dummy.position.set(trunk.x, trunk.y, trunk.z);\n      dummy.rotation.set(0, 0, trunk.lean);\n      dummy.scale.set(1, trunk.height, 1);\n      dummy.updateMatrix();\n      mesh.setMatrixAt(index, dummy.matrix);\n    }\n\n    mesh.instanceMatrix.needsUpdate = true;\n    mesh.computeBoundingBox();\n    mesh.computeBoundingSphere();\n  }, [dummy, trunks]);\n\n  if (trunks.length === 0) return null;\n\n  return (\n    <instancedMesh ref={meshRef} args={[undefined, undefined, trunkCount]} frustumCulled>\n      <cylinderGeometry args={[0.018, 0.045, 1, 6]} />\n      <meshBasicMaterial color={color} transparent opacity={opacity} />\n    </instancedMesh>\n  );\n}";

const EMBER_MARKERS = "function EmberMarkers({ entry, visitedCount }: { entry: Slipper3DEntry; visitedCount: number }) {\n  const seed = hashString(entry.id);\n  const groupRef = useRef<THREE.Group>(null);\n  const meshRef = useRef<THREE.InstancedMesh>(null);\n  const dummy = useMemo(() => new THREE.Object3D(), []);\n  const emberCount = Math.min(72, 24 + Math.floor(visitedCount * 0.75));\n  const opacity = 0.36 + clamp01(visitedCount / 70) * 0.22;\n  const embers = useMemo(\n    () =>\n      Array.from({ length: emberCount }, (_, index) => ({\n        x: (seededUnit(seed, index) - 0.5) * 4.8,\n        y: -0.8 + seededUnit(seed, index + 20) * 2.8,\n        z: -2.2 - seededUnit(seed, index + 40) * 5.2,\n        scale: 0.018 + seededUnit(seed, index + 60) * (0.042 + clamp01(visitedCount / 50) * 0.025),\n      })),\n    [emberCount, seed, visitedCount],\n  );\n\n  useLayoutEffect(() => {\n    const mesh = meshRef.current;\n    if (!mesh) return;\n\n    mesh.count = embers.length;\n    for (let index = 0; index < embers.length; index += 1) {\n      const ember = embers[index];\n      dummy.position.set(ember.x, ember.y, ember.z);\n      dummy.rotation.set(0, 0, 0);\n      dummy.scale.setScalar(ember.scale);\n      dummy.updateMatrix();\n      mesh.setMatrixAt(index, dummy.matrix);\n    }\n\n    mesh.instanceMatrix.needsUpdate = true;\n    mesh.computeBoundingBox();\n    mesh.computeBoundingSphere();\n  }, [dummy, embers]);\n\n  useFrame(({ clock }) => {\n    if (groupRef.current) {\n      groupRef.current.position.y = Math.sin(clock.elapsedTime * 0.7) * 0.025;\n    }\n  });\n\n  if (embers.length === 0) return null;\n\n  return (\n    <group ref={groupRef}>\n      <instancedMesh ref={meshRef} args={[undefined, undefined, emberCount]} frustumCulled>\n        <sphereGeometry args={[1, LOCAL_SPHERE_SEGMENTS, LOCAL_SPHERE_SEGMENTS]} />\n        <meshBasicMaterial color=\"#d8a86e\" transparent opacity={opacity} />\n      </instancedMesh>\n    </group>\n  );\n}";

const CROWN_GLYPH = "function CrownGlyph({ entry, visitedCount }: { entry: Slipper3DEntry; visitedCount: number }) {\n  const color = entry.engine3d.environmentGradient?.[2] ?? \"#e8d49a\";\n  const meshRef = useRef<THREE.InstancedMesh>(null);\n  const dummy = useMemo(() => new THREE.Object3D(), []);\n  const ringCount = Math.min(5, 2 + Math.floor(visitedCount / 10));\n  const rings = useMemo(\n    () =>\n      Array.from({ length: ringCount }, (_, index) => ({\n        y: index * 0.09,\n        yaw: index * 0.18,\n        radius: 0.38 + index * 0.2,\n      })),\n    [ringCount],\n  );\n\n  useLayoutEffect(() => {\n    const mesh = meshRef.current;\n    if (!mesh) return;\n\n    mesh.count = rings.length;\n    for (let index = 0; index < rings.length; index += 1) {\n      const ring = rings[index];\n      dummy.position.set(0, ring.y, 0);\n      dummy.rotation.set(Math.PI / 2, 0, ring.yaw);\n      dummy.scale.setScalar(ring.radius);\n      dummy.updateMatrix();\n      mesh.setMatrixAt(index, dummy.matrix);\n    }\n\n    mesh.instanceMatrix.needsUpdate = true;\n    mesh.computeBoundingBox();\n    mesh.computeBoundingSphere();\n  }, [dummy, rings]);\n\n  if (rings.length === 0) return null;\n\n  return (\n    <group position={[0, 1.55, -5.8]}>\n      <instancedMesh ref={meshRef} args={[undefined, undefined, ringCount]} frustumCulled>\n        <torusGeometry args={[1, 0.018, 8, LOCAL_TORUS_RADIAL_SEGMENTS]} />\n        <meshBasicMaterial color={color} transparent opacity={0.32 + clamp01(visitedCount / 80) * 0.12} depthWrite={false} />\n      </instancedMesh>\n    </group>\n  );\n}";

ensureReactImport();
ensureLocalGeometryConstants();
optimiseStaticLocalGeometry();
replaceLocalObjectRenderers();

if (source === original) {
  console.log("No world-object optimisation changes were needed.");
  process.exit(0);
}

fs.writeFileSync(filePath, source);
console.log("Applied safe world-object rendering optimisations to src/components/three/StoryScene.tsx");
