#!/usr/bin/env node
/*
  Apply Phase 1 + Phase 2 patches to the current SIDTW project.
  Run from project root after copying this file into scripts/apply-phase-1-2.cjs:
    node scripts/apply-phase-1-2.cjs
*/
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const storyPath = path.join(root, "src/components/three/StoryScene.tsx");
const portalPath = path.join(root, "src/components/three/Portal.tsx");

function findFunctionBodyBrace(source, start) {
  let parenDepth = 0;
  let quote = null;
  let escaped = false;

  for (let i = start; i < source.length; i += 1) {
    const c = source[i];

    if (quote) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === quote) quote = null;
      continue;
    }

    if (c === '"' || c === "'" || c === "`") {
      quote = c;
      continue;
    }

    if (c === "(") parenDepth += 1;
    else if (c === ")") parenDepth = Math.max(0, parenDepth - 1);
    else if (c === "{" && parenDepth === 0) return i;
  }

  throw new Error("Could not find function body brace.");
}

function replaceFunction(source, functionName, replacement) {
  const start = source.indexOf(`function ${functionName}`);
  if (start < 0) throw new Error(`Could not find function ${functionName}`);
  const braceStart = findFunctionBodyBrace(source, start);
  let depth = 0;
  let quote = null;
  let escaped = false;

  for (let i = braceStart; i < source.length; i += 1) {
    const c = source[i];

    if (quote) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === quote) quote = null;
      continue;
    }

    if (c === '"' || c === "'" || c === "`") {
      quote = c;
      continue;
    }

    if (c === "{") depth += 1;
    if (c === "}") depth -= 1;

    if (depth === 0) {
      return source.slice(0, start) + replacement + source.slice(i + 1);
    }
  }

  throw new Error(`Could not find function end for ${functionName}`);
}

const kccReplacement = "const PLAYER_RADIUS = 0.28;\nconst PLAYER_HALF_HEIGHT = 0.54;\nconst PLAYER_KCC_OFFSET = 0.045;\nconst PLAYER_GRAVITY = 18;\nconst PLAYER_MAX_FALL_SPEED = 22;\nconst PLAYER_GROUND_SNAP = 0.28;\nconst PLAYER_STEP_HEIGHT = 0.38;\nconst PLAYER_MIN_STEP_WIDTH = 0.18;\nconst PLAYER_SLOPE_LIMIT_RADIANS = THREE.MathUtils.degToRad(48);\n\nfunction FirstPersonPlayer({\n  enabled,\n  cameraReadyRef,\n  initialPosition,\n}: {\n  enabled: boolean;\n  cameraReadyRef: { current: boolean };\n  initialPosition: Vector3Tuple;\n}) {\n  const { camera } = useThree();\n  const { world } = useRapier();\n\n  const bodyRef = useRef<RapierRigidBody>(null);\n  const colliderRef = useRef<any>(null);\n  const controllerRef = useRef<any>(null);\n  const hasSpawnedRef = useRef(false);\n  const keysRef = usePlayerControls(enabled);\n\n  const horizontalVelocityRef = useRef(new THREE.Vector3());\n  const targetVelocityRef = useRef(new THREE.Vector3());\n  const desiredMoveRef = useRef(new THREE.Vector3());\n  const forwardRef = useRef(new THREE.Vector3());\n  const rightRef = useRef(new THREE.Vector3());\n  const verticalVelocityRef = useRef(0);\n  const bobPhaseRef = useRef(0);\n\n  useEffect(() => {\n    const controller = world.createCharacterController(PLAYER_KCC_OFFSET);\n    controller.setUp({ x: 0, y: 1, z: 0 });\n    controller.enableAutostep(PLAYER_STEP_HEIGHT, PLAYER_MIN_STEP_WIDTH, true);\n    controller.enableSnapToGround(PLAYER_GROUND_SNAP);\n    controller.setMaxSlopeClimbAngle(PLAYER_SLOPE_LIMIT_RADIANS);\n    controller.setMinSlopeSlideAngle(THREE.MathUtils.degToRad(58));\n    controllerRef.current = controller;\n\n    return () => {\n      world.removeCharacterController(controller);\n      controllerRef.current = null;\n    };\n  }, [world]);\n\n  useEffect(() => {\n    const body = bodyRef.current;\n    if (!body || hasSpawnedRef.current) return;\n    body.setTranslation({ x: initialPosition[0], y: initialPosition[1], z: initialPosition[2] }, true);\n    body.setNextKinematicTranslation({ x: initialPosition[0], y: initialPosition[1], z: initialPosition[2] });\n    verticalVelocityRef.current = 0;\n    hasSpawnedRef.current = true;\n  }, [initialPosition]);\n\n  useEffect(() => {\n    if (!enabled) {\n      horizontalVelocityRef.current.set(0, 0, 0);\n      targetVelocityRef.current.set(0, 0, 0);\n      desiredMoveRef.current.set(0, 0, 0);\n      verticalVelocityRef.current = 0;\n    }\n  }, [enabled]);\n\n  useFrame((_, delta) => {\n    const body = bodyRef.current;\n    const collider = colliderRef.current;\n    const controller = controllerRef.current;\n    if (!body || !collider || !controller) return;\n\n    const step = Math.min(delta, 0.05);\n    const current = body.translation();\n\n    if (!enabled || !cameraReadyRef.current) {\n      camera.position.set(current.x, current.y + PLAYER_CAMERA_OFFSET_Y, current.z);\n      return;\n    }\n\n    const keys = keysRef.current;\n    const forward = forwardRef.current;\n    const right = rightRef.current;\n    const targetVelocity = targetVelocityRef.current.set(0, 0, 0);\n    const horizontalVelocity = horizontalVelocityRef.current;\n\n    camera.getWorldDirection(forward);\n    forward.y = 0;\n    if (forward.lengthSq() > 0.0001) forward.normalize();\n\n    right.copy(forward).cross(camera.up);\n    if (right.lengthSq() > 0.0001) right.normalize();\n\n    if (keys.forward) targetVelocity.add(forward);\n    if (keys.backward) targetVelocity.addScaledVector(forward, -1);\n    if (keys.right) targetVelocity.add(right);\n    if (keys.left) targetVelocity.addScaledVector(right, -1);\n\n    if (targetVelocity.lengthSq() > 0.0001) targetVelocity.normalize().multiplyScalar(PLAYER_SPEED);\n\n    horizontalVelocity.lerp(targetVelocity, 1 - Math.exp(-step * PLAYER_ACCELERATION));\n    verticalVelocityRef.current = Math.max(verticalVelocityRef.current - PLAYER_GRAVITY * step, -PLAYER_MAX_FALL_SPEED);\n\n    const desiredMove = desiredMoveRef.current.set(horizontalVelocity.x * step, verticalVelocityRef.current * step, horizontalVelocity.z * step);\n    controller.computeColliderMovement(collider, { x: desiredMove.x, y: desiredMove.y, z: desiredMove.z });\n    const corrected = controller.computedMovement();\n\n    if (controller.computedGrounded()) verticalVelocityRef.current = Math.max(0, verticalVelocityRef.current);\n\n    const next = { x: current.x + corrected.x, y: current.y + corrected.y, z: current.z + corrected.z };\n    body.setNextKinematicTranslation(next);\n\n    const speedRatio = clamp01(horizontalVelocity.length() / PLAYER_SPEED);\n    bobPhaseRef.current += step * HEAD_BOB_FREQUENCY * (0.25 + speedRatio);\n    const bob = Math.sin(bobPhaseRef.current) * HEAD_BOB_AMPLITUDE * speedRatio;\n    camera.position.set(next.x, next.y + PLAYER_CAMERA_OFFSET_Y + bob, next.z);\n  });\n\n  return (\n    <RigidBody ref={bodyRef} type=\"kinematicPosition\" position={initialPosition} colliders={false} lockRotations canSleep={false}>\n      <CapsuleCollider ref={colliderRef} args={[PLAYER_HALF_HEIGHT, PLAYER_RADIUS]} position={[0, 0, 0]} friction={0} restitution={0} />\n    </RigidBody>\n  );\n}\n";
const forestReplacement = "function ContinuousForestBed({ entries, narrativeWorldState }: { entries: Slipper3DEntry[]; narrativeWorldState: NarrativeWorldState }) {\n  const { camera } = useThree();\n\n  const trunkRef = useRef<THREE.InstancedMesh>(null);\n  const crownRef = useRef<THREE.InstancedMesh>(null);\n  const marshRef = useRef<THREE.InstancedMesh>(null);\n  const ruinRef = useRef<THREE.InstancedMesh>(null);\n\n  const workerRef = useRef<Worker | null>(null);\n  const requestIdRef = useRef(0);\n  const lastCellRef = useRef<string | null>(null);\n\n  const [treeColliders, setTreeColliders] = useState<PackedForestCollider[]>([]);\n\n  const clearingSeeds = useMemo(\n    () =>\n      entries.map((entry) => ({\n        id: entry.id,\n        chapter: entry.chapter,\n        position: entryWorldPosition(entry, entries),\n      })),\n    [entries],\n  );\n\n  const pathSegments = useMemo(() => buildMazePathSegments(entries), [entries]);\n  const crownRampSegments = useMemo(() => buildCrownRampSegments(entries), [entries]);\n\n  const pathSeeds = useMemo<ForestPathSeed[]>(\n    () =>\n      pathSegments.map((segment) => {\n        const source = entryWorldPosition(segment.sourceEntry, entries);\n        const target = entryWorldPosition(segment.targetEntry, entries);\n\n        return {\n          source: [source[0], source[2]],\n          target: [target[0], target[2]],\n          sourceChapter: segment.sourceEntry.chapter,\n          targetChapter: segment.targetEntry.chapter,\n          sourceY: source[1],\n          targetY: target[1],\n        };\n      }),\n    [entries, pathSegments],\n  );\n\n  useEffect(() => {\n    const worker = new Worker(new URL(\"../../workers/forestWorker.ts\", import.meta.url), { type: \"module\" });\n    workerRef.current = worker;\n\n    worker.onmessage = (event: MessageEvent<ForestWorkerResponse>) => {\n      const result = event.data;\n      if (result.requestId !== requestIdRef.current) return;\n\n      const meshes = [\n        { mesh: trunkRef.current, matrices: result.trunkMatrices, colors: result.trunkColors },\n        { mesh: crownRef.current, matrices: result.crownMatrices, colors: result.crownColors },\n        { mesh: marshRef.current, matrices: result.marshMatrices, colors: result.marshColors },\n        { mesh: ruinRef.current, matrices: result.ruinMatrices, colors: result.ruinColors },\n      ];\n\n      for (const item of meshes) {\n        if (!item.mesh) continue;\n        item.mesh.instanceMatrix.array.set(item.matrices);\n        item.mesh.instanceMatrix.needsUpdate = true;\n\n        if (!item.mesh.instanceColor) {\n          item.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(FOREST_INSTANCE_COUNT * 3), 3);\n        }\n\n        item.mesh.instanceColor.array.set(item.colors);\n        item.mesh.instanceColor.needsUpdate = true;\n      }\n\n      setTreeColliders(result.colliders);\n    };\n\n    return () => {\n      worker.terminate();\n      workerRef.current = null;\n    };\n  }, []);\n\n  const requestForestBuild = (cellX: number, cellZ: number) => {\n    const worker = workerRef.current;\n    if (!worker) return;\n\n    requestIdRef.current += 1;\n\n    const config: ForestWorkerConfig = {\n      cellSize: FOREST_CELL_SIZE,\n      cellRadius: FOREST_CELL_RADIUS,\n      treesPerCell: FOREST_TREES_PER_CELL,\n      instanceCount: FOREST_INSTANCE_COUNT,\n      clearingSafeRadius: CLEARING_SAFE_RADIUS,\n      corridorBaseWidth: CORRIDOR_BASE_WIDTH,\n      corridorMinWidth: CORRIDOR_MIN_WIDTH,\n      treeColliderLimit: TREE_COLLIDER_LIMIT,\n      terrainBaseY: TERRAIN_BASE_Y,\n      terrainColliderY: TERRAIN_COLLIDER_Y,\n      crownedRampWidth: CROWNED_RETURN_RAMP_WIDTH,\n      cameraX: camera.position.x,\n      cameraZ: camera.position.z,\n      cellX,\n      cellZ,\n      explorationDepth: narrativeWorldState.explorationDepth,\n      memoryPressure: narrativeWorldState.memoryPressure,\n      clearings: clearingSeeds,\n      paths: pathSeeds,\n    };\n\n    worker.postMessage({ type: \"BUILD_FOREST\", requestId: requestIdRef.current, config });\n  };\n\n  useFrame(() => {\n    const cellX = Math.floor(camera.position.x / FOREST_CELL_SIZE);\n    const cellZ = Math.floor(camera.position.z / FOREST_CELL_SIZE);\n    const key = [cellX, cellZ, Math.round(narrativeWorldState.explorationDepth * 100), Math.round(narrativeWorldState.memoryPressure * 100), entries.length].join(\":\");\n    if (lastCellRef.current === key) return;\n    lastCellRef.current = key;\n    requestForestBuild(cellX, cellZ);\n  });\n\n  return (\n    <group>\n      <RigidBody type=\"fixed\" colliders={false}>\n        {treeColliders.map((collider, index) => (\n          <CuboidCollider key={`forest-collider-${index}`} args={collider.args} position={collider.position} friction={1.4} />\n        ))}\n        {crownRampSegments.map((segment) => (\n          <CuboidCollider key={segment.key} args={segment.args} position={segment.position} rotation={segment.rotation} friction={1.4} />\n        ))}\n      </RigidBody>\n\n      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, TERRAIN_BASE_Y, 0]} receiveShadow>\n        <planeGeometry args={[840, 840, 1, 1]} />\n        <meshBasicMaterial color=\"#060705\" transparent opacity={0.92} />\n      </mesh>\n\n      {crownRampSegments.map((segment) => (\n        <mesh key={`visual-${segment.key}`} position={[segment.position[0], TERRAIN_BASE_Y + (segment.source[1] + segment.target[1]) * 0.5, segment.position[2]]} rotation={segment.rotation} scale={segment.visualScale} receiveShadow>\n          <boxGeometry args={[1, 1, 1]} />\n          <meshBasicMaterial color={segment.color} transparent opacity={0.62} />\n        </mesh>\n      ))}\n\n      <instancedMesh ref={trunkRef} args={[undefined, undefined, FOREST_INSTANCE_COUNT]} frustumCulled={false}>\n        <cylinderGeometry args={[1, 1, 1, 6]} />\n        <meshBasicMaterial vertexColors transparent opacity={0.82} />\n      </instancedMesh>\n\n      <instancedMesh ref={crownRef} args={[undefined, undefined, FOREST_INSTANCE_COUNT]} frustumCulled={false}>\n        <coneGeometry args={[1, 1, 7]} />\n        <meshBasicMaterial vertexColors transparent opacity={0.24 + narrativeWorldState.memoryPressure * 0.16} depthWrite={false} />\n      </instancedMesh>\n\n      <instancedMesh ref={marshRef} args={[undefined, undefined, FOREST_INSTANCE_COUNT]} frustumCulled={false}>\n        <circleGeometry args={[1, 48]} />\n        <meshStandardMaterial vertexColors color=\"#9fbfc5\" emissive=\"#17333a\" emissiveIntensity={0.08} metalness={0.42} roughness={0.18} transparent opacity={0.28} side={THREE.DoubleSide} depthWrite={false} />\n      </instancedMesh>\n\n      <instancedMesh ref={ruinRef} args={[undefined, undefined, FOREST_INSTANCE_COUNT]} frustumCulled={false}>\n        <boxGeometry args={[1, 1, 1]} />\n        <meshBasicMaterial vertexColors transparent opacity={0.72} />\n      </instancedMesh>\n    </group>\n  );\n}\n";
const portalLookThrough = "\nfunction PortalLookThrough({\n  color,\n  targetEntry,\n  narrativeWorldState,\n  isTriggering,\n}: {\n  color: string;\n  targetEntry?: Slipper3DEntry;\n  narrativeWorldState: NarrativeWorldState;\n  isTriggering: boolean;\n}) {\n  const gradient = targetEntry?.engine3d.environmentGradient ?? [\"#090807\", \"#1a1612\"];\n  const title = targetEntry?.title ?? \"Unknown clearing\";\n\n  const fire = narrativeWorldState.fireWaterBalance > 0.15;\n  const water = narrativeWorldState.fireWaterBalance < -0.15;\n\n  return (\n    <mesh position={[0, 0, -0.026]}>\n      <circleGeometry args={[0.49, 96]} />\n      <meshBasicMaterial transparent opacity={isTriggering ? 0.95 : 0.78} toneMapped={false}>\n        <RenderTexture attach=\"map\" width={768} height={768} anisotropy={8}>\n          <PerspectiveCamera makeDefault manual aspect={1} position={[0, 1.1, 4.2]} fov={45} />\n          <color attach=\"background\" args={[gradient[0]]} />\n          <ambientLight intensity={0.8} />\n          <pointLight position={[0, 2.5, 2]} intensity={1.8} color={color} />\n\n          <mesh position={[0, -0.7, 0]} rotation={[-Math.PI / 2, 0, 0]}>\n            <circleGeometry args={[2.2, 96]} />\n            <meshBasicMaterial color={gradient[1]} transparent opacity={0.92} />\n          </mesh>\n\n          <mesh position={[-0.75, 0.1, -0.25]}>\n            <coneGeometry args={[0.35, 1.8, 7]} />\n            <meshBasicMaterial color={fire ? \"#9d3f1f\" : water ? \"#4d7f90\" : \"#1d2a1d\"} />\n          </mesh>\n\n          <mesh position={[0.8, 0.15, -0.45]}>\n            <coneGeometry args={[0.42, 2.1, 7]} />\n            <meshBasicMaterial color={fire ? \"#6f2b18\" : water ? \"#335e72\" : \"#142114\"} />\n          </mesh>\n\n          <mesh position={[0, 0.4, -0.8]}>\n            <sphereGeometry args={[0.22, 24, 24]} />\n            <meshBasicMaterial color={color} transparent opacity={0.58} />\n          </mesh>\n\n          <Text position={[0, -1.08, 0.2]} fontSize={0.11} maxWidth={2.2} textAlign=\"center\" anchorX=\"center\" anchorY=\"middle\" color=\"#f5ead2\">\n            {title}\n          </Text>\n        </RenderTexture>\n      </meshBasicMaterial>\n    </mesh>\n  );\n}\n";

let story = fs.readFileSync(storyPath, "utf8");
story = story.replace(
  'import { CapsuleCollider, CuboidCollider, RigidBody, type RapierRigidBody } from "@react-three/rapier";',
  'import { CapsuleCollider, CuboidCollider, RigidBody, useRapier, type RapierRigidBody } from "@react-three/rapier";',
);
if (!story.includes('from "../../workers/forestWorker.types"')) {
  story = story.replace(
    'import type { EulerTuple, PortalLocation, Slipper3DEntry, Slipper3DVisual, Vector3Tuple } from "../../data/slipper3dTypes";\n',
    'import type { EulerTuple, PortalLocation, Slipper3DEntry, Slipper3DVisual, Vector3Tuple } from "../../data/slipper3dTypes";\nimport type { ForestPathSeed, ForestWorkerConfig, ForestWorkerResponse, PackedForestCollider } from "../../workers/forestWorker.types";\n',
  );
}
story = replaceFunction(story, "FirstPersonPlayer", kccReplacement);
story = replaceFunction(story, "ContinuousForestBed", forestReplacement);
fs.writeFileSync(storyPath, story);

let portal = fs.readFileSync(portalPath, "utf8");
portal = portal.replace(
  'import { Html, useCursor, useTexture } from "@react-three/drei";',
  'import { Html, PerspectiveCamera, RenderTexture, Text, useCursor, useTexture } from "@react-three/drei";',
);
if (!portal.includes("function PortalLookThrough")) {
  portal = portal.replace("function TemporalEcho({", `${portalLookThrough}\n\nfunction TemporalEcho({`);
}
portal = portal.replace(
  '      <TemporalEcho targetEntry={targetEntry} targetVisual={targetVisual} narrativeWorldState={narrativeWorldState} hovered={hovered} isTriggering={isTriggering} />',
  '      <PortalLookThrough color={color} targetEntry={targetEntry} narrativeWorldState={narrativeWorldState} isTriggering={isTriggering} />\n      <TemporalEcho targetEntry={targetEntry} targetVisual={targetVisual} narrativeWorldState={narrativeWorldState} hovered={hovered} isTriggering={isTriggering} />',
);
fs.writeFileSync(portalPath, portal);

console.log("Applied Phase 1 + Phase 2 StoryScene and Portal patches.");
