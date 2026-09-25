import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { JourneySceneId } from "../../../lib/storyJourneyState";
import { useJourneyStore } from "../../../stores/useJourneyStore";
import type { StoryObjectKind } from "../../../storyEvents/storyEventTypes";
import { readStorySequencePlayback } from "../../../storyEvents/storyEventRuntime";
import { StoryObjectModel } from "./StoryObjectModel";
import { JOURNEY_ENTRY_CONTEXT } from "../../../data/journeyNarrative";
import { memoryGroundPosition, reverseJourneyMemoryEntries, reverseMemoryIllumination, reverseMemoryRevealAt } from "../../../lib/journeyMemoryProjection";

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
  const reverseEntries = useMemo(() => reverseJourneyMemoryEntries(history), [history]);
  const remembered = useMemo(() => MEMORIES.flatMap(item => {
    const order = reverseEntries.findIndex(id => JOURNEY_ENTRY_CONTEXT[id].sceneId === item.scene);
    return order < 0 || !completed.includes(item.scene) ? [] : [{ ...item, order, entryId: reverseEntries[order] }];
  }).sort((a, b) => a.order - b.order), [completed, reverseEntries]);
  const geometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(reverseEntries.flatMap(memoryGroundPosition), 3));
    geometry.setAttribute("revealAt", new THREE.Float32BufferAttribute(reverseEntries.map((_, i) => reverseMemoryRevealAt(i, reverseEntries.length)), 1));
    return geometry;
  }, [reverseEntries]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const uniforms = useMemo(() => ({ elapsed: { value: 0 } }), []);
  useFrame(() => {
    if (!group.current) return;
    const elapsed = !reverseState ? 0 : reverseState === "complete" ? 24_000
      : readStorySequencePlayback("epilogue.constellation", "epilogue.reverse-light-complete");
    uniforms.elapsed.value = elapsed;
    group.current.children.forEach((landmark, i) => {
      const light = reverseMemoryIllumination(elapsed, remembered[i].order, reverseEntries.length);
      landmark.visible = light > .02;
      landmark.userData.illuminated = light > .9;
    });
  });
  return <group name="reverse-light-lived-places" userData={{ sequenceSeconds: 24, evidenceCount: history.length, completedCount: completed.length, reverseEntryIds: reverseEntries, source: "authored-journey-geography" }}>
    <points name="reverse-actual-route-lights" geometry={geometry} frustumCulled={false}>
      <shaderMaterial transparent depthWrite={false} uniforms={uniforms}
        vertexShader={`attribute float revealAt;uniform float elapsed;varying float light;void main(){light=clamp((elapsed-revealAt)/1100.,0.,1.);vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=clamp(50./max(3.,-p.z),1.5,5.);}`}
        fragmentShader={`varying float light;void main(){float edge=1.-smoothstep(.12,.5,length(gl_PointCoord-.5));gl_FragColor=vec4(.73,.8,.82,light*edge*.88);\n#include <colorspace_fragment>}`} />
    </points>
    <group ref={group}>
    {remembered.map(item => {
      const kind = item.scene === "climb.heart" && memory === "swan-feather" ? "feather" : item.scene === "climb.heart" && memory === "blue-moon-reflection" ? "mirror" : item.scene === "climb.womb" && creation === "voice" ? "page" : item.scene === "climb.womb" && creation === "rest" ? "fabric" : item.kind;
      return <group key={item.name} position={memoryGroundPosition(item.entryId)} visible={false} name={`reverse-memory:${item.name}`} userData={{ sourceScene: item.scene, sourceEntry: item.entryId, reverseOrder: item.order }}>
        <group scale={.65}><StoryObjectModel kind={kind} state={item.scene === "fire.boundary" ? "ember" : undefined} reducedMotion={reducedMotion} /></group>
      </group>;
    })}
    </group>
  </group>;
}
