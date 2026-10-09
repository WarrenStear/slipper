import { getJourneySceneForEntry } from '../../data/journeyNarrative';
import { SCENE_LOOKS } from '../../components/three/artDirection/SceneLookRegistry';
import type { JourneySceneId } from '../../lib/storyJourneyState';

export type FragmentTraceFamily = 'wet-timber'|'leaf-shadow'|'dark-water'|'linen'|'reflection'|'domestic-grain'|'stone'|'ash'|'river'|'earth'|'morning'|'night';
export type FragmentTraceInput = Readonly<{entryId:string;sceneId:JourneySceneId;witnessedEntryIds:readonly string[];
  reducedMotion:boolean;reducedEffects:boolean;highContrast:boolean;mobile:boolean;readerTheme:'ambient'|'clean'}>;

/** Decorative scalar view only: no prose, photograph relationships, URLs, timers or outcomes. */
export function resolveFragmentTrace(input:FragmentTraceInput) {
  if (!input.witnessedEntryIds.includes(input.entryId) || input.reducedEffects || input.highContrast || input.readerTheme==='clean') return null;
  const scene=getJourneySceneForEntry(input.entryId);
  if (!scene || scene.id!==input.sceneId) return null;
  const look=SCENE_LOOKS[scene.id];
  let family:FragmentTraceFamily;
  switch(scene.chapterId) {
    case 'broken-floor':family='wet-timber';break;
    case 'enchanted-wood':family='leaf-shadow';break;
    case 'blue-moon-sanctuary':family='dark-water';break;
    case 'nest':family='linen';break;
    case 'sunset-seer':family='reflection';break;
    case 'thorned-house':family='domestic-grain';break;
    case 'wolf-swan-seer':family='stone';break;
    case 'fire-river':family=scene.id.startsWith('river.')?'river':'ash';break;
    case 'fork':case 'three-climbs':family='earth';break;
    case 'crowned-return':family='morning';break;
    case 'lantern-epilogue':family='night';break;
  }
  return Object.freeze({family,ground:look.ground,light:look.keyColor,
    // The material trace is always static so the prose remains the only reading focus.
    motion:false});
}
