import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { activateCinematicProfile, advanceCinematicProfile } from "../../../cinematics/emotionalCinematography";
import { useJourneyStore } from "../../../stores/useJourneyStore";
import { useSettingsStore } from "../../../stores/useSettingsStore";
import { useWorldStore } from "../../../stores/useWorldStore";
import type { JourneySceneId } from "../../../lib/storyJourneyState";
import { resolveSceneLook, type LookPoint, type LookQuality } from "./SceneLookRegistry";
import { SceneLookContext, type ScenePresentation } from "./SceneLookContext";
import { AuthoredLightShafts } from "./VolumetricLightShaft";
import { GroundMist } from "./GroundMist";
import { SceneLighting } from "./SceneLighting";
import { SceneAtmosphere } from "./SceneAtmosphere";
import { ScenePostProcessing } from "./ScenePostProcessing";
import { useStillnessState } from "../../../hooks/useStillnessState";
import { ASSISTED_STILLNESS_EVENT } from "../rituals/RitualInteraction";
import { advanceSceneMotion } from "./sceneMotion";

/** The sole global look owner. CameraController owns the camera; this layer never writes story facts. */
export function SceneLookDirector({ sceneId, quality, reducedEffects, reducedMotion, cameraAssistance, origin = [0, 0, 0], heading = 0, focusPosition, bloomIntensity = .6, vignetteIntensity = .1, children }: {
  sceneId: JourneySceneId; quality: LookQuality; reducedEffects: boolean; reducedMotion: boolean; cameraAssistance: boolean;
  origin?: LookPoint; heading?: number; focusPosition?: LookPoint | null; bloomIntensity?: number; vignetteIntensity?: number; children: ReactNode;
}) {
  const objects = useJourneyStore(s => s.storyObjectStates);
  const flags = useJourneyStore(s => s.worldFlags);
  const measuredStillness = useStillnessState({ requiredSeconds: 2.4, enabled: sceneId === "sunset.stillness", observeCamera: true });
  const [assisted, setAssisted] = useState(false);
  useEffect(() => {
    setAssisted(false);
    if (sceneId !== "sunset.stillness") return;
    const onStillness = (event: Event) => {
      const detail = (event as CustomEvent<{ active?: boolean; ritualId?: string }>).detail;
      if (!detail?.ritualId || detail.ritualId === "ritual.witness-mirror") setAssisted(detail?.active === true);
    };
    window.addEventListener(ASSISTED_STILLNESS_EVENT, onStillness);
    return () => window.removeEventListener(ASSISTED_STILLNESS_EVENT, onStillness);
  }, [sceneId]);
  const target = useMemo(() => resolveSceneLook(sceneId, quality, reducedEffects, {
    lanternOwned: flags["lantern.owned"], surrenderComplete: objects["river.white-fabric"] === "raised",
    compression: ["refilled-twice", "waiting-again"].includes(objects["thorn-house.table"]) ? 1 : objects["thorn-house.table"] === "refilled" ? .5 : 0,
    mindReleased: objects["mind.questions"] === "behind", creationComplete: Boolean(objects["womb.creation"]),
    nestHandsOccupied: Number(objects["nest.protected-linen"] === "carried") + Number(objects["nest.responsibility"] === "carried"),
    nestBurdenResting: objects["nest.responsibility"] === "placed",
    mirrorStill: measuredStillness || assisted,
    openingReveal: objects["broken-floor.reflection"] === "inverted" || objects["broken-floor.reflection"] === "revealed" ? 1 : objects["broken-floor.reflection"] === "clearing" ? .5 : 0,
    openingInverted: objects["broken-floor.reflection"] === "inverted",
  }), [sceneId, quality, reducedEffects, flags, objects, measuredStillness, assisted]);
  const presentation = useRef<ScenePresentation>({ look: target, reducedMotion, reducedEffects, stillness: Number(target.stillness), motion: { ...target.motion }, time: { vegetation: 0, cloth: 0, water: 0, particles: 0, flame: 0 } });
  const context = useMemo<ScenePresentation>(() => ({ look: target, reducedMotion, reducedEffects, origin, heading, stillness: presentation.current.stillness, motion: presentation.current.motion, time: presentation.current.time }), [target, reducedMotion, reducedEffects, origin, heading]);
  presentation.current = context;
  useEffect(() => activateCinematicProfile(), []);
  useFrame((_, delta) => {
    const active = !document.hidden && !useSettingsStore.getState().drawerOpen && useWorldStore.getState().mode === "explore";
    const dt = advanceSceneMotion(presentation.current, target, delta, active, reducedMotion, reducedEffects);
    advanceCinematicProfile(target.emotional, dt);
  }, -3);
  return <SceneLookContext.Provider value={context}>
    <group name="scene-look-authority" userData={{ sceneId, hero: target.composition.heroLandmark, quality }}>
      <SceneAtmosphere heading={heading} />
      <group position={origin} rotation={[0, heading, 0]}><SceneLighting quality={quality} /><AuthoredLightShafts /><GroundMist /></group>
      {target.budget.edgeSmoothing ? <ScenePostProcessing bloomIntensity={bloomIntensity} vignetteIntensity={vignetteIntensity} /> : null}
    </group>
    {children}
  </SceneLookContext.Provider>;
}
