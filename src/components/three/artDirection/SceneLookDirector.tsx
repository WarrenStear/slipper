import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { activateCinematicProfile, advanceCinematicProfile } from "../../../cinematics/emotionalCinematography";
import { useJourneyStore } from "../../../stores/useJourneyStore";
import { useSettingsStore } from "../../../stores/useSettingsStore";
import { useWorldStore } from "../../../stores/useWorldStore";
import type { JourneySceneId } from "../../../lib/storyJourneyState";
import { resolveSceneLook, type LookPoint, type LookQuality } from "./SceneLookRegistry";
import { SceneLookContext, useSceneLook, type ScenePresentation } from "./SceneLookContext";
import { AuthoredLightShafts } from "../../../world/atmosphere/VolumetricLightShaft";
import { GroundMist } from "../../../world/atmosphere/GroundMist";
import { SceneLighting } from "../../../world/lighting/SceneLighting";
import { SceneAtmosphere } from "../../../world/atmosphere/SceneAtmosphere";
import { ScenePostProcessing } from "./ScenePostProcessing";
import { useStillnessState } from "../../../hooks/useStillnessState";
import { ASSISTED_STILLNESS_EVENT } from "../rituals/RitualInteraction";
import { advanceSceneMotion } from "./sceneMotion";
import { SceneParticles } from "../../../world/atmosphere/SceneParticles";
import { scenePresentationActive } from "../../../world/presentationActivity";
import { RENDER_QUALITY_PROFILES } from "../renderQuality";

export type SceneLookDirectorProps = {
  sceneId: JourneySceneId; quality: LookQuality; reducedEffects: boolean; reducedMotion: boolean;
  /** Historic camera props are accepted by review callers; CameraController owns these. */
  cameraAssistance?: boolean; focusPosition?: LookPoint | null;
  origin?: LookPoint; heading?: number; bloomIntensity?: number; vignetteIntensity?: number; children: ReactNode;
  particlesEnabled?: boolean; particleScale?: number;
};

/** The sole global look owner. Nested compatibility callers cannot create another rig. */
export function SceneLookDirector(props: SceneLookDirectorProps) {
  const existing = useSceneLook();
  return existing ? <>{props.children}</> : <SceneLookOwner {...props} />;
}

function SceneLookOwner({ sceneId, quality, reducedEffects, reducedMotion, origin = [0, 0, 0], heading = 0, bloomIntensity = .6, vignetteIntensity = .1, particlesEnabled = true, particleScale = RENDER_QUALITY_PROFILES[quality].particleMultiplier, children }: SceneLookDirectorProps) {
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
    const world = useWorldStore.getState();
    const active = scenePresentationActive({ visible: !document.hidden, focused: document.hasFocus(), overlayOpen: useSettingsStore.getState().drawerOpen, mode: world.mode, physicsPaused: world.physicsPaused });
    const dt = advanceSceneMotion(presentation.current, target, delta, active, reducedMotion, reducedEffects);
    advanceCinematicProfile(target.emotional, dt);
  }, -3);
  return <SceneLookContext.Provider value={context}>
    <group name="scene-look-authority" userData={{ sceneId, hero: target.composition.heroLandmark, quality }}>
      <SceneAtmosphere heading={heading} />
      <group position={origin} rotation={[0, heading, 0]}><SceneLighting quality={quality} /><AuthoredLightShafts /><GroundMist /></group>
      <SceneParticles particleScale={particleScale} enabled={particlesEnabled} />
      {target.budget.edgeSmoothing ? <ScenePostProcessing bloomIntensity={bloomIntensity} vignetteIntensity={vignetteIntensity} /> : null}
    </group>
    {children}
  </SceneLookContext.Provider>;
}
