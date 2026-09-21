import fs from "node:fs";
import path from "node:path";

function replaceAll(source, replacements) {
  let next = source;
  for (const [pattern, replacement] of replacements) {
    next = next.replace(pattern, replacement);
  }
  return next;
}

function patchStoryScene() {
  const filePath = path.resolve("src/components/three/StoryScene.tsx");
  let source = fs.readFileSync(filePath, "utf8");
  const original = source;

  source = replaceAll(source, [
    [/const TREE_COLLIDER_LIMIT = 96;/g, "const TREE_COLLIDER_LIMIT = 72;"],
    [/const PLAYER_RADIUS = 0\.28;/g, "const PLAYER_RADIUS = 0.24;"],
    [/const PLAYER_HALF_HEIGHT = 0\.54;/g, "const PLAYER_HALF_HEIGHT = 0.58;"],
    [/const PLAYER_GROUND_CLEARANCE = 0\.035;/g, "const PLAYER_GROUND_CLEARANCE = 0.055;"],
    [/const PLAYER_KCC_OFFSET = 0\.045;/g, "const PLAYER_KCC_OFFSET = 0.075;"],
    [/const PLAYER_GROUND_SNAP = 0\.34;/g, "const PLAYER_GROUND_SNAP = 0.48;"],
    [/const PLAYER_STEP_HEIGHT = 0\.42;/g, "const PLAYER_STEP_HEIGHT = 0.5;"],
    [/const PLAYER_MIN_STEP_WIDTH = 0\.18;/g, "const PLAYER_MIN_STEP_WIDTH = 0.26;"],
    [/const PLAYER_SLOPE_LIMIT_RADIANS = THREE\.MathUtils\.degToRad\(48\);/g, "const PLAYER_SLOPE_LIMIT_RADIANS = THREE.MathUtils.degToRad(52);"],
  ]);

  if (!source.includes("lastSafePlayerPositionRef")) {
    source = source.replace(
      "  const groundProbeTimerRef = useRef(0);",
      `  const groundProbeTimerRef = useRef(0);
  const lastSafePlayerPositionRef = useRef(new THREE.Vector3(initialPosition[0], initialPosition[1], initialPosition[2]));
  const stuckTimerRef = useRef(0);`,
    );
  }

  if (!source.includes("setSlideEnabled")) {
    source = source.replace(
      "    controller.enableSnapToGround(PLAYER_GROUND_SNAP);",
      `    controller.enableSnapToGround(PLAYER_GROUND_SNAP);
    if (typeof controller.setSlideEnabled === "function") controller.setSlideEnabled(true);`,
    );
  }

  if (!source.includes("lastSafePlayerPositionRef.current.set(initialPosition[0]")) {
    source = source.replace(
      "    groundProbeTimerRef.current = 0;\n    hasSpawnedRef.current = true;",
      `    groundProbeTimerRef.current = 0;
    lastSafePlayerPositionRef.current.set(initialPosition[0], initialPosition[1], initialPosition[2]);
    stuckTimerRef.current = 0;
    hasSpawnedRef.current = true;`,
    );
  }

  if (!source.includes("Emergency anti-wedge guard")) {
    source = source.replace(
      `    if (shouldTerrainSnap) {
      next.y = minimumBodyY;
      verticalVelocityRef.current = 0;
    }

    body.setNextKinematicTranslation(next);`,
      `    if (shouldTerrainSnap) {
      next.y = minimumBodyY;
      verticalVelocityRef.current = 0;
    }

    // Emergency anti-wedge guard: generated forest/thorn colliders are intentionally
    // dense, so if the KCC reports almost no horizontal movement while the player
    // is actively trying to move, return to the last safe capsule position instead
    // of letting the camera remain embedded in a collider pocket.
    const wantedHorizontalSq = desiredMove.x * desiredMove.x + desiredMove.z * desiredMove.z;
    const movedHorizontalSq = corrected.x * corrected.x + corrected.z * corrected.z;
    if (wantedHorizontalSq > 0.0008 && movedHorizontalSq < wantedHorizontalSq * 0.045) {
      stuckTimerRef.current += step;
    } else {
      stuckTimerRef.current = 0;
      lastSafePlayerPositionRef.current.set(next.x, next.y, next.z);
    }

    if (stuckTimerRef.current > 0.32) {
      const safe = lastSafePlayerPositionRef.current;
      next.x = safe.x;
      next.z = safe.z;
      next.y = Math.max(next.y, safe.y);
      horizontalVelocity.multiplyScalar(0.12);
      verticalVelocityRef.current = 0;
      stuckTimerRef.current = 0;
    }

    body.setNextKinematicTranslation(next);`,
    );
  }

  if (source !== original) {
    fs.writeFileSync(filePath, source);
    console.log("Upgraded player collision controller, anti-wedge guard, and capsule clearance.");
  } else {
    console.log("Player collision controller upgrade already present.");
  }
}

function patchForestWorker() {
  const filePath = path.resolve("src/workers/forestWorker.ts");
  let source = fs.readFileSync(filePath, "utf8");
  const original = source;

  source = source
    .replace(
      /const baseCorridorWidth =\n\s*lerp\(config\.corridorBaseWidth, config\.corridorMinWidth, pressure \+ memoryNarrowing\) \* corridorBoost;/g,
      `const navigableCorridorPadding = 0.65 + pathClarity * 0.35;
  const baseCorridorWidth =
    lerp(config.corridorBaseWidth, config.corridorMinWidth, pressure + memoryNarrowing) * corridorBoost + navigableCorridorPadding;`,
    )
    .replace(/dxToPlayer \* dxToPlayer \+ dzToPlayer \* dzToPlayer < 3\.4/g, "dxToPlayer * dxToPlayer + dzToPlayer * dzToPlayer < 7.8")
    .replace(/const colliderRadius = 0\.24 \+ pressure \* 0\.12;/g, "const colliderRadius = 0.16 + pressure * 0.07;")
    .replace(
      /Math\.max\(0\.18, wallWidth \* 0\.8\),\n\s*wallHeight \* 0\.5,\n\s*Math\.max\(0\.28, wallDepth \* 0\.42\),/g,
      `Math.max(0.12, wallWidth * 0.52),
              Math.max(0.18, wallHeight * 0.44),
              Math.max(0.18, wallDepth * 0.28),`,
    );

  if (source !== original) {
    fs.writeFileSync(filePath, source);
    console.log("Upgraded generated object colliders: wider path clearance, smaller proxies, safer near-player pruning.");
  } else {
    console.log("Generated object collider upgrade already present.");
  }
}

patchStoryScene();
patchForestWorker();
