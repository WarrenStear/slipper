import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { JourneySceneId } from "../../../lib/storyJourneyState";
import { useJourneyStore } from "../../../stores/useJourneyStore";
import type { StoryObjectKind } from "../../../storyEvents/storyEventTypes";
import { readStorySequencePlayback } from "../../../storyEvents/storyEventRuntime";
import { StoryObjectModel } from "./StoryObjectModel";

/** Source order: a lived place returns before its light is allowed to become a star. */
const MEMORIES: readonly { scene: JourneySceneId; name: string; kind: StoryObjectKind; color: string }[] = [
  { scene: "crowned.home", name: "home", kind: "book", color: "#e0c398" },
  { scene: "crowned.threshold", name: "gate", kind: "door", color: "#c2bba4" },
  { scene: "climb.womb", name: "creation", kind: "seed", color: "#a8bd99" },
  { scene: "climb.heart", name: "chosen-heart", kind: "rose", color: "#d3a4ab" },
  { scene: "climb.mind", name: "questions-left-behind", kind: "page", color: "#d0d2cc" },
  { scene: "fork.four-verbs", name: "fork", kind: "marker", color: "#e0c398" },
  { scene: "river.release-surrender", name: "still-white-fabric", kind: "fabric", color: "#d9dfdd" },
  { scene: "river.wash", name: "moving-river", kind: "water", color: "#9cbcc7" },
  { scene: "fire.boundary", name: "ember", kind: "fire", color: "#ce9b76" },
  { scene: "wolf-swan.convergence", name: "wolf-swan-seer", kind: "feather", color: "#b3bdba" },
  { scene: "thorned.self-owned-world", name: "house-remembered", kind: "chair", color: "#b4a58d" },
  { scene: "sunset.stillness", name: "silver-seer", kind: "mirror", color: "#bdc6ce" },
  { scene: "nest.protection", name: "protected-nest", kind: "nest", color: "#d7bd94" },
  { scene: "blue-moon.intimacy", name: "beautiful-blue-moon", kind: "rose", color: "#a8bbd3" },
  { scene: "enchanted.masked-hearth", name: "enchanted-wood", kind: "seed", color: "#b6c3a1" },
  { scene: "broken-floor.confession", name: "origin", kind: "water", color: "#a7b9c1" },
];

export function ReverseMemoryLights({ reducedMotion }: { reducedMotion: boolean }) {
  const completed = useJourneyStore(state => state.completedSceneIds);
  const history = useJourneyStore(state => state.history);
  const reverseState = useJourneyStore(state => state.storyObjectStates["epilogue.reverse-light"]);
  const memory = useJourneyStore(state => state.storyObjectStates["heart.memory"]);
  const creation = useJourneyStore(state => state.storyObjectStates["womb.creation"]);
  const group = useRef<THREE.Group>(null);
  const points = useMemo(() => MEMORIES.map((_, i) => new THREE.Vector3(Math.sin(i * .68) * (3.5 + i * .22), .35, -4 - i * 1.7)), []);
  useFrame((_, delta) => {
    if (!group.current || !reverseState) return;
    const elapsed = reverseState === "complete" ? 24
      : readStorySequencePlayback("epilogue.constellation", "epilogue.reverse-light-complete") / 1000;
    group.current.children.forEach((landmark, i) => {
      landmark.visible = completed.includes(MEMORIES[i].scene);
      const light = Math.max(0, Math.min(1, (elapsed - i * 1.38 - .8) / 1.1));
      const motif = landmark.children[0];
      const star = landmark.children[1] as THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
      motif.visible = light > .02;
      star.material.opacity = light * .88;
      star.scale.setScalar(.12 + light * .88);
      // Reduced motion uses illumination alone; it never changes the sequence order.
      star.position.y = THREE.MathUtils.damp(star.position.y, reducedMotion ? 1 : 1 + (reverseState === "complete" ? 3.5 : 0), .9, Math.min(delta, .1));
      landmark.userData.illuminated = light > .9;
    });
  });
  return <group ref={group} name="reverse-light-lived-places" userData={{ sequenceSeconds: 24, evidenceCount: history.length, completedCount: completed.length }}>
    {MEMORIES.map((item, index) => {
      const kind = index === 3 && memory === "swan-feather" ? "feather" : index === 3 && memory === "blue-moon-reflection" ? "mirror" : index === 2 && creation === "voice" ? "page" : index === 2 && creation === "rest" ? "fabric" : item.kind;
      return <group key={item.name} position={points[index]} name={`reverse-memory:${item.name}`} userData={{ sourceScene: item.scene }}>
        <group scale={.65} visible={false}><StoryObjectModel kind={kind} state={index === 8 ? "ember" : undefined} reducedMotion={reducedMotion} /></group>
        <mesh position={[0, 1, 0]}><sphereGeometry args={[.12, 8, 6]} /><meshBasicMaterial color={item.color} transparent opacity={0} toneMapped={false} depthWrite={false} /></mesh>
      </group>;
    })}
  </group>;
}
