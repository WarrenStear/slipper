import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Slipper3DEntry, Vector3Tuple } from "../../../data/slipper3dTypes";
import { JOURNEY_CHAPTER_LAYOUTS } from "../../../data/journeyWorldLayout";
import {
  RESONANCE_KEYS,
  type JourneyActId,
  type JourneyChapterId,
  type JourneySceneId,
  type LandmarkState,
  type ResonanceKey,
} from "../../../lib/storyJourneyState";
import { TERRAIN_BASE_Y } from "../../../lib/worldLayout";
import { useSettingsStore } from "../../../stores/useSettingsStore";

export type WorldMemoryState = {
  chapterId?: JourneyChapterId;
  sceneId?: JourneySceneId;
  completedRitualIds: readonly string[];
  completedActs: readonly JourneyActId[];
  completedChapterIds?: readonly JourneyChapterId[];
  completedSceneIds?: readonly JourneySceneId[];
  landmarkStates: Readonly<Record<string, LandmarkState>>;
  worldFlags: Readonly<Record<string, boolean>>;
  resonances: Readonly<Record<ResonanceKey, number>>;
  inventory: {
    lantern: boolean;
    recoveredKeys: readonly string[];
    symbolicObjects: readonly string[];
  };
  releasedWords: readonly string[];
  storyStarted?: boolean;
  storyCompleted: boolean;
};

type MemoryLandmark = {
  chapterId: JourneyChapterId;
  anchorSceneId: JourneySceneId;
  position: Vector3Tuple;
  rotationY: number;
};

type ResonancePalette = {
  ember: string;
  mirror: string;
  bloom: string;
  archive: string;
  water: string;
  constellation: string;
  wolf: string;
  swan: string;
  seer: string;
  symbolKeys: readonly ResonanceKey[];
};

const MAX_RELEASED_WORDS = 5;
const AUTHORED_MEMORY_LANDMARKS: readonly MemoryLandmark[] = JOURNEY_CHAPTER_LAYOUTS.map(
  (chapter) => ({
    chapterId: chapter.id,
    anchorSceneId: chapter.anchorSceneId,
    position: [
      chapter.anchor.position[0],
      TERRAIN_BASE_Y + chapter.anchor.position[1] + 0.04,
      chapter.anchor.position[2],
    ],
    rotationY: chapter.anchor.headingRadians,
  }),
);

const NEST_MEMORY_RINGS = [0.72, 0.98, 1.24] as const;
const INTEGRATION_SYMBOL_OFFSETS = [-1.05, 0, 1.05] as const;
const FORK_MEMORY_STONES = [-1.9, -1.28, -0.66, 0, 0.66, 1.28, 1.9] as const;
const FORK_MEMORY_GROWTH = [-1.55, -0.58, 0.42, 1.38] as const;
const THREE_CLIMB_STEPS = [0, 1, 2] as const;

const COMPLETION_RITUALS = {
  firstWood: "ritual.accept-lantern",
  mirror: "ritual.witness-mirror",
  thorned: "ritual.recover-key",
  archive: "ritual.accept-memory",
  fire: "ritual.burn-boundary",
  wash: "ritual.wash-grief",
  river: "ritual.release-river-memory",
  surrender: "ritual.surrender",
  crown: "ritual.place-lantern",
} as const;

const RESONANCE_TINTS: Record<ResonanceKey, THREE.Color> = {
  wolf: new THREE.Color("#c98243"),
  swan: new THREE.Color("#d9e8ef"),
  seer: new THREE.Color("#8ea0ce"),
};

const BLACK_BIRD_CENTERS: readonly Vector3Tuple[] = [
  [-1.85, 2.55, -0.72],
  [-1.2, 3.15, -0.38],
  [-0.42, 2.72, -0.82],
  [0.28, 3.42, -0.46],
  [1.04, 2.92, -0.72],
  [1.72, 3.3, -0.34],
];

const CONSTELLATION_NODES: readonly Vector3Tuple[] = [
  [-1.52, 0.08, 0],
  [-0.92, 0.62, 0],
  [-0.18, 0.32, 0],
  [0.4, 0.92, 0],
  [1.12, 0.55, 0],
  [1.55, 1.18, 0],
];

const CONSTELLATION_EDGES = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 5],
] as const;

const CONSTELLATION_POINT_POSITIONS = new Float32Array(CONSTELLATION_NODES.flat());
const CONSTELLATION_LINE_POSITIONS = new Float32Array(
  CONSTELLATION_EDGES.flatMap(([source, target]) => [
    ...CONSTELLATION_NODES[source],
    ...CONSTELLATION_NODES[target],
  ]),
);

function clamp01(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function ritualDone(state: WorldMemoryState, ritualId: string) {
  return state.completedRitualIds.includes(ritualId);
}

function actDone(state: WorldMemoryState, actId: JourneyActId) {
  return state.completedActs.includes(actId);
}

function chapterDone(state: WorldMemoryState, chapterId: JourneyChapterId) {
  return state.completedChapterIds?.includes(chapterId) ?? false;
}

function sceneDone(state: WorldMemoryState, sceneId: JourneySceneId) {
  return state.completedSceneIds?.includes(sceneId) ?? false;
}

function flagDone(state: WorldMemoryState, flagId: string) {
  return state.worldFlags[flagId] === true;
}

function resolvedLandmarkState(
  state: WorldMemoryState,
  key: string,
  transformed: boolean,
): LandmarkState {
  return state.landmarkStates[key] ?? (transformed ? "transformed" : "untouched");
}

function resolveResonancePalette(state: WorldMemoryState): ResonancePalette {
  const strengths = {
    wolf: clamp01(state.resonances.wolf / 100),
    swan: clamp01(state.resonances.swan / 100),
    seer: clamp01(state.resonances.seer / 100),
  } satisfies Record<ResonanceKey, number>;

  const tint = (base: string, strength = 0.16) => {
    const color = new THREE.Color(base);
    for (const key of RESONANCE_KEYS) {
      color.lerp(RESONANCE_TINTS[key], strengths[key] * strength);
    }
    return `#${color.getHexString()}`;
  };

  return {
    ember: tint("#ffb05e", 0.2),
    mirror: tint("#aec8ce", 0.16),
    bloom: tint("#d8c5a4", 0.2),
    archive: tint("#e9e2d4", 0.17),
    water: tint("#68a8b5", 0.18),
    constellation: tint("#ffdc9e", 0.2),
    wolf: tint("#c98243", 0.1),
    swan: tint("#d9e8ef", 0.1),
    seer: tint("#91a4d3", 0.1),
    symbolKeys: RESONANCE_KEYS.filter((key) => strengths[key] > 0),
  };
}

function BrokenFloorMemory({ state, palette }: { state: WorldMemoryState; palette: ResonancePalette }) {
  const calm =
    state.storyCompleted ||
    chapterDone(state, "crowned-return") ||
    ritualDone(state, COMPLETION_RITUALS.crown);

  return (
    <group
      name="broken-floor-memory"
      userData={{
        landmarkId: "landmark.broken-floor-reflection",
        memoryStage: calm ? "calm-after-crowned-return" : "broken-water",
      }}
    >
      <mesh position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.42, 32]} />
        <meshStandardMaterial
          color={calm ? palette.water : "#1c2930"}
          emissive={calm ? "#315766" : "#090d10"}
          emissiveIntensity={calm ? 0.12 : 0.025}
          metalness={0.42}
          roughness={calm ? 0.08 : 0.38}
          transparent
          opacity={calm ? 0.82 : 0.62}
        />
      </mesh>
      <mesh position={[-0.42, 0.08, 0.12]} rotation={[-Math.PI / 2, 0, -0.68]} visible={!calm}>
        <planeGeometry args={[0.035, 1.65]} />
        <meshBasicMaterial color="#090b0d" transparent opacity={0.84} />
      </mesh>
      <mesh position={[0.38, 0.085, -0.22]} rotation={[-Math.PI / 2, 0, 0.82]} visible={!calm}>
        <planeGeometry args={[0.028, 1.2]} />
        <meshBasicMaterial color="#090b0d" transparent opacity={0.72} />
      </mesh>
      {calm ? (
        <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.52, 0.56, 28]} />
          <meshBasicMaterial color={palette.constellation} transparent opacity={0.4} toneMapped={false} />
        </mesh>
      ) : null}
    </group>
  );
}

function NestMemory({ state, palette }: { state: WorldMemoryState; palette: ResonancePalette }) {
  const held = flagDone(state, "nest.hand-held") && flagDone(state, "nest.hand-kept");
  const released = flagDone(state, "nest.unsupported-burden-released");
  const protectedSpace =
    flagDone(state, "nest.protection-acknowledged") ||
    chapterDone(state, "nest");
  const open = released || protectedSpace;

  return (
    <group
      name="nest-memory"
      userData={{
        landmarkId: "landmark.nest",
        memoryStage: open ? "warm-open-space" : held ? "held-together" : "warm-enclosed",
      }}
    >
      {NEST_MEMORY_RINGS.map((radius, index) => (
        <mesh key={radius} position={[0, 0.08 + index * 0.025, 0]} rotation={[-Math.PI / 2, 0, index * 0.46]}>
          <torusGeometry args={[radius, 0.075, 6, 22, open ? Math.PI * 1.54 : Math.PI * 1.92]} />
          <meshStandardMaterial
            color={index === 1 ? palette.bloom : "#71533d"}
            emissive={open ? "#5a3f29" : "#241b16"}
            emissiveIntensity={open ? 0.12 : 0.035}
            roughness={0.96}
          />
        </mesh>
      ))}
      <mesh position={[0, 0.04, open ? 1.62 : 1.24]} rotation={[-Math.PI / 2, 0, 0]} visible={open}>
        <planeGeometry args={[0.72, 1.75]} />
        <meshBasicMaterial color={palette.ember} transparent opacity={0.12} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.34, 0]} scale={held ? 1.08 : 0.84}>
        <sphereGeometry args={[0.22, 10, 7]} />
        <meshStandardMaterial color="#d9b67c" emissive={palette.ember} emissiveIntensity={held ? 0.25 : 0.08} roughness={0.75} />
      </mesh>
    </group>
  );
}

function IntegrationMemory({ state, palette }: { state: WorldMemoryState; palette: ResonancePalette }) {
  const integrated =
    flagDone(state, "integration.three-aspects-held") ||
    chapterDone(state, "wolf-swan-seer") ||
    sceneDone(state, "wolf-swan.convergence");

  return (
    <group
      name="wolf-swan-seer-memory"
      userData={{
        landmarkId: "landmark.wolf-swan-seer",
        memoryStage: integrated ? "three-symbols-integrated" : "three-paths-divided",
      }}
    >
      {INTEGRATION_SYMBOL_OFFSETS.map((x, index) => (
        <group key={x} position={[x, 0.7, index === 1 ? -0.18 : 0]}>
          {index === 0 ? (
            <mesh rotation={[0, 0, -0.12]}>
              <coneGeometry args={[0.32, 0.88, 4]} />
              <meshStandardMaterial color={integrated ? palette.wolf : "#40372f"} emissive="#59341f" emissiveIntensity={integrated ? 0.16 : 0.02} roughness={0.9} />
            </mesh>
          ) : index === 1 ? (
            <mesh rotation={[0, 0, Math.PI]}>
              <torusGeometry args={[0.34, 0.055, 7, 22, Math.PI * 1.42]} />
              <meshStandardMaterial color={integrated ? palette.swan : "#555b5c"} emissive="#647784" emissiveIntensity={integrated ? 0.15 : 0.02} roughness={0.55} />
            </mesh>
          ) : (
            <group>
              <mesh>
                <ringGeometry args={[0.22, 0.29, 18]} />
                <meshStandardMaterial color={integrated ? palette.seer : "#454656"} emissive="#4d5885" emissiveIntensity={integrated ? 0.18 : 0.02} side={THREE.DoubleSide} roughness={0.5} />
              </mesh>
              <mesh position={[0, 0, 0.012]}>
                <circleGeometry args={[0.055, 12]} />
                <meshBasicMaterial color={integrated ? palette.constellation : "#363641"} toneMapped={false} />
              </mesh>
            </group>
          )}
        </group>
      ))}
      <mesh position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.45, 1.52, 32, 1, 0, integrated ? Math.PI * 2 : Math.PI * 1.48]} />
        <meshStandardMaterial color={integrated ? palette.constellation : "#4d463d"} emissive={integrated ? "#715b37" : "#000000"} emissiveIntensity={integrated ? 0.1 : 0} roughness={0.72} />
      </mesh>
    </group>
  );
}

function ForkMemory({ state, palette }: { state: WorldMemoryState; palette: ResonancePalette }) {
  const pastOvergrown =
    flagDone(state, "fork.departed") ||
    flagDone(state, "fork.deleted") ||
    flagDone(state, "fork.old-hope-relinquished") ||
    flagDone(state, "lantern.owned");
  const futureEstablished =
    flagDone(state, "fork.deleted") ||
    flagDone(state, "fork.old-hope-relinquished") ||
    flagDone(state, "lantern.owned") ||
    chapterDone(state, "fork");
  const lanternOwned = flagDone(state, "lantern.owned");

  return (
    <group
      name="fork-memory"
      userData={{
        landmarkId: "landmark.fork",
        pastPathStage: pastOvergrown ? "partially-overgrown" : "open",
        futurePathStage: futureEstablished ? "established" : "uncertain",
        lanternStage: lanternOwned ? "owned" : "guided",
      }}
    >
      <group position={[-0.72, 0, 0]} rotation={[0, -0.22, 0]}>
        {FORK_MEMORY_STONES.map((z, index) => (
          <mesh key={z} position={[Math.sin(index * 0.7) * 0.16, 0.06, z]} rotation={[-Math.PI / 2, 0, index * 0.42]}>
            <circleGeometry args={[0.22, 7]} />
            <meshStandardMaterial color={pastOvergrown ? "#42483b" : "#71604b"} roughness={0.98} />
          </mesh>
        ))}
      </group>
      <group position={[0.72, 0, 0]} rotation={[0, 0.22, 0]}>
        {FORK_MEMORY_STONES.map((z, index) => (
          <mesh key={z} position={[Math.sin(index * 0.8) * -0.14, 0.065, z]} rotation={[-Math.PI / 2, 0, index * -0.38]}>
            <circleGeometry args={[0.22, 7]} />
            <meshStandardMaterial
              color={futureEstablished ? "#92958a" : "#444b48"}
              emissive={futureEstablished ? palette.seer : "#000000"}
              emissiveIntensity={futureEstablished ? 0.08 : 0}
              roughness={0.86}
            />
          </mesh>
        ))}
      </group>
      {pastOvergrown ? (
        <group name="fork-memory-past-overgrowth" position={[-0.74, 0, 0]}>
          {FORK_MEMORY_GROWTH.map((z, index) => (
            <mesh key={z} position={[index % 2 === 0 ? -0.18 : 0.2, 0.23, z]} rotation={[0, index * 0.86, index % 2 ? 0.24 : -0.24]}>
              <coneGeometry args={[0.11, 0.5, 5]} />
              <meshStandardMaterial color="#506045" roughness={0.98} />
            </mesh>
          ))}
        </group>
      ) : null}
      {lanternOwned ? (
        <group name="fork-memory-owned-lantern" position={[0, 0.62, 0]}>
          <mesh>
            <cylinderGeometry args={[0.1, 0.14, 0.48, 7]} />
            <meshStandardMaterial color="#34251a" emissive="#8c5f2d" emissiveIntensity={0.16} metalness={0.34} roughness={0.5} />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.075, 9, 6]} />
            <meshBasicMaterial color={palette.ember} toneMapped={false} />
          </mesh>
        </group>
      ) : null}
    </group>
  );
}

function ThreeClimbsMemory({ state, palette }: { state: WorldMemoryState; palette: ResonancePalette }) {
  const completedSteps =
    (sceneDone(state, "climb.mind") ? 1 : 0) +
    (sceneDone(state, "climb.heart") ? 1 : 0) +
    (sceneDone(state, "climb.womb") ? 1 : 0);

  return (
    <group
      name="three-climbs-memory"
      userData={{ landmarkId: "landmark.three-climbs", completedSteps }}
    >
      {THREE_CLIMB_STEPS.map((step) => {
        const completed = step < completedSteps;
        return (
          <mesh key={step} position={[0, 0.16 + step * 0.3, -0.52 + step * 0.52]}>
            <boxGeometry args={[1.75 - step * 0.3, 0.28, 0.72]} />
            <meshStandardMaterial
              color={completed ? palette.bloom : "#4e4a42"}
              emissive={completed ? palette.seer : "#000000"}
              emissiveIntensity={completed ? 0.07 : 0}
              roughness={0.94}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function FirstWoodMemory({ state, palette }: { state: WorldMemoryState; palette: ResonancePalette }) {
  const accepted = state.inventory.lantern || ritualDone(state, COMPLETION_RITUALS.firstWood);
  const landmarkState = resolvedLandmarkState(
    state,
    "landmark.first-wood-lantern",
    actDone(state, "first-wood"),
  );
  const transformed = landmarkState === "transformed";
  return (
    <group
      userData={{
        landmarkId: "landmark.first-wood-lantern",
        state: landmarkState,
        memoryStage: transformed
          ? "path-transformed"
          : accepted
            ? "lantern-carried"
            : "lantern-waiting",
      }}
    >
      <mesh position={[0, 0.18, 0]} receiveShadow>
        <cylinderGeometry args={[0.54, 0.72, 0.36, 9]} />
        <meshStandardMaterial color="#4c473d" roughness={0.96} />
      </mesh>
      {!accepted ? (
        <>
          <mesh position={[0, 0.78, 0]}>
            <cylinderGeometry args={[0.18, 0.23, 0.72, 8]} />
            <meshStandardMaterial color="#221a13" emissive="#6f431e" emissiveIntensity={0.18} metalness={0.38} roughness={0.42} />
          </mesh>
          <mesh position={[0, 0.78, 0]}>
            <sphereGeometry args={[0.11, 12, 8]} />
            <meshBasicMaterial color={palette.ember} toneMapped={false} />
          </mesh>
        </>
      ) : (
        <>
          <mesh position={[0, 0.39, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.25, transformed ? 0.42 : 0.3, 24]} />
            <meshStandardMaterial
              color="#a88754"
              emissive={palette.ember}
              emissiveIntensity={transformed ? 0.18 : 0.06}
              roughness={0.78}
            />
          </mesh>
          {transformed ? (
            <mesh name="first-wood-transformed-path" position={[0, 0.055, -0.72]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.72, 1.6]} />
              <meshBasicMaterial color={palette.ember} transparent opacity={0.08} depthWrite={false} />
            </mesh>
          ) : null}
        </>
      )}
    </group>
  );
}

const MIRROR_CRACKS = [
  [-0.24, 1.98, -0.38, 0.92],
  [0.12, 1.5, 0.54, 0.92],
  [0.42, 1.02, -0.46, 0.92],
  [-0.53, 0.8, 0.78, 0.58],
] as const;

const MIRROR_DISTORTION_SLICES = [
  [-0.72, 1.33, 0.12, -0.11],
  [0, 1.43, -0.06, 0.09],
  [0.72, 1.27, 0.16, -0.08],
] as const;

function MirrorMemory({ state, palette }: { state: WorldMemoryState; palette: ResonancePalette }) {
  const witnessed =
    ritualDone(state, COMPLETION_RITUALS.mirror) ||
    flagDone(state, "mirror.reflections-truthful");
  const transformed = witnessed;
  const mirrorStage = witnessed ? "readable-cracked" : "distorted";
  const landmarkState = resolvedLandmarkState(state, "landmark.mirror", transformed);

  return (
    <group userData={{ landmarkId: "landmark.mirror", state: landmarkState, memoryStage: mirrorStage }}>
      <mesh position={[0, 1.35, -0.08]} castShadow>
        <boxGeometry args={[2.42, 2.98, 0.12]} />
        <meshStandardMaterial color="#342f2b" roughness={0.9} metalness={0.12} />
      </mesh>
      {witnessed ? (
        <>
          <mesh position={[0, 1.35, 0]} rotation={[0.02, 0.03, -0.012]} castShadow>
            <boxGeometry args={[2.14, 2.7, 0.08]} />
            <meshStandardMaterial
              color={palette.mirror}
              emissive="#375b68"
              emissiveIntensity={0.12}
              metalness={0.58}
              roughness={0.12}
            />
          </mesh>
          {MIRROR_CRACKS.map(([x, y, rotation, height], index) => (
            <mesh key={index} position={[x, y, 0.07]} rotation={[0, 0, rotation]}>
              <boxGeometry args={[0.025, height, 0.012]} />
              <meshBasicMaterial color="#293a3f" transparent opacity={0.8} />
            </mesh>
          ))}
          {[-0.54, -0.18, 0.18, 0.54].map((x, index) => (
            <mesh key={x} position={[x, 0.38 + (index % 2) * 0.09, 0.08]} rotation={[0, 0, index % 2 ? 0.34 : -0.34]}>
              <ringGeometry args={[0.055, 0.075, 6]} />
              <meshBasicMaterial color={palette.constellation} transparent opacity={0.62} toneMapped={false} />
            </mesh>
          ))}
        </>
      ) : (
        <>
          {MIRROR_DISTORTION_SLICES.map(([x, y, z, rotation], index) => (
            <mesh key={x} position={[x, y, z]} rotation={[0.02, rotation, index % 2 ? 0.035 : -0.045]} castShadow>
              <boxGeometry args={[0.65, 2.56, 0.09]} />
              <meshStandardMaterial
                color={index % 2 ? "#52676b" : "#3d4e52"}
                emissive="#11191b"
                emissiveIntensity={0.04}
                metalness={0.28}
                roughness={0.46}
              />
            </mesh>
          ))}
        </>
      )}
      <mesh position={[0, 0.025, 0.55]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[1.75, 36]} />
        <meshStandardMaterial
          color={witnessed ? palette.water : "#202b2e"}
          metalness={0.42}
          roughness={witnessed ? 0.14 : 0.34}
          transparent
          opacity={0.7}
        />
      </mesh>
    </group>
  );
}

function ThornedHouseMemory({ state, palette }: { state: WorldMemoryState; palette: ResonancePalette }) {
  const doorOpen =
    flagDone(state, "thorn-door.open") ||
    state.inventory.recoveredKeys.includes("key.self-permission") ||
    ritualDone(state, COMPLETION_RITUALS.thorned);
  const flowersBloomed =
    ritualDone(state, COMPLETION_RITUALS.archive) ||
    actDone(state, "blue-moon-archive") ||
    actDone(state, "fire-and-river") ||
    actDone(state, "crowned-return");
  const landmarkState = resolvedLandmarkState(state, "landmark.thorn-door", doorOpen);
  const memoryStage = flowersBloomed ? "open-flowering" : doorOpen ? "open-bare" : "closed-thorned";

  return (
    <group userData={{ landmarkId: "landmark.thorn-door", state: landmarkState, memoryStage }}>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 1.12, 1.45, 0]} castShadow>
          <boxGeometry args={[0.34, 2.9, 0.46]} />
          <meshStandardMaterial color="#46382f" roughness={0.95} />
        </mesh>
      ))}
      <mesh position={[0, 2.82, 0]} castShadow>
        <boxGeometry args={[2.58, 0.36, 0.48]} />
        <meshStandardMaterial color="#47372e" roughness={0.95} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[doorOpen ? side * 0.94 : side * 0.43, 1.34, doorOpen ? 0.42 : 0.04]}
          rotation={[0, doorOpen ? side * -1.08 : 0, 0]}
          castShadow
        >
          <boxGeometry args={[0.86, 2.46, 0.18]} />
          <meshStandardMaterial color="#2c211c" roughness={0.9} />
        </mesh>
      ))}
      {!doorOpen ? [-0.78, -0.3, 0.18, 0.68].map((x, index) => (
        <mesh key={x} position={[x, 1.34, 0.3]} rotation={[0, 0, index % 2 ? 0.52 : -0.48]}>
          <cylinderGeometry args={[0.022, 0.045, 2.65, 5]} />
          <meshStandardMaterial color="#4b5735" roughness={0.96} />
        </mesh>
      )) : null}
      {flowersBloomed ? [-1.18, -0.62, -0.04, 0.54, 1.12].map((x, index) => (
        <group key={x} position={[x, 0, 0.38 + (index % 2) * 0.12]}>
          <mesh position={[0, 0.14, 0]}>
            <cylinderGeometry args={[0.012, 0.018, 0.28, 5]} />
            <meshStandardMaterial color="#677a50" roughness={0.92} />
          </mesh>
          <mesh position={[0, 0.3, 0]} scale={[1, 0.7, 1]}>
            <sphereGeometry args={[0.085 + (index % 2) * 0.018, 7, 5]} />
            <meshStandardMaterial color={palette.bloom} emissive="#66533b" emissiveIntensity={0.08} roughness={0.86} />
          </mesh>
        </group>
      )) : null}
    </group>
  );
}

function ArchiveMemory({ state, palette }: { state: WorldMemoryState; palette: ResonancePalette }) {
  const candlesLit = flagDone(state, "blue-moon.candles-lit");
  const waterTouched = flagDone(state, "blue-moon.water-touched");
  const swanFollowed = flagDone(state, "blue-moon.swan-followed");
  const flowersPlaced = flagDone(state, "blue-moon.flowers-placed");
  const beautifulDoorOpen = flagDone(state, "blue-moon.beautiful-door-open");
  const carried =
    flagDone(state, "archive.memory-carried") ||
    state.inventory.symbolicObjects.includes("memory.blue-moon") ||
    ritualDone(state, COMPLETION_RITUALS.archive) ||
    beautifulDoorOpen;
  const resolved = beautifulDoorOpen || (
    carried && (
      flagDone(state, "archive.nostalgia-loops-closed") ||
      chapterDone(state, "blue-moon-sanctuary") ||
      actDone(state, "blue-moon-archive")
    )
  );
  const memoryStage = resolved
    ? "beautiful-no-longer-loops"
    : carried
      ? "carried-memory"
      : "beautiful-contradiction";
  const landmarkState = resolvedLandmarkState(state, "landmark.blue-moon-archive", resolved);

  return (
    <group
      userData={{
        landmarkId: "landmark.blue-moon-archive",
        state: landmarkState,
        memoryStage,
        candlesStage: candlesLit ? "lit" : "waiting",
        waterStage: waterTouched ? "touched" : "still",
        swanStage: swanFollowed ? "followed" : "waiting",
        flowersStage: flowersPlaced ? "placed" : "unplaced",
        doorStage: beautifulDoorOpen ? "open" : "closed",
      }}
    >
      <mesh position={[0, 3.65, -0.8]}>
        <circleGeometry args={[1.08, 48]} />
        <meshBasicMaterial color={palette.swan} transparent opacity={carried ? 0.72 : 0.52} toneMapped={false} />
      </mesh>
      {resolved ? (
        <mesh name="blue-moon-memory-open-path" position={[0, 0.035, 1.2]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.64, 2.5]} />
          <meshBasicMaterial color={palette.swan} transparent opacity={0.16} depthWrite={false} toneMapped={false} />
        </mesh>
      ) : (
        <mesh name="blue-moon-memory-looping-path" position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.24, 1.34, 32, 1, 0.18, Math.PI * 1.72]} />
          <meshStandardMaterial color="#718798" emissive="#2e4758" emissiveIntensity={0.08} roughness={0.3} />
        </mesh>
      )}
      {!carried ? (
        <>
          <mesh position={[-0.22, 1.85, 0]} scale={[0.82, 1.08, 0.45]}>
            <sphereGeometry args={[0.54, 16, 10]} />
            <meshStandardMaterial color="#7896b8" emissive="#3c5274" emissiveIntensity={0.12} roughness={0.38} />
          </mesh>
          <mesh position={[0.22, 1.85, 0.05]} scale={[0.82, 1.08, 0.45]}>
            <sphereGeometry args={[0.54, 16, 10]} />
            <meshStandardMaterial color="#b78066" emissive="#684238" emissiveIntensity={0.1} roughness={0.4} />
          </mesh>
          {[-1.42, -0.72, 0.72, 1.42].map((x, index) => (
            <mesh key={x} position={[x, 1.08 + (index % 2) * 0.52, index < 2 ? 0.34 : -0.34]} rotation={[0, index < 2 ? -0.48 : 0.48, index < 2 ? 0.72 : -0.72]}>
              <coneGeometry args={[0.32, 0.9, 3]} />
              <meshStandardMaterial color={index < 2 ? "#d9e4ed" : "#ead4c7"} side={THREE.DoubleSide} roughness={0.72} />
            </mesh>
          ))}
        </>
      ) : (
        <>
          <mesh position={[0, 1.84, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.62, 0.035, 8, 32]} />
            <meshStandardMaterial color={palette.archive} emissive={palette.seer} emissiveIntensity={0.18} roughness={0.4} />
          </mesh>
          <mesh position={[0, 1.84, 0]}>
            <octahedronGeometry args={[0.42, 1]} />
            <meshStandardMaterial color={palette.archive} emissive={palette.swan} emissiveIntensity={0.16} metalness={0.16} roughness={0.36} />
          </mesh>
          {[-1.45, -0.72, 0, 0.72, 1.45].map((x, index) => (
            <group key={x} position={[x, 1.02 + Math.abs(index - 2) * 0.16, 0]} rotation={[0, 0, (index - 2) * 0.12]}>
              <mesh rotation={[0, 0, 0.58]}>
                <coneGeometry args={[0.26, 0.72, 3]} />
                <meshStandardMaterial color={palette.archive} emissive="#657894" emissiveIntensity={0.09} side={THREE.DoubleSide} roughness={0.72} />
              </mesh>
              <mesh rotation={[0, 0, -0.58]}>
                <coneGeometry args={[0.26, 0.72, 3]} />
                <meshStandardMaterial color={palette.archive} emissive="#657894" emissiveIntensity={0.09} side={THREE.DoubleSide} roughness={0.72} />
              </mesh>
            </group>
          ))}
        </>
      )}
    </group>
  );
}

function createBlackBirdFlockGeometry() {
  const positions: number[] = [];
  for (const [x, y, z] of BLACK_BIRD_CENTERS) {
    positions.push(
      x, y, z,
      x - 0.3, y + 0.15, z,
      x - 0.04, y - 0.02, z + 0.015,
      x, y, z,
      x + 0.3, y + 0.15, z,
      x + 0.04, y - 0.02, z + 0.015,
    );
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

function BlackBirdFlock() {
  const geometry = useMemo(() => createBlackBirdFlockGeometry(), []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} renderOrder={3}>
      <meshBasicMaterial color="#0a0b0d" side={THREE.DoubleSide} />
    </mesh>
  );
}

function createReleasedWordTexture(word: string, color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  if (!context) return new THREE.CanvasTexture(canvas);

  const fontSize = Math.max(11, Math.min(24, 220 / Math.max(1, word.length * 0.58)));
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `600 ${fontSize}px Georgia, serif`;
  context.shadowColor = "rgba(224, 238, 245, 0.44)";
  context.shadowBlur = 8;
  context.fillStyle = color;
  context.fillText(word, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function ReleasedWord({
  word,
  index,
  reducedMotion,
  color,
}: {
  word: string;
  index: number;
  reducedMotion: boolean;
  color: string;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const texture = useMemo(() => createReleasedWordTexture(word, color), [color, word]);
  const x = [-0.82, -0.34, 0.18, 0.66, 0.02][index % MAX_RELEASED_WORDS];
  const z = 0.62 + (index % 2) * 0.12;

  useEffect(() => () => texture.dispose(), [texture]);

  useFrame(({ camera, clock }) => {
    const group = groupRef.current;
    if (!group) return;
    group.quaternion.copy(camera.quaternion);
    if (reducedMotion) {
      group.position.y = 0.86 + index * 0.34;
      if (materialRef.current) materialRef.current.opacity = 0.74;
      return;
    }
    const phase = (clock.elapsedTime * 0.075 + index * 0.19) % 1;
    group.position.y = 0.72 + phase * 2.35;
    group.position.x = x + Math.sin(clock.elapsedTime * 0.34 + index * 1.7) * 0.08;
    if (materialRef.current) {
      materialRef.current.opacity = Math.sin(phase * Math.PI) * 0.72;
    }
  });

  return (
    <group ref={groupRef} position={[x, 0.86 + index * 0.34, z]} userData={{ releasedWord: word }}>
      <mesh>
        <planeGeometry args={[1.44, 0.36]} />
        <meshBasicMaterial
          ref={materialRef}
          map={texture}
          color="#ffffff"
          transparent
          opacity={0.74}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function ReleasedWords({
  words,
  reducedMotion,
  color,
}: {
  words: readonly string[];
  reducedMotion: boolean;
  color: string;
}) {
  const visibleWords = words.slice(-MAX_RELEASED_WORDS);
  return (
    <group name="released-words" userData={{ count: visibleWords.length }}>
      {visibleWords.map((word, index) => (
        <ReleasedWord key={`${word}:${index}`} word={word} index={index} reducedMotion={reducedMotion} color={color} />
      ))}
    </group>
  );
}

function WhiteSurrenderFlag() {
  return (
    <group position={[0.08, 0, -0.46]} name="white-surrender-flag">
      <mesh position={[0, 1.02, 0]}>
        <cylinderGeometry args={[0.018, 0.026, 2.04, 6]} />
        <meshStandardMaterial color="#776d5e" roughness={0.86} />
      </mesh>
      <mesh position={[0.38, 1.68, 0]}>
        <planeGeometry args={[0.72, 0.42]} />
        <meshStandardMaterial color="#eee9dc" emissive="#c8d6db" emissiveIntensity={0.08} roughness={0.88} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function FireRiverMemory({
  state,
  palette,
  reducedMotion,
}: {
  state: WorldMemoryState;
  palette: ResonancePalette;
  reducedMotion: boolean;
}) {
  const burned = flagDone(state, "fire.boundary-burned") || ritualDone(state, COMPLETION_RITUALS.fire);
  const washed = flagDone(state, "river.grief-washed") || ritualDone(state, COMPLETION_RITUALS.wash);
  const departed = flagDone(state, "birds.black-swarm-released") || ritualDone(state, COMPLETION_RITUALS.river);
  const released = flagDone(state, "river.memory-released") || ritualDone(state, COMPLETION_RITUALS.river);
  const surrendered = flagDone(state, "surrender.white-flag-raised") || ritualDone(state, COMPLETION_RITUALS.surrender);
  const shootsGrowing = released || surrendered || actDone(state, "fire-and-river");
  const landmarkState = resolvedLandmarkState(state, "landmark.fire-river", released);

  return (
    <group
      userData={{
        landmarkId: "landmark.fire-river",
        state: landmarkState,
        fireStage: shootsGrowing ? "ash-and-shoots" : burned ? "ash" : "flame",
        waterStage: washed ? "clear" : "dark",
        birdsStage: departed ? "departed" : "present",
        surrenderStage: surrendered ? "white-flag" : "held",
      }}
    >
      <group position={[-1.28, 0, 0]}>
        {burned ? (
          <>
            <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[1.12, 28]} />
              <meshStandardMaterial color="#3b3530" roughness={0.98} />
            </mesh>
            {shootsGrowing ? [0, 1, 2].map((index) => (
              <mesh key={index} position={[-0.38 + index * 0.4, 0.18 + index * 0.05, 0]}>
                <coneGeometry args={[0.065, 0.42 + index * 0.08, 5]} />
                <meshStandardMaterial color="#6f8b54" emissive="#384f2e" emissiveIntensity={0.06} roughness={0.9} />
              </mesh>
            )) : null}
          </>
        ) : (
          <>
            <mesh position={[0, 0.54, 0]} rotation={[0, 0, -0.08]}>
              <coneGeometry args={[0.72, 1.72, 9]} />
              <meshStandardMaterial color="#e35e29" emissive="#ff431d" emissiveIntensity={0.82} roughness={0.5} />
            </mesh>
            <mesh position={[0.12, 0.72, 0.08]} rotation={[0, 0, 0.16]}>
              <coneGeometry args={[0.38, 1.18, 8]} />
              <meshBasicMaterial color={palette.ember} transparent opacity={0.82} toneMapped={false} />
            </mesh>
          </>
        )}
      </group>
      <mesh position={[1.18, 0.035, 0]} rotation={[-Math.PI / 2, 0, -0.18]}>
        <planeGeometry args={[2.3, 1.28, 1, 1]} />
        <meshStandardMaterial
          color={washed ? palette.water : "#25323a"}
          emissive={washed ? "#285e69" : "#0c1217"}
          emissiveIntensity={washed ? 0.14 : 0.025}
          metalness={0.3}
          roughness={washed ? 0.16 : 0.4}
          transparent
          opacity={washed ? 0.78 : 0.68}
        />
      </mesh>
      {!departed ? <BlackBirdFlock /> : null}
      {released && state.releasedWords.length > 0 ? (
        <ReleasedWords words={state.releasedWords} reducedMotion={reducedMotion} color={palette.archive} />
      ) : null}
      {surrendered ? <WhiteSurrenderFlag /> : null}
    </group>
  );
}

function SparseFinalRoomSymbols({ palette }: { palette: ResonancePalette }) {
  const showWolf = palette.symbolKeys.includes("wolf");
  const showSwan = palette.symbolKeys.includes("swan");
  const showSeer = palette.symbolKeys.includes("seer");

  return (
    <group name="sparse-final-room-symbols" position={[0, 0, -0.88]}>
      {showWolf ? (
        <group position={[-1.04, 0.78, 0]} rotation={[0, 0, -0.18]} userData={{ resonanceSymbol: "wolf" }}>
          {[-0.13, 0, 0.13].map((x, index) => (
            <mesh key={x} position={[x, index === 1 ? 0.06 : 0, 0]} rotation={[0, 0, x * -1.8]}>
              <coneGeometry args={[0.045, 0.36, 4]} />
              <meshStandardMaterial color={palette.wolf} emissive="#6b3f24" emissiveIntensity={0.12} roughness={0.68} />
            </mesh>
          ))}
        </group>
      ) : null}
      {showSwan ? (
        <group position={[0, 0.7, 0]} userData={{ resonanceSymbol: "swan" }}>
          <mesh rotation={[0, 0, 0.42]}>
            <torusGeometry args={[0.22, 0.026, 6, 18, Math.PI]} />
            <meshStandardMaterial color={palette.swan} emissive="#6e8495" emissiveIntensity={0.12} roughness={0.52} />
          </mesh>
          <mesh rotation={[0, Math.PI, -0.42]}>
            <torusGeometry args={[0.22, 0.026, 6, 18, Math.PI]} />
            <meshStandardMaterial color={palette.swan} emissive="#6e8495" emissiveIntensity={0.12} roughness={0.52} />
          </mesh>
        </group>
      ) : null}
      {showSeer ? (
        <group position={[1.04, 0.78, 0]} userData={{ resonanceSymbol: "seer" }}>
          <mesh>
            <ringGeometry args={[0.16, 0.205, 18]} />
            <meshStandardMaterial color={palette.seer} emissive="#4d5885" emissiveIntensity={0.16} side={THREE.DoubleSide} roughness={0.48} />
          </mesh>
          <mesh position={[0, 0, 0.015]}>
            <circleGeometry args={[0.045, 12]} />
            <meshBasicMaterial color={palette.constellation} toneMapped={false} />
          </mesh>
        </group>
      ) : null}
    </group>
  );
}

function CompletedConstellation({ color }: { color: string }) {
  return (
    <group name="completed-in-world-constellation" position={[0, 4.18, -0.72]}>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[CONSTELLATION_LINE_POSITIONS, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={color} transparent opacity={0.52} toneMapped={false} />
      </lineSegments>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[CONSTELLATION_POINT_POSITIONS, 3]} />
        </bufferGeometry>
        <pointsMaterial color={color} size={0.14} sizeAttenuation transparent opacity={0.92} toneMapped={false} />
      </points>
    </group>
  );
}

function EpilogueMemory({ state, palette }: { state: WorldMemoryState; palette: ResonancePalette }) {
  const completed = state.storyCompleted || chapterDone(state, "lantern-epilogue");

  return (
    <group
      name="lantern-epilogue-memory"
      userData={{
        landmarkId: "landmark.lantern-epilogue",
        memoryStage: completed ? "constellation-complete" : "constellation-waiting",
      }}
    >
      <mesh position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.38, 0.5, 0.36, 8]} />
        <meshStandardMaterial color="#6e6658" roughness={0.92} />
      </mesh>
      <mesh position={[0, 0.72, 0]}>
        <sphereGeometry args={[0.1, 10, 7]} />
        <meshBasicMaterial color={palette.constellation} transparent opacity={completed ? 0.95 : 0.38} toneMapped={false} />
      </mesh>
      {completed ? <CompletedConstellation color={palette.constellation} /> : null}
    </group>
  );
}

function CrownedMemory({ state, palette }: { state: WorldMemoryState; palette: ResonancePalette }) {
  const keyRecognised = state.inventory.recoveredKeys.includes("key.self-permission");
  const placed =
    flagDone(state, "lantern.placed-and-lit") ||
    state.storyCompleted ||
    ritualDone(state, COMPLETION_RITUALS.crown);
  const completed = state.storyCompleted || actDone(state, "crowned-return");

  return (
    <group
      userData={{
        landmarkId: "landmark.crowned-gate",
        state: placed ? "released" : keyRecognised ? "awakened" : "untouched",
        gateStage: keyRecognised ? "key-recognised" : "awaiting-key",
        lanternStage: placed ? "placed-and-lit" : "carried",
        constellationStage: completed ? "complete" : "unformed",
      }}
    >
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 1.48, 1.62, 0]} castShadow>
          <boxGeometry args={[0.48, 3.24, 0.64]} />
          <meshStandardMaterial color="#8b7e66" emissive="#594a30" emissiveIntensity={0.05} roughness={0.88} />
        </mesh>
      ))}
      <mesh position={[0, 3.06, 0]} castShadow>
        <boxGeometry args={[3.35, 0.45, 0.68]} />
        <meshStandardMaterial color="#938469" emissive="#5b4a2e" emissiveIntensity={0.05} roughness={0.86} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[keyRecognised ? side * 1.18 : side * 0.5, 1.52, keyRecognised ? 0.42 : 0.02]}
          rotation={[0, keyRecognised ? side * -1.08 : 0, 0]}
        >
          <boxGeometry args={[0.98, 2.62, 0.12]} />
          <meshStandardMaterial color="#514a3f" emissive={keyRecognised ? palette.wolf : "#25231f"} emissiveIntensity={keyRecognised ? 0.07 : 0.015} roughness={0.82} />
        </mesh>
      ))}
      <group position={[0, 1.42, 0.12]} visible={!keyRecognised} name="self-permission-keyhole">
        <mesh>
          <ringGeometry args={[0.09, 0.15, 12]} />
          <meshStandardMaterial color="#141312" emissive="#080706" emissiveIntensity={0.02} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, -0.16, 0]}>
          <boxGeometry args={[0.075, 0.24, 0.04]} />
          <meshStandardMaterial color="#141312" roughness={0.74} />
        </mesh>
      </group>
      {keyRecognised ? <SparseFinalRoomSymbols palette={palette} /> : null}
      <mesh position={[0, 0.22, -0.55]}>
        <cylinderGeometry args={[0.42, 0.58, 0.44, 8]} />
        <meshStandardMaterial color="#6e6658" roughness={0.92} />
      </mesh>
      {placed ? (
        <>
          <mesh position={[0, 0.82, -0.55]}>
            <cylinderGeometry args={[0.14, 0.19, 0.72, 8]} />
            <meshStandardMaterial color="#241b14" emissive="#8b5a2e" emissiveIntensity={0.12} metalness={0.4} roughness={0.42} />
          </mesh>
          <mesh position={[0, 0.82, -0.55]}>
            <sphereGeometry args={[0.11, 12, 8]} />
            <meshBasicMaterial color={palette.constellation} toneMapped={false} />
          </mesh>
          <pointLight position={[0, 0.92, -0.48]} color={palette.ember} intensity={0.38} distance={4.2} decay={2} castShadow={false} />
        </>
      ) : null}
      {completed ? <CompletedConstellation color={palette.constellation} /> : null}
    </group>
  );
}

function NarrativeChapterMemory({
  chapterId,
  state,
  palette,
  reducedMotion,
}: {
  chapterId: JourneyChapterId;
  state: WorldMemoryState;
  palette: ResonancePalette;
  reducedMotion: boolean;
}) {
  if (chapterId === "broken-floor") return <BrokenFloorMemory state={state} palette={palette} />;
  if (chapterId === "enchanted-wood") return <FirstWoodMemory state={state} palette={palette} />;
  if (chapterId === "blue-moon-sanctuary") return <ArchiveMemory state={state} palette={palette} />;
  if (chapterId === "nest") return <NestMemory state={state} palette={palette} />;
  if (chapterId === "sunset-seer") return <MirrorMemory state={state} palette={palette} />;
  if (chapterId === "thorned-house") return <ThornedHouseMemory state={state} palette={palette} />;
  if (chapterId === "wolf-swan-seer") return <IntegrationMemory state={state} palette={palette} />;
  if (chapterId === "fire-river") {
    return <FireRiverMemory state={state} palette={palette} reducedMotion={reducedMotion} />;
  }
  if (chapterId === "fork") return <ForkMemory state={state} palette={palette} />;
  if (chapterId === "three-climbs") return <ThreeClimbsMemory state={state} palette={palette} />;
  if (chapterId === "crowned-return") return <CrownedMemory state={state} palette={palette} />;
  return <EpilogueMemory state={state} palette={palette} />;
}

export function WorldMemoryDirector({
  entries,
  state,
}: {
  entries: Slipper3DEntry[];
  state: WorldMemoryState;
}) {
  const reducedMotion = useSettingsStore((settings) => settings.reducedMotion);
  const palette = useMemo(
    () => resolveResonancePalette(state),
    [state.resonances.seer, state.resonances.swan, state.resonances.wolf],
  );

  if (entries.length === 0) return null;

  return (
    <group name="persistent-world-memory">
      {AUTHORED_MEMORY_LANDMARKS.filter((landmark) => landmark.chapterId !== state.chapterId).map((landmark) => (
        <group
          key={landmark.chapterId}
          position={landmark.position}
          rotation={[0, landmark.rotationY, 0]}
          userData={{
            chapterId: landmark.chapterId,
            anchorSceneId: landmark.anchorSceneId,
          }}
        >
          <NarrativeChapterMemory
            chapterId={landmark.chapterId}
            state={state}
            palette={palette}
            reducedMotion={reducedMotion}
          />
        </group>
      ))}
    </group>
  );
}

export default WorldMemoryDirector;
