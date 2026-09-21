import fs from "node:fs";
import path from "node:path";

const storyScenePath = path.resolve("src/components/three/StoryScene.tsx");
let source = fs.readFileSync(storyScenePath, "utf8");
const original = source;

function stripLegacyPlayerLanternMount(input) {
  // StoryScene contains an older local PlayerLantern implementation. The app now
  // mounts the single canonical lantern through StorySceneWithMasterLantern and
  // MasterPlayerLantern. Strip any local StoryScene PlayerLantern JSX mounts at
  // build time so only one carried lantern/light exists in the rendered scene.
  return input.replace(
    /\n\s*<PlayerLantern\s+[\s\S]*?\/>/g,
    "\n      {/* Local legacy PlayerLantern intentionally disabled. MasterPlayerLantern is the only active lantern. */}",
  );
}

function migrateInstancedRigidBodySensors(input) {
  // @react-three/rapier InstancedRigidBodies is strict: it must have exactly one
  // direct child, and that child must be an instancedMesh. Move legacy sibling
  // sensor nodes into colliderNodes so repair runs preserve both the visuals and
  // their intended sensor behavior. Canonical colliderNodes markup is untouched.
  return input.replace(
    /<InstancedRigidBodies instances=\{(interactiveSemanticRigidBodies\.(?:water|threshold|thorns|celestial))\} type="fixed" colliders=\{false\}>\s*\n\s*(<BallCollider [^\n]+ \/>)\s*\n\s*(<instancedMesh)/g,
    '<InstancedRigidBodies instances={$1} type="fixed" colliders={false} colliderNodes={[$2]}>\n        $3',
  );
}

function optimiseClearingPositionLookups(input) {
  // Reuse the existing WeakMap-backed clearing cache rather than remapping all
  // entry positions each semantic rebuild pass.
  return input.replace(
    "const clearingPositions = useMemo(() => allClearingPositions(entries), [entries]);",
    "const clearingPositions = useMemo(() => getCachedClearingPositions(entries), [entries]);",
  );
}

source = stripLegacyPlayerLanternMount(source);
source = migrateInstancedRigidBodySensors(source);
source = optimiseClearingPositionLookups(source);

if (source !== original) {
  fs.writeFileSync(storyScenePath, source);
  console.log("World render hardening applied: single lantern enforced, instanced Rapier sensors migrated safely, clearing lookups cached.");
} else {
  console.log("World render hardening: no StoryScene changes required.");
}
