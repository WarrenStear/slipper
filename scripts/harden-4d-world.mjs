import fs from "node:fs";
import path from "node:path";

const contentMigrationPath = path.resolve("src/lib/contentMigration.ts");
const storyScenePath = path.resolve("src/components/three/StoryScene.tsx");

function write(filePath, next, label) {
  const current = fs.readFileSync(filePath, "utf8");
  if (current === next) {
    console.log(`[harden-4d-world] ${label}: already clean`);
    return;
  }
  fs.writeFileSync(filePath, next);
  console.log(`[harden-4d-world] ${label}: applied`);
}

function replaceOrSkip(source, from, to, label, marker = to) {
  if (source.includes(from)) {
    console.log(`[harden-4d-world] ${label}: applied`);
    return source.replace(from, to);
  }
  if (source.includes(marker)) {
    console.log(`[harden-4d-world] ${label}: already applied`);
    return source;
  }
  throw new Error(`[harden-4d-world] Could not find patch target: ${label}`);
}

const balancedTagTarget = `function entrySequenceValue(entry: Slipper3DEntry) {
  return entry.sequence ?? Number.MAX_SAFE_INTEGER;
}

function findBalancedTagTarget(entries: Slipper3DEntry[], entry: Slipper3DEntry, tag: string) {
  const sourceSequence = entrySequenceValue(entry);
  const candidates = entries.filter((candidate) => candidate.id !== entry.id && candidate.tags.includes(tag));

  if (candidates.length === 0) return undefined;

  return candidates
    .map((candidate) => {
      const candidateSequence = entrySequenceValue(candidate);
      const sequenceDelta = Math.abs(candidateSequence - sourceSequence);
      const forwardBias = candidateSequence > sourceSequence ? -0.35 : 0;
      const chapterBias = candidate.chapter === entry.chapter ? -0.75 : 0;
      return { candidate, score: sequenceDelta + forwardBias + chapterBias };
    })
    .sort((a, b) => a.score - b.score || entrySequenceValue(a.candidate) - entrySequenceValue(b.candidate))[0]?.candidate;
}`;

let migration = fs.readFileSync(contentMigrationPath, "utf8");
migration = replaceOrSkip(
  migration,
  `function findFirstOtherByTag(entries: Slipper3DEntry[], entry: Slipper3DEntry, tag: string) {
  return entries.find((candidate) => candidate.id !== entry.id && candidate.tags.includes(tag));
}`,
  balancedTagTarget,
  "balance generated tag portals toward nearby sequence/chapter targets",
  "function findBalancedTagTarget",
);
migration = replaceOrSkip(
  migration,
  `.map((tag) => ({ tag, target: findFirstOtherByTag(entries, entry, tag) }));`,
  `.map((tag) => ({ tag, target: findBalancedTagTarget(entries, entry, tag) }));`,
  "use balanced tag target selection during world-state generation",
  "findBalancedTagTarget(entries, entry, tag)",
);
write(contentMigrationPath, migration, "content migration hardening");

const spawnEffect = `  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;

    const spawnKey = activeEntry.id;
    if (lastSpawnEntryIdRef.current === spawnKey) return;

    const spawn = { x: initialPosition[0], y: initialPosition[1], z: initialPosition[2] };
    body.setTranslation(spawn, true);
    body.setNextKinematicTranslation(spawn);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);

    horizontalVelocityRef.current.set(0, 0, 0);
    targetVelocityRef.current.set(0, 0, 0);
    desiredMoveRef.current.set(0, 0, 0);
    verticalVelocityRef.current = 0;
    bobPhaseRef.current = 0;
    groundProbeRef.current = { x: initialPosition[0], z: initialPosition[2], y: initialPosition[1] - PLAYER_FOOT_OFFSET - PLAYER_GROUND_CLEARANCE };
    groundProbeTimerRef.current = 0;
    resetPlayerKeys(keysRef.current);
    camera.position.set(spawn.x, spawn.y + PLAYER_CAMERA_OFFSET_Y, spawn.z);

    lastSpawnEntryIdRef.current = spawnKey;
  }, [activeEntry.id, camera, initialPosition, keysRef]);`;

let scene = fs.readFileSync(storyScenePath, "utf8");
if (scene.includes("const hasSpawnedRef = useRef(false);")) {
  scene = scene.replace("const hasSpawnedRef = useRef(false);", "const lastSpawnEntryIdRef = useRef<string | null>(null);");
  console.log("[harden-4d-world] replace one-time spawn guard with active-entry spawn guard: applied");
} else if (!scene.includes("lastSpawnEntryIdRef")) {
  scene = scene.replace("const controllerRef = useRef<any>(null);", "const controllerRef = useRef<any>(null);\n  const lastSpawnEntryIdRef = useRef<string | null>(null);");
  console.log("[harden-4d-world] add active-entry spawn guard: applied");
} else {
  console.log("[harden-4d-world] active-entry spawn guard: already applied");
}

const oldSpawnEffectPattern = /  useEffect\(\(\) => \{\n    const body = bodyRef\.current;\n    if \(!body \|\| hasSpawnedRef\.current\) return;[\s\S]*?hasSpawnedRef\.current = true;\n  \}, \[initialPosition\]\);/;
if (oldSpawnEffectPattern.test(scene)) {
  scene = scene.replace(oldSpawnEffectPattern, spawnEffect);
  console.log("[harden-4d-world] reset player body and camera when the active clearing changes: applied");
} else if (scene.includes("lastSpawnEntryIdRef.current === spawnKey")) {
  console.log("[harden-4d-world] reset player body and camera when the active clearing changes: already applied");
} else {
  throw new Error("[harden-4d-world] Could not find spawn reset effect to harden");
}

const oldProximity = `    for (const node of nodes) {
      const dx = camera.position.x - node.position[0];
      const dz = camera.position.z - node.position[2];
      const distanceSq = dx * dx + dz * dz;
      if (distanceSq < closestDistanceSq) {
        closestDistanceSq = distanceSq;
        closestNode = node;
      }
      if (!node.isActive && distanceSq < closestInactiveDistanceSq) {
        closestInactiveDistanceSq = distanceSq;
        closestInactiveNode = node;
      }
    }`;
const newProximity = `    for (const node of nodes) {
      const dx = camera.position.x - node.position[0];
      const dy = camera.position.y - (node.position[1] + PLAYER_CAMERA_OFFSET_Y);
      const dz = camera.position.z - node.position[2];
      const horizontalDistanceSq = dx * dx + dz * dz;
      const verticalGap = Math.max(0, Math.abs(dy) - 3.5);
      const distanceSq = horizontalDistanceSq + verticalGap * verticalGap * 2.25;
      if (distanceSq < closestDistanceSq) {
        closestDistanceSq = distanceSq;
        closestNode = node;
      }
      if (!node.isActive && distanceSq < closestInactiveDistanceSq) {
        closestInactiveDistanceSq = distanceSq;
        closestInactiveNode = node;
      }
    }`;
scene = replaceOrSkip(scene, oldProximity, newProximity, "make node proximity height-aware for elevated Crowned Return areas", "verticalGap * verticalGap * 2.25");

if (scene.includes("hasSpawnedRef")) {
  throw new Error("[harden-4d-world] Residual hasSpawnedRef reference remains after hardening");
}
write(storyScenePath, scene, "StoryScene hardening");
