import type { JourneyScene } from "../../../data/journeyNarrative";
import type { Slipper3DEntry } from "../../../data/slipper3dTypes";
import { AmbientProse } from "./AmbientProse";
import { AshProse } from "./AshProse";
import { ConstellationProse } from "./ConstellationProse";
import { ReflectedProse } from "./ReflectedProse";
import { WallProse } from "./WallProse";
import { WaterProse } from "./WaterProse";

type DiegeticProseDirectorProps = {
  entry?: Slipper3DEntry;
  scene?: JourneyScene;
  witnessed: boolean;
  active: boolean;
  suppressed?: boolean;
  onOpenReader: () => void;
};

const PROSE_COMPONENTS = {
  ambient: AmbientProse,
  reflected: ReflectedProse,
  water: WaterProse,
  ash: AshProse,
  wall: WallProse,
  constellation: ConstellationProse,
} as const;

export function DiegeticProseDirector({
  entry,
  scene,
  witnessed,
  active,
  suppressed = false,
  onOpenReader,
}: DiegeticProseDirectorProps) {
  if (!entry || !scene || !witnessed || !active || suppressed) return null;
  const treatment = scene.presentation.proseTreatment ?? "ambient";
  const Prose = PROSE_COMPONENTS[treatment];
  return <Prose entry={entry} onOpenReader={onOpenReader} />;
}

export default DiegeticProseDirector;
